"""FastAPI application factory.

A factory function (rather than a module-level `app`) so tests can build a
fresh app per test if settings ever need overriding, without import-order
tricks. Model artifacts are loaded once at startup, not per request.
"""
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.api import audit, auth, cases, health, model_card, studies, uploads
from app.core.config import get_settings
from app.core.errors import not_found, register_exception_handlers
from app.core.logging import configure_logging
from app.core.middleware import BodySizeLimitMiddleware, RequestIDMiddleware
from app.domain.feature_store import load_feature_store
from app.domain.registry import load_registry
from app.domain.volume_store import VolumeStore
from app.services import uploads as uploads_service
from app.services import warmup


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings=get_settings()
    app.state.registry=load_registry(settings.artifacts_root, settings.markers_config_path)
    app.state.feature_store=load_feature_store(settings.feature_table_path)
    app.state.volume_store=VolumeStore(settings.volumes_root, settings.uploads_root)
    try:
        uploads_service.restore(app.state.feature_store)
    except Exception as exc:  # noqa: BLE001 - uploads must never stop the API starting
        logging.getLogger("uploads").warning("upload_restore_failed: %s", type(exc).__name__)
    if settings.seed_on_startup:
        # Demo cases and test accounts exist even on a host whose start command skips `app.cli seed`.
        try:
            from app.cli import seed
            seed()
        except Exception as exc:  # noqa: BLE001 - seeding must never stop the API starting
            logging.getLogger("startup").warning("startup_seed_failed: %s", type(exc).__name__)
    if settings.warmup_profiles:
        warmup.start(app.state.registry, app.state.feature_store)

    yield


def create_app() -> FastAPI:
    settings=get_settings()
    configure_logging(settings.log_level)

    # The interactive docs pages load scripts from a CDN and run inline script, which the CSP blocks;
    # loosening it would put third-party script on our origin. Production keeps /openapi.json only.
    docs=None if settings.is_production else "/docs"
    redoc=None if settings.is_production else "/redoc"
    app=FastAPI(title="Cerebroid API", version="0.1.0", lifespan=lifespan, docs_url=docs, redoc_url=redoc)

    # Added first so it runs inside RequestIDMiddleware: a 413 still gets the request ID and headers.
    app.add_middleware(
        BodySizeLimitMiddleware, max_body_bytes=settings.max_body_bytes,
        large_routes={("POST", uploads.UPLOAD_PATH): settings.upload_max_body_bytes},
    )
    app.add_middleware(RequestIDMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)

    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(cases.router)
    app.include_router(uploads.router)
    app.include_router(studies.router)
    app.include_router(audit.router)
    app.include_router(model_card.router)

    if settings.frontend_dist is not None and (settings.frontend_dist/"index.html").is_file():
        _serve_frontend(app, settings.frontend_dist)

    return app


_API_PREFIXES=("api", "health", "ready", "docs", "redoc", "openapi.json")


def _serve_frontend(app: FastAPI, dist: Path) -> None:
    """Serves the built single-page app; unknown paths get index.html so client-side routes work."""
    root=dist.resolve()
    app.mount("/assets", StaticFiles(directory=root/"assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def frontend(path: str) -> FileResponse:
        clean=path.strip("/")
        if clean=="api" or any(clean==p or clean.startswith(p+"/") for p in _API_PREFIXES):
            raise not_found()
        candidate=(root/path).resolve()
        if path and candidate.is_relative_to(root) and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(root/"index.html", headers={"Cache-Control": "no-cache"})


app=create_app()
