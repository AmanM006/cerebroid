"""Password hashing and token primitives.

- Passwords: argon2id (argon2-cffi defaults), never stored or logged in clear.
- Access tokens: short-lived HS256 JWTs. Decoding pins the algorithm list, so
  "alg: none" or algorithm-swap tokens are rejected.
- Refresh tokens: random opaque strings; the database stores only their
  SHA-256, so a database leak doesn't hand out working sessions.
"""
import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.config import get_settings

JWT_ALGORITHM="HS256"
JWT_ISSUER="vbx"
JWT_KIND_ACCESS="access"

_hasher=PasswordHasher()

# Verified against when the username doesn't exist, so a login attempt takes
# the same time whether or not the account exists (no user enumeration).
_DUMMY_HASH=_hasher.hash(secrets.token_urlsafe(16))


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerificationError, InvalidHashError):
        return False


def create_access_token(user_id: uuid.UUID, role: str, session_id: uuid.UUID) -> tuple[str, int]:
    """Returns (token, lifetime in seconds).

    session_id is the refresh-token family of the login. The token is accepted only while that
    family has a live refresh token, so logout (or detected token theft) ends it at once instead of
    leaving it valid until it expires.
    """
    settings=get_settings()
    now=datetime.now(UTC)
    lifetime=timedelta(minutes=settings.jwt_access_token_ttl_minutes)
    claims={
        "sub": str(user_id),
        "role": role,
        "type": JWT_KIND_ACCESS,
        "iss": JWT_ISSUER,
        "iat": now,
        "exp": now+lifetime,
        "jti": str(uuid.uuid4()),
        "sid": str(session_id),
    }
    token=jwt.encode(claims, settings.jwt_secret_key, algorithm=JWT_ALGORITHM)
    return token, int(lifetime.total_seconds())


def decode_access_token(token: str) -> dict:
    """Raises jwt.InvalidTokenError on any problem (expired, forged, wrong type)."""
    claims=jwt.decode(
        token,
        get_settings().jwt_secret_key,
        algorithms=[JWT_ALGORITHM],
        issuer=JWT_ISSUER,
        options={"require": ["sub", "role", "type", "iss", "iat", "exp", "jti", "sid"]},
    )
    if claims["type"]!=JWT_KIND_ACCESS:
        raise jwt.InvalidTokenError("not an access token")
    return claims


def new_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
