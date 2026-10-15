"""Per-client-IP login rate limit (sliding window, in memory).

Account lockout already stops guessing one account's password, but the synthetic test accounts are
exempt (their passwords are public) and lockout does nothing against one client trying many accounts.
This caps login attempts per client IP. In-memory is enough: the API runs as one process.

Client IP: behind Render's proxy every request comes from the proxy, so the address the proxy saw is
the last X-Forwarded-For entry (the one it appended). A client can add fake entries before it, but
not change the last one, so it cannot borrow or exhaust someone else's allowance.
"""
import threading
import time
from collections import deque

from fastapi import Request, status

from app.core.config import get_settings
from app.core.errors import AppError

_attempts: dict[str, deque[float]]={}
_lock=threading.Lock()
MAX_TRACKED_CLIENTS=10_000


def client_ip(request: Request) -> str:
    forwarded=request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[-1].strip()[:64]
    return request.client.host if request.client else "unknown"


def limit_login(request: Request) -> None:
    """FastAPI dependency: 429 once a client IP exceeds the allowed login attempts in the window."""
    settings=get_settings()
    now=time.monotonic()
    key=client_ip(request)
    with _lock:
        window=_attempts.setdefault(key, deque())
        while window and now-window[0]>settings.login_rate_window_seconds:
            window.popleft()
        if len(window)>=settings.login_rate_limit:
            retry=int(settings.login_rate_window_seconds-(now-window[0]))+1
            raise AppError(
                "RATE_LIMITED", "Too many sign-in attempts. Please wait and try again.",
                status.HTTP_429_TOO_MANY_REQUESTS, headers={"Retry-After": str(retry)},
            )
        window.append(now)
        if len(_attempts)>MAX_TRACKED_CLIENTS:
            # Drop idle clients so memory stays bounded.
            window_s=settings.login_rate_window_seconds
            for ip in [ip for ip, w in _attempts.items() if not w or now-w[-1]>window_s]:
                del _attempts[ip]


def reset() -> None:
    """Clears all counters (tests)."""
    with _lock:
        _attempts.clear()
