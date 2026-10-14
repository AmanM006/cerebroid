"""Hash-chained audit log: accesses are recorded, the chain verifies, and any
edit or deletion is detected. Only reviewers may run the check."""
import pytest
from sqlalchemy import text

from app.db.models import AuditEntry, Role
from app.services import audit
from tests.api.test_profile import deployed, demo_study  # noqa: F401  (fixtures)
from tests.conftest import login


def _verify(client, username="rita"):
    return client.get("/api/v1/audit/verify", headers=login(client, username))


@pytest.fixture
def reviewer(make_user):
    return make_user("rita", Role.REVIEWER)


def test_profile_reads_are_recorded_and_the_chain_verifies(
    client, db, make_user, reviewer, deployed, demo_study,  # noqa: F811
):
    make_user("alice")
    study=demo_study()
    headers=login(client, "alice")
    client.get(f"/api/v1/studies/{study.id}/profile", headers=headers)
    client.get(f"/api/v1/studies/{study.id}/evidence", params={"marker": "IDH"}, headers=headers)

    entries=db.query(AuditEntry).order_by(AuditEntry.seq).all()
    assert [e.action for e in entries]==["profile.read:fused", "evidence.read:IDH"]
    assert all(e.object_id==str(study.id) for e in entries)
    assert entries[0].model_version.startswith("sha256:")
    assert entries[1].prev_hash==entries[0].hash

    body=_verify(client).json()
    assert body=={"valid": True, "entries": 2, "first_invalid_seq": None, "head_hash": entries[1].hash}


def test_editing_an_entry_breaks_the_chain(client, db, reviewer):
    for action in ("a", "b", "c"):
        audit.record(db, reviewer.id, action, "obj")
    db.execute(text("UPDATE audit_log SET action='rewritten' WHERE seq=2"))
    db.commit()
    body=_verify(client).json()
    assert body["valid"] is False and body["first_invalid_seq"]==2


def test_deleting_an_entry_breaks_the_chain(client, db, reviewer):
    for action in ("a", "b", "c"):
        audit.record(db, reviewer.id, action, "obj")
    db.execute(text("DELETE FROM audit_log WHERE seq=2"))
    db.commit()
    body=_verify(client).json()
    assert body["valid"] is False and body["first_invalid_seq"]==3


def test_recomputing_a_hash_after_editing_is_still_detected(client, db, reviewer):
    """Rewriting one row and its own hash still breaks the next row's prev_hash link."""
    for action in ("a", "b", "c"):
        audit.record(db, reviewer.id, action, "obj")
    row=db.get(AuditEntry, 2)
    forged=audit._digest(
        row.seq, row.ts, row.actor_id, "forged", row.object_id, row.model_version, row.prev_hash,
    )
    db.execute(text("UPDATE audit_log SET action='forged', hash=:h WHERE seq=2"), {"h": forged})
    db.commit()
    body=_verify(client).json()
    assert body["valid"] is False and body["first_invalid_seq"]==3


def test_empty_log_is_valid(client, reviewer):
    body=_verify(client).json()
    assert body=={"valid": True, "entries": 0, "first_invalid_seq": None, "head_hash": audit.GENESIS}


def test_clinicians_cannot_run_the_check(client, make_user):
    make_user("alice")
    r=_verify(client, "alice")
    assert r.status_code==403
    assert r.json()["error_code"]=="FORBIDDEN"


def test_check_requires_authentication(client):
    assert client.get("/api/v1/audit/verify").status_code==401
