"""Single-service hosting: the API serves the built frontend with SPA fallback,
never shadows API routes, never serves files outside the build, and every
response carries the security headers."""
import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import create_app


@pytest.fixture
def spa_client(tmp_path, monkeypatch):
    dist=tmp_path/"dist"
    (dist/"assets").mkdir(parents=True)
    (dist/"index.html").write_text("<html>app shell</html>")
    (dist/"assets"/"app.js").write_text("console.log(1)")
    (tmp_path/"secret.txt").write_text("outside the build")
    monkeypatch.setenv("FRONTEND_DIST", str(dist))
    get_settings.cache_clear()
    try:
        with TestClient(create_app()) as client:
            yield client
    finally:
        get_settings.cache_clear()


def test_client_side_routes_get_the_app_shell(spa_client):
    for path in ("/", "/login", "/cases/123"):
        r=spa_client.get(path)
        assert r.status_code==200 and "app shell" in r.text


def test_built_assets_are_served(spa_client):
    assert spa_client.get("/assets/app.js").text=="console.log(1)"


def test_api_paths_are_never_shadowed_by_the_app_shell(spa_client):
    assert spa_client.get("/health").json()=={"status": "ok"}
    r=spa_client.get("/api/v1/does-not-exist")
    assert r.status_code==404 and r.json()["error_code"]


@pytest.mark.parametrize("path", ["/../secret.txt", "/%2e%2e/secret.txt", "/assets/../../secret.txt"])
def test_files_outside_the_build_are_never_served(spa_client, path):
    assert "outside the build" not in spa_client.get(path).text


def test_every_response_has_security_headers(client):
    r=client.get("/health")
    assert "frame-ancestors 'none'" in r.headers["Content-Security-Policy"]
    assert r.headers["X-Frame-Options"]=="DENY"
    assert r.headers["X-Content-Type-Options"]=="nosniff"


@pytest.mark.parametrize("supplied", ["bad id\nwith newline", "x"*200, "<script>"])
def test_unsafe_request_ids_are_replaced(client, supplied):
    r=client.get("/health", headers={"X-Request-Id": supplied})
    assert r.headers["X-Request-Id"]!=supplied
