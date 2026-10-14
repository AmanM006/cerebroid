"""Liveness and readiness endpoints.

/health: process is up. No dependencies checked — must always be fast and
cheap so an orchestrator doesn't kill a healthy-but-busy container.

/ready: process can serve real predictions: the database is reachable and
every configured marker's model set loaded, matched its sha256 in the
manifest, and passed a warm-up prediction at startup.
"""
import structlog
from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import get_engine
from app.domain.registry import MarkerRegistry

router=APIRouter(tags=["health"])
logger=structlog.get_logger("health")


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.get("/ready")
def ready(request: Request) -> JSONResponse:
    registry: MarkerRegistry | None=getattr(request.app.state, "registry", None)
    checks={
        "database": _check_database(),
        "models": registry is not None and registry.all_loaded,
    }
    all_ok=all(checks.values())
    return JSONResponse(
        status_code=status.HTTP_200_OK if all_ok else status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "status": "ready" if all_ok else "not_ready",
            "checks": checks,
            "markers": dict(registry.status) if registry else {},
        },
    )


def _check_database() -> bool:
    try:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except SQLAlchemyError:
        logger.warning("readiness_db_check_failed")
        return False
