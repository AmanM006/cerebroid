"""Request-size limit, login rate limit and HSTS: regression tests from the adversarial audit."""
from app.core import ratelimit
from app.core.config import get_settings
from tests.conftest import TEST_PASSWORD


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


def test_hsts_only_in_production(client, monkeypatch):
    assert "strict-transport-security" not in client.get("/health").headers
    monkeypatch.setattr(get_settings(), "app_env", "production")
    assert "max-age" in client.get("/health").headers["strict-transport-security"]
