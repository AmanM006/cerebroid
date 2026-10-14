"""Request-ID middleware.

Every request gets an ID (reused from the X-Request-Id header if the caller
already supplied one, e.g. a frontend that generated it for its own error
toast). The ID is bound into structlog context so every log line emitted
while handling the request carries it, and it's echoed back in the response
header and in every error body (see errors.py) so a user can hand us one ID
and we can find the exact log lines.
"""
import time
import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

REQUEST_ID_HEADER="X-Request-Id"

logger=structlog.get_logger("http")


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id=request.headers.get(REQUEST_ID_HEADER) or str(uuid.uuid4())
        request.state.request_id=request_id

        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        start=time.perf_counter()
        response=await call_next(request)
        duration_ms=(time.perf_counter()-start)*1000

        response.headers[REQUEST_ID_HEADER]=request_id
        logger.info(
            "request_handled",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=round(duration_ms, 2),
        )
        return response
