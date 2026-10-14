"""Smoke tests for the liveness/readiness endpoints.

/health must never depend on external services. /ready is allowed to report
not_ready (503) when the database is unreachable -- that's correct behaviour,
not a test failure -- so we only assert the response *shape*, not that the DB
happens to be up in whatever environment runs this test.
"""
from fastapi.testclient import TestClient

from app.main import app

client=TestClient(app)


def test_health_is_always_ok():
    response=client.get("/health")
    assert response.status_code==200
    assert response.json()=={"status": "ok"}


def test_ready_reports_structured_status():
    response=client.get("/ready")
    assert response.status_code in (200, 503)
    body=response.json()
    assert body["status"] in ("ready", "not_ready")
    assert "database" in body["checks"]


def test_request_id_is_echoed_back():
    response=client.get("/health", headers={"X-Request-Id": "test-fixed-id"})
    assert response.headers["X-Request-Id"]=="test-fixed-id"


def test_unknown_route_returns_structured_error_body():
    response=client.get("/this-route-does-not-exist")
    assert response.status_code==404
    body=response.json()
    assert set(body.keys())=={"error_code", "message", "request_id"}
