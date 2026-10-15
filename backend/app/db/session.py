"""One engine and session factory for the whole process.

Creating engines per request leaks connection pools; everything (routes,
/ready, scripts) goes through get_engine() / get_db() instead.
"""
from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings


@lru_cache
def get_engine() -> Engine:
    url=get_settings().database_url
    if url.startswith("sqlite"):
        # Fallback on a host without Postgres: requests run on a thread pool and uploads finish on a
        # background thread, so connections must be shareable across threads; wait on write locks.
        return create_engine(
            url, pool_pre_ping=True, connect_args={"check_same_thread": False, "timeout": 15},
        )
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        pool_timeout=5,
    )


@lru_cache
def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one session per request, always closed."""
    session=get_session_factory()()
    try:
        yield session
    finally:
        session.close()
