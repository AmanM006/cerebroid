"""Liveness and readiness endpoints.

/health: process is up. No dependencies checked — must always be fast and
cheap so an orchestrator doesn't kill a healthy-but-busy container.

/ready: process can actually serve traffic. At this layer that means "can
reach the database". Later layers extend this to also check that model
artifacts are loaded and match the manifest (see CLAUDE.md §7) — deliberately
not claimed here since those artifacts don't exist yet.
"""
import structlog
from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import get_settings

router=APIRouter(tags=["health"])
logger=structlog.get_logger("health")


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.get("/ready")
def ready() -> JSONResponse:
    checks={"database": _check_database()}
    all_ok=all(checks.values())
    return JSONResponse(
        status_code=status.HTTP_200_OK if all_ok else status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"status": "ready" if all_ok else "not_ready", "checks": checks},
    )


def _check_database() -> bool:
    settings=get_settings()
    try:
        engine=create_engine(settings.database_url, pool_pre_ping=True)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except SQLAlchemyError:
        logger.warning("readiness_db_check_failed")
        return False
