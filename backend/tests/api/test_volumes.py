"""GET /api/v1/studies/{id}/volumes and /volume/{sequence}: listing, streaming,
access control and refusal of anything outside the fixed sequence list."""
import gzip

import pytest

from app.db.models import Role, StudyKind
from app.domain.volume_store import VolumeStore
from tests.conftest import login

PATIENT="UCSF-PDGM-0042"
BYTES=gzip.compress(b"not a real volume, only bytes to stream back")


@pytest.fixture
def volume_root(tmp_path, client):
    patient_dir=tmp_path/"volumes"/PATIENT
    patient_dir.mkdir(parents=True)
    (patient_dir/"t1c.nii.gz").write_bytes(BYTES)
    (patient_dir/"seg.nii.gz").write_bytes(BYTES)
    (tmp_path/"secret.txt").write_text("outside the volume root")
    client.app.state.volume_store=VolumeStore(tmp_path/"volumes")
    return tmp_path


def _study(db, make_study, kind=StudyKind.DEMO, owner=None, patient=PATIENT):
    study=make_study(kind=kind, owner=owner)
    study.source_patient_id=patient
    db.commit()
    return study


def test_lists_only_volumes_that_exist(client, db, make_user, make_study, volume_root):
    make_user("alice")
    study=_study(db, make_study)
    r=client.get(f"/api/v1/studies/{study.id}/volumes", headers=login(client, "alice"))
    assert r.status_code==200
    assert r.json()["sequences"]==["t1c", "seg"]


def test_streams_volume_bytes(client, db, make_user, make_study, volume_root):
    make_user("alice")
    study=_study(db, make_study)
    r=client.get(f"/api/v1/studies/{study.id}/volume/t1c", headers=login(client, "alice"))
    assert r.status_code==200
    assert r.content==BYTES
    assert r.headers["content-type"]=="application/gzip"
    assert PATIENT not in r.headers.get("content-disposition", "")


def test_missing_sequence_is_404(client, db, make_user, make_study, volume_root):
    make_user("alice")
    study=_study(db, make_study)
    r=client.get(f"/api/v1/studies/{study.id}/volume/flair", headers=login(client, "alice"))
    assert r.status_code==404
    assert r.json()["error_code"]=="VOLUME_NOT_AVAILABLE"


@pytest.mark.parametrize("sequence", ["..%2Fsecret.txt", "secret", "T1C", "t1c.nii.gz"])
def test_unknown_sequence_is_rejected(client, db, make_user, make_study, volume_root, sequence):
    make_user("alice")
    study=_study(db, make_study)
    r=client.get(f"/api/v1/studies/{study.id}/volume/{sequence}", headers=login(client, "alice"))
    assert r.status_code in (404, 422)
    assert b"outside the volume root" not in r.content


def test_malformed_patient_id_never_reaches_the_filesystem(client, db, make_user, make_study, volume_root):
    make_user("alice")
    study=_study(db, make_study, patient="../volumes/"+PATIENT)
    headers=login(client, "alice")
    assert client.get(f"/api/v1/studies/{study.id}/volumes", headers=headers).json()["sequences"]==[]
    assert client.get(f"/api/v1/studies/{study.id}/volume/t1c", headers=headers).status_code==404


def test_requires_auth(client, db, make_study, volume_root):
    study=_study(db, make_study)
    assert client.get(f"/api/v1/studies/{study.id}/volume/t1c").status_code==401


def test_foreign_upload_volume_is_hidden(client, db, make_user, make_study, volume_root):
    owner=make_user("owner", Role.CLINICIAN)
    make_user("mallory")
    study=_study(db, make_study, kind=StudyKind.UPLOAD, owner=owner)
    headers=login(client, "mallory")
    assert client.get(f"/api/v1/studies/{study.id}/volume/t1c", headers=headers).status_code==404
    assert client.get(f"/api/v1/studies/{study.id}/volumes", headers=headers).status_code==404
