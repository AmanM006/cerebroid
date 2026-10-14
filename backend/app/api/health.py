"""Liveness and readiness endpoints.

/health: process is up. No dependencies checked — must always be fast and
cheap so an orchestrator doesn't kill a healthy-but-busy container.

/ready: process can actually serve traffic, i.e. the database is reachable.
Model-artifact checks (CLAUDE.md §7) are added alongside the artifacts.
"""
import structlog
from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import get_engine

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
    try:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except SQLAlchemyError:
        logger.warning("readiness_db_check_failed")
        return False
