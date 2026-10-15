"""Forged, expired and malformed access tokens must all be rejected."""
import base64
import json
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.core.config import get_settings
from app.core.security import JWT_ISSUER
from tests.conftest import login


def _token(user_id, **overrides):
    now=datetime.now(UTC)
    claims={
        "sub": str(user_id),
        "role": "clinician",
        "type": "access",
        "iss": JWT_ISSUER,
        "iat": now,
        "exp": now+timedelta(minutes=5),
        "jti": str(uuid.uuid4()),
    }
    claims.update(overrides)
    key=claims.pop("_key", get_settings().jwt_secret_key)
    return jwt.encode({k: v for k, v in claims.items() if v is not None}, key, algorithm="HS256")


def _sid(client, username="alice"):
    """Session id of a real login, so a handmade token belongs to a live session."""
    token=login(client, username)["Authorization"].removeprefix("Bearer ")
    return jwt.decode(token, options={"verify_signature": False})["sid"]


def _me(client, token):
    return client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})


def test_missing_token_is_401_with_challenge(client):
    response=client.get("/api/v1/auth/me")
    assert response.status_code==401
    assert response.json()["error_code"]=="AUTH_REQUIRED"
    assert response.headers["WWW-Authenticate"]=="Bearer"


def test_valid_handmade_token_is_accepted(client, make_user):
    user=make_user("alice")
    assert _me(client, _token(user.id, sid=_sid(client))).status_code==200


def test_expired_token_is_rejected(client, make_user):
    user=make_user("alice")
    past=datetime.now(UTC)-timedelta(minutes=30)
    token=_token(user.id, sid=_sid(client), iat=past, exp=past+timedelta(minutes=1))
    assert _me(client, token).status_code==401


def test_token_signed_with_another_key_is_rejected(client, make_user):
    user=make_user("alice")
    assert _me(client, _token(user.id, sid=_sid(client), _key=secrets.token_urlsafe(32))).status_code==401


def test_alg_none_token_is_rejected(client, make_user):
    user=make_user("alice")

    def b64(data: dict) -> str:
        return base64.urlsafe_b64encode(json.dumps(data).encode()).rstrip(b"=").decode()

    exp=int((datetime.now(UTC)+timedelta(minutes=5)).timestamp())
    header=b64({"alg": "none", "typ": "JWT"})
    payload=b64({"sub": str(user.id), "role": "reviewer", "type": "access", "iss": JWT_ISSUER,
                 "iat": exp-300, "exp": exp, "jti": "x"})
    assert _me(client, f"{header}.{payload}.").status_code==401


def test_tampered_payload_is_rejected(client, make_user):
    make_user("alice")
    token=login(client, "alice")["Authorization"].removeprefix("Bearer ")
    header, payload, signature=token.split(".")
    claims=json.loads(base64.urlsafe_b64decode(payload+"=="))
    claims["role"]="reviewer"
    forged=base64.urlsafe_b64encode(json.dumps(claims).encode()).rstrip(b"=").decode()
    assert _me(client, f"{header}.{forged}.{signature}").status_code==401


@pytest.mark.parametrize("overrides", [
    {"type": "refresh"},
    {"iss": "someone-else"},
    {"jti": None},
    {"sub": "not-a-uuid"},
    {"sid": None},
    {"sid": "not-a-uuid"},
    {"sid": str(uuid.UUID(int=0))},
])
def test_tokens_with_wrong_claims_are_rejected(client, make_user, overrides):
    user=make_user("alice")
    assert _me(client, _token(user.id, **{"sid": _sid(client), **overrides})).status_code==401


def test_token_for_deleted_user_is_rejected(client, make_user, db):
    user=make_user("alice")
    token=_token(user.id, sid=str(uuid.uuid4()))
    db.delete(user)
    db.commit()
    assert _me(client, token).status_code==401


def test_token_for_deactivated_user_is_rejected(client, make_user, db):
    user=make_user("alice")
    headers=login(client, "alice")
    user.is_active=False
    db.commit()
    assert client.get("/api/v1/auth/me", headers=headers).status_code==401


def test_non_bearer_scheme_is_rejected(client, make_user):
    user=make_user("alice")
    token=_token(user.id, sid=_sid(client))
    response=client.get("/api/v1/auth/me", headers={"Authorization": f"Basic {token}"})
    assert response.status_code==401


def test_access_token_stops_working_at_logout(client, make_user):
    make_user("alice")
    headers=login(client, "alice")
    assert client.get("/api/v1/auth/me", headers=headers).status_code==200
    assert client.post("/api/v1/auth/logout").status_code==204
    assert client.get("/api/v1/auth/me", headers=headers).status_code==401


def test_access_token_of_another_users_session_is_rejected(client, make_user):
    alice, _=make_user("alice"), make_user("bob")
    bob_sid=_sid(client, "bob")
    assert _me(client, _token(alice.id, sid=bob_sid)).status_code==401
