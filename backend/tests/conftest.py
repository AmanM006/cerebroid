"""Test setup: a dedicated <db>_test Postgres database, built by the real
Alembic migrations (so migrations are tested too) and truncated after every
test. Environment variables are set here, before any app module is imported,
because settings and the engine are cached on first use.
"""
import os
import secrets
import tempfile
from pathlib import Path

from sqlalchemy.engine import make_url

_base_url=make_url(os.environ.get("DATABASE_URL", "postgresql+psycopg://vbx:vbx@localhost:5432/vbx"))
TEST_DB_URL=_base_url.set(database=f"{_base_url.database}_test")
os.environ["DATABASE_URL"]=TEST_DB_URL.render_as_string(hide_password=False)
os.environ["JWT_SECRET_KEY"]=secrets.token_urlsafe(48)
os.environ["APP_ENV"]="test"
os.environ["WARMUP_PROFILES"]="false"
os.environ["SEED_ON_STARTUP"]="false"
os.environ["UPLOAD_DIR"]=tempfile.mkdtemp(prefix="cerebroid-test-uploads-")
os.environ["LOGIN_RATE_LIMIT"]="100000"  # tests log in constantly; the limits have their own tests
os.environ["ANALYSIS_RATE_LIMIT"]="100000"

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.db.models import Role, Study, StudyKind, StudyStatus, User  # noqa: E402
from app.db.session import get_engine, get_session_factory  # noqa: E402
from app.main import app  # noqa: E402

TEST_PASSWORD="correct-horse-battery-staple"


@pytest.fixture(scope="session", autouse=True)
def _test_database():
    assert TEST_DB_URL.database and TEST_DB_URL.database.endswith("_test")

    admin=create_engine(_base_url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        exists=conn.scalar(text("SELECT 1 FROM pg_database WHERE datname=:n"), {"n": TEST_DB_URL.database})
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{TEST_DB_URL.database}"'))
    admin.dispose()

    with get_engine().begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    command.upgrade(Config(str(Path(__file__).resolve().parents[1]/"alembic.ini")), "head")
    yield
    get_engine().dispose()


@pytest.fixture(autouse=True)
def _clean_tables():
    yield
    with get_engine().begin() as conn:
        conn.execute(text("TRUNCATE audit_log, refresh_tokens, studies, users CASCADE"))


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def db():
    with get_session_factory()() as session:
        yield session


@pytest.fixture
def make_user(db):
    def _make(username: str, role: Role=Role.CLINICIAN, password: str=TEST_PASSWORD) -> User:
        user=User(username=username, password_hash=hash_password(password), role=role)
        db.add(user)
        db.commit()
        return user
    return _make


@pytest.fixture
def make_study(db):
    def _make(kind: StudyKind=StudyKind.DEMO, owner: User | None=None, label: str="case") -> Study:
        study=Study(
            kind=kind,
            owner_id=owner.id if owner else None,
            label=label,
            age=55,
            sex="F",
            status=StudyStatus.READY,
        )
        db.add(study)
        db.commit()
        return study
    return _make


def login(client: TestClient, username: str, password: str=TEST_PASSWORD) -> dict[str, str]:
    """Logs in and returns Authorization headers. The refresh cookie stays on the client."""
    response=client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert response.status_code==200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}
