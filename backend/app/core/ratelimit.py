"""Rate limits (in memory; the API runs as one process). The heavy-computation cap is in compute.py.

- Login: attempts per client IP. Account lockout stops guessing one account's password, but the
  synthetic test accounts are exempt (their passwords are public) and lockout does nothing against
  one client trying many accounts.
- Analysis endpoints: requests per signed-in user and client IP. Keyed by both because evaluators
  share the test accounts, so one person cannot use up everyone's allowance.

Client IP: on Render, Cloudflare's CF-Connecting-IP (Cloudflare overwrites any value a client sends;
Render's proxy appends its own address to X-Forwarded-For, so the last entry there is shared by
everyone). Behind our nginx, the last X-Forwarded-For entry is the address nginx saw. A client can add
fake entries before it, but not change the last one, so it cannot borrow or exhaust someone else's
allowance.
"""
import ipaddress
import threading
import time
from collections import deque

from fastapi import Depends, Request, status

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.errors import AppError
from app.db.models import User

_attempts: dict[tuple[str, str], deque[float]]={}
_lock=threading.Lock()
MAX_TRACKED_CLIENTS=10_000


def _valid_ip(value: str) -> str | None:
    try:
        return str(ipaddress.ip_address(value.strip()))
    except ValueError:
        return None


def client_ip(request: Request) -> str:
    header=get_settings().client_ip_header
    if header:
        trusted=_valid_ip(request.headers.get(header, ""))
        if trusted:
            return trusted
    forwarded=request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[-1].strip()[:64]
    return request.client.host if request.client else "unknown"


def hit(bucket: str, key: str, limit: int, window_s: int, message: str, record: bool=True) -> None:
    """429 if `key` already used `limit` requests in the window; otherwise counts this one (unless
    record is False: then it only checks, and the caller counts later with record_hit)."""
    now=time.monotonic()
    with _lock:
        window=_attempts.setdefault((bucket, key), deque())
        while window and now-window[0]>window_s:
            window.popleft()
        if len(window)>=limit:
            retry=int(window_s-(now-window[0]))+1
            raise AppError("RATE_LIMITED", message, status.HTTP_429_TOO_MANY_REQUESTS,
                           headers={"Retry-After": str(retry)})
        if record:
            window.append(now)
        if len(_attempts)>MAX_TRACKED_CLIENTS:
            # Drop idle clients so memory stays bounded.
            for k in [k for k, w in _attempts.items() if not w or now-w[-1]>window_s]:
                del _attempts[k]


_LOGIN_MESSAGE="Too many failed sign-in attempts. Please wait and try again."


def limit_login(request: Request) -> None:
    """FastAPI dependency: 429 once a client IP has too many FAILED logins in the window.

    Only failures count (record_login_failure), so evaluators signing in from one shared network
    never use up the allowance; someone guessing passwords does.
    """
    s=get_settings()
    hit("login", client_ip(request), s.login_rate_limit, s.login_rate_window_seconds, _LOGIN_MESSAGE,
        record=False)


def record_login_failure(request: Request) -> None:
    with _lock:
        _attempts.setdefault(("login", client_ip(request)), deque()).append(time.monotonic())


def limit_refresh(request: Request) -> None:
    """FastAPI dependency: refresh calls per client IP (each one is a database lookup and write)."""
    s=get_settings()
    hit("refresh", client_ip(request), s.refresh_rate_limit, s.login_rate_window_seconds,
        "Too many session refreshes. Please wait and try again.")


def limit_analysis(request: Request, user: User=Depends(get_current_user)) -> None:
    """FastAPI dependency: 429 once one user from one client IP exceeds the analysis request rate."""
    s=get_settings()
    hit("analysis", f"{user.id}|{client_ip(request)}", s.analysis_rate_limit, s.analysis_rate_window_seconds,
         "Too many requests. Please wait a moment and try again.")


def reset() -> None:
    """Clears all counters (tests)."""
    with _lock:
        _attempts.clear()
