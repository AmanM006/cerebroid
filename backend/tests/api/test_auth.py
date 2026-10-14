"""End-to-end auth flow: login, me, refresh rotation, logout, lockout."""
from datetime import UTC, datetime, timedelta

from app.api.auth import REFRESH_COOKIE
from app.db.models import User
from tests.conftest import TEST_PASSWORD, login


def _body_without_request_id(response):
    body=response.json()
    body.pop("request_id")
    return body


def test_login_returns_access_token_and_httponly_refresh_cookie(client, make_user):
    make_user("alice")
    response=client.post("/api/v1/auth/login", json={"username": "alice", "password": TEST_PASSWORD})

    assert response.status_code==200
    body=response.json()
    assert body["token_type"]=="bearer"
    assert body["expires_in"]==15*60
    set_cookie=response.headers["set-cookie"]
    assert f"{REFRESH_COOKIE}=" in set_cookie
    assert "HttpOnly" in set_cookie
    assert "Path=/api/v1/auth" in set_cookie
    assert "SameSite=strict" in set_cookie


def test_me_returns_current_user(client, make_user):
    make_user("alice")
    response=client.get("/api/v1/auth/me", headers=login(client, "alice"))
    assert response.status_code==200
    assert response.json()["username"]=="alice"
    assert response.json()["role"]=="clinician"
    assert "password_hash" not in response.json()


def test_wrong_password_and_unknown_user_are_indistinguishable(client, make_user):
    make_user("alice")
    wrong=client.post("/api/v1/auth/login", json={"username": "alice", "password": "nope-nope-nope"})
    unknown=client.post("/api/v1/auth/login", json={"username": "nobody", "password": "nope-nope-nope"})

    assert wrong.status_code==unknown.status_code==401
    assert _body_without_request_id(wrong)==_body_without_request_id(unknown)
    assert wrong.json()["error_code"]=="AUTH_INVALID_CREDENTIALS"


def test_account_locks_after_repeated_failures(client, make_user, db):
    user=make_user("alice")
    for _ in range(5):
        client.post("/api/v1/auth/login", json={"username": "alice", "password": "wrong-password"})

    locked=client.post("/api/v1/auth/login", json={"username": "alice", "password": TEST_PASSWORD})
    assert locked.status_code==401
    assert locked.json()["error_code"]=="AUTH_INVALID_CREDENTIALS"

    db.refresh(user)
    user.locked_until=datetime.now(UTC)-timedelta(seconds=1)
    db.commit()
    unlocked=client.post("/api/v1/auth/login", json={"username": "alice", "password": TEST_PASSWORD})
    assert unlocked.status_code==200


def test_successful_login_resets_failure_count(client, make_user, db):
    user=make_user("alice")
    for _ in range(4):
        client.post("/api/v1/auth/login", json={"username": "alice", "password": "wrong-password"})
    login(client, "alice")
    db.refresh(user)
    assert user.failed_login_count==0


def test_inactive_user_cannot_log_in(client, make_user, db):
    user=make_user("alice")
    user.is_active=False
    db.commit()
    response=client.post("/api/v1/auth/login", json={"username": "alice", "password": TEST_PASSWORD})
    assert response.status_code==401


def test_refresh_rotates_the_refresh_token(client, make_user):
    make_user("alice")
    login(client, "alice")
    first_cookie=client.cookies.get(REFRESH_COOKIE)

    response=client.post("/api/v1/auth/refresh")
    assert response.status_code==200
    assert response.json()["access_token"]
    assert client.cookies.get(REFRESH_COOKIE)!=first_cookie


def test_reusing_a_rotated_refresh_token_revokes_the_whole_session(client, make_user):
    make_user("alice")
    login(client, "alice")
    stolen=client.cookies.get(REFRESH_COOKIE)

    assert client.post("/api/v1/auth/refresh").status_code==200
    current=client.cookies.get(REFRESH_COOKIE)

    client.cookies.set(REFRESH_COOKIE, stolen, path="/api/v1/auth")
    replay=client.post("/api/v1/auth/refresh")
    assert replay.status_code==401
    assert replay.json()["error_code"]=="AUTH_INVALID_TOKEN"

    client.cookies.set(REFRESH_COOKIE, current, path="/api/v1/auth")
    assert client.post("/api/v1/auth/refresh").status_code==401


def test_refresh_without_cookie_is_rejected(client):
    response=client.post("/api/v1/auth/refresh")
    assert response.status_code==401
    assert response.json()["error_code"]=="AUTH_INVALID_TOKEN"


def test_refresh_with_garbage_cookie_is_rejected(client):
    client.cookies.set(REFRESH_COOKIE, "not-a-real-token", path="/api/v1/auth")
    assert client.post("/api/v1/auth/refresh").status_code==401


def test_logout_revokes_refresh_token(client, make_user):
    make_user("alice")
    login(client, "alice")
    token=client.cookies.get(REFRESH_COOKIE)

    assert client.post("/api/v1/auth/logout").status_code==204

    client.cookies.set(REFRESH_COOKIE, token, path="/api/v1/auth")
    assert client.post("/api/v1/auth/refresh").status_code==401


def test_logout_without_session_is_harmless(client):
    assert client.post("/api/v1/auth/logout").status_code==204


def test_login_rejects_unknown_fields(client, make_user):
    make_user("alice")
    response=client.post(
        "/api/v1/auth/login",
        json={"username": "alice", "password": TEST_PASSWORD, "role": "reviewer"},
    )
    assert response.status_code==422
    assert response.json()["error_code"]=="VALIDATION_ERROR"


def test_login_rejects_non_string_values(client):
    response=client.post("/api/v1/auth/login", json={"username": "alice", "password": 12345678})
    assert response.status_code==422


def test_login_rejects_oversized_password(client):
    response=client.post("/api/v1/auth/login", json={"username": "alice", "password": "x"*10_000})
    assert response.status_code==422


def test_password_is_stored_as_argon2id(make_user, db):
    user=make_user("alice")
    stored=db.get(User, user.id)
    assert stored.password_hash.startswith("$argon2id$")
    assert TEST_PASSWORD not in stored.password_hash
