"""Login, refresh-token rotation and logout.

Every failure a client can see is one of two generic errors
(AUTH_INVALID_CREDENTIALS for login, AUTH_INVALID_TOKEN for sessions). The
specific reason (unknown user, locked account, reused token, ...) goes only to
the server log, so an attacker learns nothing from the response.
"""
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import structlog
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError, unauthorized
from app.core.security import (
    create_access_token,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)
from app.db.models import RefreshToken, User

logger=structlog.get_logger("auth")


@dataclass(frozen=True)
class IssuedSession:
    user: User
    access_token: str
    expires_in: int
    refresh_token: str


def _invalid_credentials() -> AppError:
    return unauthorized("AUTH_INVALID_CREDENTIALS", "Invalid username or password.")


def _invalid_session() -> AppError:
    return unauthorized("AUTH_INVALID_TOKEN", "Session is invalid or expired. Please sign in again.")


def authenticate(db: Session, username: str, password: str) -> User:
    settings=get_settings()
    now=datetime.now(UTC)
    user=db.scalar(select(User).where(User.username==username).with_for_update())

    # Always run a full argon2 verify (against a dummy hash for unknown users)
    # so response time doesn't reveal which usernames exist.
    password_ok=verify_password(user.password_hash if user else None, password)

    if user is None:
        logger.info("login_failed", reason="unknown_user")
        raise _invalid_credentials()

    locked_until = (
        user.locked_until.replace(tzinfo=UTC)
        if user and user.locked_until is not None and user.locked_until.tzinfo is None
        else (user.locked_until if user else None)
    )
    if locked_until is not None and locked_until > now:
        logger.info("login_failed", reason="locked", user_id=str(user.id))
        raise _invalid_credentials()

    # Synthetic test accounts have their passwords published for evaluators, so locking them
    # protects nothing and would let anyone lock evaluators out; they are never locked.
    if (not password_ok or not user.is_active) and not user.is_synthetic:
        user.failed_login_count+=1
        if user.failed_login_count>=settings.login_max_failed_attempts:
            user.locked_until=now+timedelta(minutes=settings.login_lockout_minutes)
            user.failed_login_count=0
            logger.warning("account_locked", user_id=str(user.id))
        db.commit()
    if not password_ok or not user.is_active:
        reason="bad_password" if user.is_active else "inactive"
        logger.info("login_failed", reason=reason, user_id=str(user.id))
        raise _invalid_credentials()

    user.failed_login_count=0
    user.locked_until=None
    db.commit()
    logger.info("login_succeeded", user_id=str(user.id))
    return user


def _issue(db: Session, user: User, family_id: uuid.UUID) -> tuple[RefreshToken, IssuedSession]:
    settings=get_settings()
    raw=new_refresh_token()
    record=RefreshToken(
        user_id=user.id,
        family_id=family_id,
        token_hash=hash_refresh_token(raw),
        expires_at=datetime.now(UTC)+timedelta(days=settings.jwt_refresh_token_ttl_days),
    )
    db.add(record)
    db.flush()
    access, expires_in=create_access_token(user.id, user.role.value)
    return record, IssuedSession(user=user, access_token=access, expires_in=expires_in, refresh_token=raw)


def start_session(db: Session, user: User) -> IssuedSession:
    _, issued=_issue(db, user, family_id=uuid.uuid4())
    db.commit()
    return issued


def _revoke_family(db: Session, family_id: uuid.UUID) -> None:
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id==family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )


def rotate_session(db: Session, raw_token: str | None) -> IssuedSession:
    if not raw_token:
        raise _invalid_session()

    record=db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash==hash_refresh_token(raw_token)).with_for_update()
    )
    if record is None:
        logger.info("refresh_failed", reason="unknown_token")
        raise _invalid_session()

    if record.revoked_at is not None:
        # A token that was already rotated or logged out is being replayed:
        # assume it was stolen and kill every session descended from that login.
        _revoke_family(db, record.family_id)
        db.commit()
        logger.warning(
            "refresh_token_reuse_detected",
            user_id=str(record.user_id),
            family_id=str(record.family_id),
        )
        raise _invalid_session()

    user=db.get(User, record.user_id)
    # SQLite returns naive datetimes; they are stored in UTC.
    record_expires=record.expires_at if record.expires_at.tzinfo else record.expires_at.replace(tzinfo=UTC)
    if record_expires<=datetime.now(UTC) or user is None or not user.is_active:
        logger.info("refresh_failed", reason="expired_or_inactive", user_id=str(record.user_id))
        raise _invalid_session()

    new_record, issued=_issue(db, user, family_id=record.family_id)
    record.revoked_at=datetime.now(UTC)
    record.replaced_by_id=new_record.id
    db.commit()
    return issued


def end_session(db: Session, raw_token: str | None) -> None:
    """Logout. Idempotent: an unknown or already-revoked token is not an error."""
    if not raw_token:
        return
    record=db.scalar(select(RefreshToken).where(RefreshToken.token_hash==hash_refresh_token(raw_token)))
    if record is not None:
        _revoke_family(db, record.family_id)
        db.commit()
        logger.info("logout", user_id=str(record.user_id))
