"""Smoke tests for the liveness/readiness endpoints.

/health must never depend on external services. /ready is allowed to report
not_ready (503) when the database is unreachable -- that's correct behaviour,
not a test failure -- so we only assert the response *shape*, not that the DB
happens to be up in whatever environment runs this test.
"""


def test_health_is_always_ok(client):
    response=client.get("/health")
    assert response.status_code==200
    assert response.json()=={"status": "ok"}


def test_ready_reports_database_and_every_configured_marker(client):
    response=client.get("/ready")
    body=response.json()
    assert body["checks"]["database"] is True
    assert {"IDH", "1p19q", "MGMT", "GRADE"}<=set(body["markers"])
    if body["checks"]["models"]:
        assert response.status_code==200
    else:
        assert response.status_code==503
        assert body["status"]=="not_ready"


def test_request_id_is_echoed_back(client):
    response=client.get("/health", headers={"X-Request-Id": "test-fixed-id"})
    assert response.headers["X-Request-Id"]=="test-fixed-id"


def test_unknown_route_returns_structured_error_body(client):
    response=client.get("/this-route-does-not-exist")
    assert response.status_code==404
    body=response.json()
    assert set(body.keys())=={"error_code", "message", "request_id"}
