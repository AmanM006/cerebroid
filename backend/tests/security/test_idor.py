"""Object-level access control on cases (anti-IDOR).

A user sees public demo cases and their own uploads, nothing else. Another
user's case must be indistinguishable from a case that doesn't exist.
"""
import uuid

import pytest

from app.db.models import Role, StudyKind
from tests.conftest import login


@pytest.fixture
def two_users_and_cases(make_user, make_study):
    alice=make_user("alice")
    bob=make_user("bob")
    return {
        "demo": make_study(StudyKind.DEMO, label="demo-1"),
        "alice_upload": make_study(StudyKind.UPLOAD, owner=alice, label="alice-1"),
        "bob_upload": make_study(StudyKind.UPLOAD, owner=bob, label="bob-1"),
    }


def _get(client, headers, case_id):
    return client.get(f"/api/v1/cases/{case_id}", headers=headers)


def test_owner_can_open_own_upload(client, two_users_and_cases):
    response=_get(client, login(client, "alice"), two_users_and_cases["alice_upload"].id)
    assert response.status_code==200
    assert response.json()["label"]=="alice-1"


def test_anyone_signed_in_can_open_demo_case(client, two_users_and_cases):
    assert _get(client, login(client, "bob"), two_users_and_cases["demo"].id).status_code==200


def test_other_users_upload_looks_exactly_like_a_missing_case(client, two_users_and_cases):
    headers=login(client, "alice")
    foreign=_get(client, headers, two_users_and_cases["bob_upload"].id)
    missing=_get(client, headers, uuid.uuid4())

    assert foreign.status_code==missing.status_code==404
    foreign_body, missing_body=foreign.json(), missing.json()
    foreign_body.pop("request_id")
    missing_body.pop("request_id")
    assert foreign_body==missing_body


def test_reviewer_cannot_open_a_clinicians_upload(client, make_user, two_users_and_cases):
    make_user("rita", role=Role.REVIEWER)
    assert _get(client, login(client, "rita"), two_users_and_cases["alice_upload"].id).status_code==404


def test_list_shows_only_demo_and_own_cases(client, two_users_and_cases):
    response=client.get("/api/v1/cases", headers=login(client, "alice"))
    assert response.status_code==200
    labels={item["label"] for item in response.json()["items"]}
    assert labels=={"demo-1", "alice-1"}
    assert response.json()["total"]==2


def test_cases_require_authentication(client, two_users_and_cases):
    assert client.get("/api/v1/cases").status_code==401
    assert client.get(f"/api/v1/cases/{two_users_and_cases['demo'].id}").status_code==401


@pytest.mark.parametrize("bad_id", ["1", "not-a-uuid", "../../etc/passwd", "' OR 1=1 --"])
def test_malformed_case_ids_are_rejected(client, make_user, bad_id):
    make_user("alice")
    response=client.get(f"/api/v1/cases/{bad_id}", headers=login(client, "alice"))
    assert response.status_code in (404, 422)
    assert "Traceback" not in response.text


@pytest.mark.parametrize("params", [{"limit": 0}, {"limit": 1000}, {"offset": -1}])
def test_pagination_bounds_are_enforced(client, make_user, params):
    make_user("alice")
    assert client.get("/api/v1/cases", params=params, headers=login(client, "alice")).status_code==422


def test_case_values_carry_provenance(client, two_users_and_cases):
    response=_get(client, login(client, "alice"), two_users_and_cases["demo"].id)
    body=response.json()
    assert body["age"]=={"value": 55, "provenance": "clinical_input"}
    assert body["sex"]=={"value": "F", "provenance": "clinical_input"}
