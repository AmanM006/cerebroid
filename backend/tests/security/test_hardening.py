"""Request-size limit, login rate limit and HSTS: regression tests from the adversarial audit."""
import uuid

import pytest

from app.core import compute, ratelimit
from app.core.config import get_settings
from app.core.errors import AppError
from tests.conftest import TEST_PASSWORD, login


def test_oversized_body_is_rejected_before_parsing(client):
    big=b'{"username":"'+b"a"*(get_settings().max_body_bytes+10)+b'","password":"x"}'
    response=client.post("/api/v1/auth/login", content=big, headers={"content-type": "application/json"})
    assert response.status_code==413
    body=response.json()
    assert body["error_code"]=="PAYLOAD_TOO_LARGE" and body["request_id"]
    assert response.headers["x-content-type-options"]=="nosniff"


def test_chunked_oversized_body_is_rejected(client):
    def chunks():
        for _ in range(get_settings().max_body_bytes//65536+2):
            yield b"a"*65536
    response=client.post("/api/v1/auth/login", content=chunks(), headers={"content-type": "application/json"})
    assert response.status_code==413


def test_small_bodies_still_work(client, make_user):
    make_user("alice")
    response=client.post("/api/v1/auth/login", json={"username": "alice", "password": TEST_PASSWORD})
    assert response.status_code==200


def test_login_attempts_are_limited_per_client_ip(client, make_user, monkeypatch):
    make_user("alice")
    settings=get_settings()
    monkeypatch.setattr(settings, "login_rate_limit", 3)
    ratelimit.reset()
    try:
        bad={"username": "alice", "password": "wrong-password"}
        headers={"x-forwarded-for": "198.51.100.7"}
        statuses=[client.post("/api/v1/auth/login", json=bad, headers=headers).status_code for _ in range(4)]
        assert statuses==[401, 401, 401, 429]
        limited=client.post("/api/v1/auth/login", json=bad, headers=headers)
        assert limited.json()["error_code"]=="RATE_LIMITED" and int(limited.headers["retry-after"])>0
        # A client cannot exhaust someone else's allowance by faking earlier forwarded-for entries.
        other={"x-forwarded-for": "198.51.100.7, 203.0.113.9"}
        assert client.post("/api/v1/auth/login", json=bad, headers=other).status_code==401
    finally:
        ratelimit.reset()


def test_correct_password_still_works_from_a_limited_address(client, make_user, monkeypatch):
    """Many people share one public address (a campus network): someone guessing there must not lock
    everyone else out, while further wrong guesses from it stay blocked."""
    make_user("alice")
    monkeypatch.setattr(get_settings(), "login_rate_limit", 2)
    ratelimit.reset()
    try:
        headers={"x-forwarded-for": "198.51.100.9"}
        bad={"username": "alice", "password": "wrong-password"}
        assert [client.post("/api/v1/auth/login", json=bad, headers=headers).status_code
                for _ in range(3)]==[401, 401, 429]
        good={"username": "alice", "password": TEST_PASSWORD}
        assert client.post("/api/v1/auth/login", json=good, headers=headers).status_code==200
        assert client.post("/api/v1/auth/login", json=bad, headers=headers).status_code==429
    finally:
        ratelimit.reset()


def test_successful_logins_do_not_use_up_the_allowance(client, make_user, monkeypatch):
    make_user("alice")
    monkeypatch.setattr(get_settings(), "login_rate_limit", 2)
    ratelimit.reset()
    try:
        good={"username": "alice", "password": TEST_PASSWORD}
        headers={"x-forwarded-for": "198.51.100.8"}
        assert {client.post("/api/v1/auth/login", json=good, headers=headers).status_code
                for _ in range(5)}=={200}
    finally:
        ratelimit.reset()


def test_trusted_client_ip_header_is_used_when_configured(client, make_user, monkeypatch):
    """On Render, Cloudflare's CF-Connecting-IP identifies the client; X-Forwarded-For ends with a
    proxy address shared by everyone, and a forged CF-Connecting-IP that is not an address is ignored."""
    make_user("alice")
    monkeypatch.setattr(get_settings(), "login_rate_limit", 1)
    monkeypatch.setattr(get_settings(), "client_ip_header", "cf-connecting-ip")
    ratelimit.reset()
    try:
        bad={"username": "alice", "password": "wrong-password"}
        shared_proxy="10.0.0.1"
        a={"cf-connecting-ip": "198.51.100.30", "x-forwarded-for": shared_proxy}
        b={"cf-connecting-ip": "198.51.100.31", "x-forwarded-for": shared_proxy}
        assert client.post("/api/v1/auth/login", json=bad, headers=a).status_code==401
        assert client.post("/api/v1/auth/login", json=bad, headers=a).status_code==429
        assert client.post("/api/v1/auth/login", json=bad, headers=b).status_code==401
        junk={"cf-connecting-ip": "<script>", "x-forwarded-for": "198.51.100.32"}
        assert client.post("/api/v1/auth/login", json=bad, headers=junk).status_code==401
    finally:
        ratelimit.reset()


def test_hsts_only_in_production(client, monkeypatch):
    assert "strict-transport-security" not in client.get("/health").headers
    monkeypatch.setattr(get_settings(), "app_env", "production")
    assert "max-age" in client.get("/health").headers["strict-transport-security"]


def test_analysis_requests_are_limited_per_user_and_ip(client, make_user, monkeypatch):
    make_user("alice")
    headers=login(client, "alice")
    monkeypatch.setattr(get_settings(), "analysis_rate_limit", 2)
    ratelimit.reset()
    try:
        url=f"/api/v1/studies/{uuid.uuid4()}/profile"
        a={**headers, "x-forwarded-for": "198.51.100.20"}
        assert [client.get(url, headers=a).status_code for _ in range(3)]==[404, 404, 429]
        # Same account from another address (evaluators share accounts) is not affected.
        b={**headers, "x-forwarded-for": "198.51.100.21"}
        assert client.get(url, headers=b).status_code==404
    finally:
        ratelimit.reset()


def test_heavy_computation_returns_busy_when_all_slots_are_taken(monkeypatch):
    settings=get_settings()
    monkeypatch.setattr(settings, "heavy_concurrency", 1)
    monkeypatch.setattr(settings, "heavy_wait_seconds", 0.05)
    compute.reset()
    try:
        with compute.heavy_slot():
            with pytest.raises(AppError) as busy:
                with compute.heavy_slot():
                    pass
        assert busy.value.error_code=="SERVER_BUSY" and busy.value.status_code==503
        with compute.heavy_slot():  # released again once the first computation ends
            pass
    finally:
        compute.reset()
