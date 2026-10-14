"""Authentication and authorization dependencies.

Every protected route depends on these instead of doing its own checks:
- get_current_user: valid access token -> active user, else 401.
- require_role: role gate, else 403.
- get_accessible_study: the single anti-IDOR choke point. A study is
  returned only if it is a public demo case or owned by the caller; anything
  else is a 404, identical to a study that doesn't exist.
"""
import uuid
from collections.abc import Callable

import jwt
import structlog
from fastapi import Depends, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import Select, or_, select
from sqlalchemy.orm import Session

from app.services import audit as audit_service
from app.core.errors import AppError, not_found, unauthorized
from app.core.security import decode_access_token
from app.db.models import Role, Study, StudyKind, User
from app.db.session import get_db
from app.domain.feature_store import FeatureStore
from app.domain.volume_store import VolumeStore
from app.domain.registry import MarkerRegistry

logger=structlog.get_logger("authz")

_bearer=HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None=Depends(_bearer),
    db: Session=Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower()!="bearer":
        raise unauthorized("AUTH_REQUIRED", "Authentication required.")
    try:
        claims=decode_access_token(credentials.credentials)
        user_id=uuid.UUID(claims["sub"])
    except (jwt.InvalidTokenError, ValueError):
        raise unauthorized()

    user=db.get(User, user_id)
    if user is None or not user.is_active:
        raise unauthorized()
    structlog.contextvars.bind_contextvars(user_id=str(user.id))
    return user


def require_role(*roles: Role) -> Callable[..., User]:
    def dependency(user: User=Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise AppError("FORBIDDEN", "You do not have access to this resource.", status.HTTP_403_FORBIDDEN)
        return user
    return dependency


def accessible_studies(user: User) -> Select[tuple[Study]]:
    """The visibility rule, shared by list and detail routes so they can't drift."""
    return select(Study).where(or_(Study.kind==StudyKind.DEMO, Study.owner_id==user.id))


def get_accessible_study(
    study_id: uuid.UUID,
    user: User=Depends(get_current_user),
    db: Session=Depends(get_db),
) -> Study:
    study=db.scalar(accessible_studies(user).where(Study.id==study_id))
    if study is None:
        logger.info("study_access_denied_or_missing", study_id=str(study_id))
        raise not_found()
    return study


def get_registry(request: Request) -> MarkerRegistry:
    return request.app.state.registry


def get_feature_store(request: Request) -> FeatureStore:
    return request.app.state.feature_store


def get_volume_store(request: Request) -> VolumeStore:
    return request.app.state.volume_store


Auditor=Callable[..., None]


def get_auditor(user: User=Depends(get_current_user), db: Session=Depends(get_db)) -> Auditor:
    """Records who accessed what in the hash-chained audit log (services/audit.py)."""
    def audit(action: str, object_id: str | None=None, model_version: str | None=None) -> None:
        audit_service.record(db, user.id, action, object_id, model_version)
    return audit
