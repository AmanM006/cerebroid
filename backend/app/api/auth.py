"""Auth routes.

The access token is returned in the body and sent back as a Bearer header.
The refresh token lives only in an HttpOnly cookie scoped to /api/v1/auth, so
page JavaScript (and any XSS) can never read it, and it's never sent to any
other route.
"""
from fastapi import APIRouter, Cookie, Depends, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.schemas import LoginRequest, TokenResponse, UserOut
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.ratelimit import limit_refresh, login_limit_error, record_login_failure
from app.db.models import User
from app.db.session import get_db
from app.services import auth as auth_service

router=APIRouter(prefix="/api/v1/auth", tags=["auth"])

REFRESH_COOKIE="vbx_refresh"
REFRESH_COOKIE_PATH="/api/v1/auth"


def _set_refresh_cookie(response: Response, token: str) -> None:
    settings=get_settings()
    response.set_cookie(
        REFRESH_COOKIE,
        token,
        max_age=settings.jwt_refresh_token_ttl_days*24*3600,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=settings.is_production,
        samesite="strict",
    )


def _clear_refresh_cookie(response: Response) -> None:
    settings=get_settings()
    response.delete_cookie(
        REFRESH_COOKIE,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=settings.is_production,
        samesite="strict",
    )


@router.post("/login")
def login(
    body: LoginRequest, request: Request, response: Response, db: Session=Depends(get_db),
) -> TokenResponse:
    limited=login_limit_error(request)
    try:
        user=auth_service.authenticate(db, body.username, body.password)
    except AppError:
        record_login_failure(request)
        if limited is not None:
            raise limited from None
        raise
    issued=auth_service.start_session(db, user)
    _set_refresh_cookie(response, issued.refresh_token)
    return TokenResponse(access_token=issued.access_token, expires_in=issued.expires_in)


@router.post("/refresh", dependencies=[Depends(limit_refresh)])
def refresh(
    response: Response,
    vbx_refresh: str | None=Cookie(default=None, max_length=256),
    db: Session=Depends(get_db),
) -> TokenResponse:
    issued=auth_service.rotate_session(db, vbx_refresh)
    _set_refresh_cookie(response, issued.refresh_token)
    return TokenResponse(access_token=issued.access_token, expires_in=issued.expires_in)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    vbx_refresh: str | None=Cookie(default=None, max_length=256),
    db: Session=Depends(get_db),
) -> None:
    auth_service.end_session(db, vbx_refresh)
    _clear_refresh_cookie(response)


@router.get("/me")
def me(user: User=Depends(get_current_user)) -> UserOut:
    return UserOut(id=user.id, username=user.username, role=user.role, is_synthetic=user.is_synthetic)
