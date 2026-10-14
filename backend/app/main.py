"""FastAPI application factory.

A factory function (rather than a module-level `app`) so tests can build a
fresh app per test if settings ever need overriding, without import-order
tricks. Model artifacts are loaded once at startup, not per request.
"""
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, cases, health, studies
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.core.middleware import RequestIDMiddleware
from app.domain.feature_store import load_feature_store
from app.domain.registry import load_registry


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings=get_settings()
    app.state.registry=load_registry(settings.artifacts_root, settings.markers_config_path)
    app.state.feature_store=load_feature_store(settings.feature_table_path)
    yield


def create_app() -> FastAPI:
    settings=get_settings()
    configure_logging(settings.log_level)

    app=FastAPI(title="VBX API", version="0.1.0", lifespan=lifespan)

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
    app.include_router(studies.router)

    return app


app=create_app()
