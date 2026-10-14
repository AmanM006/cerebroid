"""FastAPI application factory.

A factory function (rather than a module-level `app`) so tests can build a
fresh app per test if settings ever need overriding, without import-order
tricks.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, cases, health
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.core.middleware import RequestIDMiddleware


def create_app() -> FastAPI:
    settings=get_settings()
    configure_logging(settings.log_level)

    app=FastAPI(title="VBX API", version="0.1.0")

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

    return app


app=create_app()
