"""Request-ID middleware.

Every request gets an ID (reused from the X-Request-Id header if the caller
already supplied one, e.g. a frontend that generated it for its own error
toast). The ID is bound into structlog context so every log line emitted
while handling the request carries it, and it's echoed back in the response
header and in every error body (see errors.py) so a user can hand us one ID
and we can find the exact log lines.
"""
import re
import time
import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.config import get_settings

REQUEST_ID_HEADER="X-Request-Id"
# A caller-supplied ID is reused only if it is short and plain, so it can't inject into logs or headers.
_SAFE_REQUEST_ID=re.compile(r"^[A-Za-z0-9-]{8,64}$")

# Same policy as ops/nginx/security_headers.inc, so the API is covered when reached directly
# or when it serves the frontend itself. NiiVue needs WebGL, blob: workers and wasm.
SECURITY_HEADERS={
    "Content-Security-Policy": (
        "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob:; "
        "connect-src 'self' blob: data:; worker-src 'self' blob:; object-src 'none'; "
        "base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
    ),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}

logger=structlog.get_logger("http")


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        supplied=request.headers.get(REQUEST_ID_HEADER, "")
        request_id=supplied if _SAFE_REQUEST_ID.match(supplied) else str(uuid.uuid4())
        request.state.request_id=request_id

        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        start=time.perf_counter()
        response=await call_next(request)
        duration_ms=(time.perf_counter()-start)*1000

        response.headers[REQUEST_ID_HEADER]=request_id
        for name, value in SECURITY_HEADERS.items():
            response.headers.setdefault(name, value)
        if get_settings().is_production:
            # Production is served only over HTTPS; tell browsers never to use plain HTTP for it.
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        logger.info(
            "request_handled",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=round(duration_ms, 2),
        )
        return response


class BodySizeLimitMiddleware:
    """Rejects request bodies over max_body_bytes with 413 before any route parses them.

    Without it the server reads an arbitrarily large body into memory just to reject it. Checks the
    declared Content-Length first, then counts bytes as they arrive (chunked bodies send none).
    """

    def __init__(self, app: ASGIApp, max_body_bytes: int,
                 large_routes: dict[tuple[str, str], int] | None=None) -> None:
        self.app=app
        self.max_body_bytes=max_body_bytes
        # (method, path) -> larger limit for file uploads. Their bodies are streamed, not buffered:
        # the multipart parser spools files to disk, so they must declare their length up front.
        self.large_routes=large_routes or {}

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"]!="http":
            await self.app(scope, receive, send)
            return
        declared=dict(scope.get("headers") or []).get(b"content-length")
        large=self.large_routes.get((scope["method"], scope["path"]))
        if large is not None:
            if declared is None or not declared.isdigit():
                await self._reject(scope, receive, send, 411, "LENGTH_REQUIRED",
                                   "Uploads must declare their size (Content-Length).")
            elif int(declared)>large:
                await self._reject(scope, receive, send)
            else:
                await self.app(scope, self._capped(receive, int(declared)), send)
            return
        if declared is not None and (not declared.isdigit() or int(declared)>self.max_body_bytes):
            await self._reject(scope, receive, send)
            return

        body: list[Message]=[]
        size=0
        more=True
        while more:
            message=await receive()
            if message["type"]!="http.request":
                body.append(message)
                break
            size+=len(message.get("body", b""))
            if size>self.max_body_bytes:
                await self._reject(scope, receive, send)
                return
            body.append(message)
            more=message.get("more_body", False)

        async def replay() -> Message:
            return body.pop(0) if body else await receive()
        await self.app(scope, replay, send)

    @staticmethod
    def _capped(receive: Receive, limit: int) -> Receive:
        """Passes the body through, ending the request if it sends more than it declared."""
        received=0

        async def wrapped() -> Message:
            nonlocal received
            message=await receive()
            if message["type"]=="http.request":
                received+=len(message.get("body", b""))
                if received>limit:
                    return {"type": "http.disconnect"}
            return message
        return wrapped

    async def _reject(self, scope: Scope, receive: Receive, send: Send, status_code: int=413,
                      error_code: str="PAYLOAD_TOO_LARGE", message: str="Request body is too large.") -> None:
        request_id=(scope.get("state") or {}).get("request_id")
        response=JSONResponse(
            {"error_code": error_code, "message": message, "request_id": request_id},
            status_code=status_code,
        )
        await response(scope, receive, send)
