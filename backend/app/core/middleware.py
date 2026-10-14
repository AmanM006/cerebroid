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
from starlette.responses import Response

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
        logger.info(
            "request_handled",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=round(duration_ms, 2),
        )
        return response
