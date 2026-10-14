"""Global error handling.

Every error response is {error_code, message, request_id} — nothing else.
This is a security requirement (§5 of CLAUDE.md): stack traces, SQL, file
paths and library versions must never reach a client, since peer teams will
be actively probing error responses during the Bug Bounty phase.

error_code values form a small stable taxonomy (documented in the README as
they're added) so the frontend and evaluators can branch on them instead of
parsing message text.
"""
import structlog
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger=structlog.get_logger("errors")


class AppError(Exception):
    """Base class for domain errors we raise intentionally.

    Any route can `raise AppError(error_code=..., message=..., status_code=...)`
    and get a consistent, safe error body for free.
    """

    def __init__(
        self,
        error_code: str,
        message: str,
        status_code: int=status.HTTP_400_BAD_REQUEST,
        headers: dict[str, str] | None=None,
    ):
        self.error_code=error_code
        self.message=message
        self.status_code=status_code
        self.headers=headers
        super().__init__(message)


def unauthorized(error_code: str="AUTH_INVALID_TOKEN", message: str="Authentication required.") -> AppError:
    return AppError(error_code, message, status.HTTP_401_UNAUTHORIZED, {"WWW-Authenticate": "Bearer"})


def not_found() -> AppError:
    # Same response whether the object doesn't exist or belongs to someone
    # else, so IDs of other users' studies can't be probed.
    return AppError("NOT_FOUND", "Resource not found.", status.HTTP_404_NOT_FOUND)


def _error_body(error_code: str, message: str, request: Request) -> dict:
    request_id=getattr(request.state, "request_id", None)
    return {"error_code": error_code, "message": message, "request_id": request_id}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(exc.error_code, exc.message, request),
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content=_error_body("VALIDATION_ERROR", "Request did not match the expected schema.", request),
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body("HTTP_ERROR", str(exc.detail), request),
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        request_id=getattr(request.state, "request_id", None)
        logger.error("unhandled_exception", request_id=request_id, exc_info=exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_error_body("INTERNAL_ERROR", "An unexpected error occurred.", request),
        )
