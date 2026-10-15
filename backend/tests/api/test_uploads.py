"""Uploading a study: validation, background processing in the worker process, access and deletion.

Volumes are small synthetic NIfTI files (a skull-stripped "brain" with a three-label tumor), so the
real worker, extractor and model sets run end to end."""
import gzip
import io
import time

import numpy as np
import pytest
import SimpleITK as sitk

from app.db.models import Role
from tests.api.test_profile import deployed  # noqa: F401  (fixture: small real model sets)
from tests.conftest import login

SIZE=40


def _nifti(array: np.ndarray, spacing=(1.0, 1.0, 1.0)) -> bytes:
    import tempfile
    from pathlib import Path
    image=sitk.GetImageFromArray(array)
    image.SetSpacing(spacing)
    with tempfile.TemporaryDirectory() as d:
        path=Path(d)/"v.nii.gz"
        sitk.WriteImage(image, str(path), True)
        return path.read_bytes()


def _study(skull=False, labels=(1, 2, 4), seg_size=SIZE) -> dict[str, bytes]:
    rng=np.random.default_rng(0)
    brain=np.zeros((SIZE, SIZE, SIZE), dtype=np.float32)
    brain[6:-6, 6:-6, 6:-6]=rng.normal(100, 10, (SIZE-12,)*3)
    if skull:
        brain[brain==0]=rng.normal(40, 5, int((brain==0).sum()))
    seg=np.zeros((seg_size,)*3, dtype=np.uint8)
    seg[12:28, 12:28, 12:28]=labels[1]
    seg[16:24, 16:24, 16:24]=labels[2]
    seg[19:21, 19:21, 19:21]=labels[0]
    files={name: _nifti(brain*(1+0.1*i)) for i, name in enumerate(("t1", "t1c", "t2", "flair"))}
    files["seg"]=_nifti(seg)
    return files


def _post(client, headers, files, age="45", sex="F"):
    return client.post(
        "/api/v1/studies", headers=headers, data={"age": age, "sex": sex},
        files={k: (f"{k}.nii.gz", io.BytesIO(v), "application/gzip") for k, v in files.items()},
    )


def _wait(client, headers, study_id, timeout=90):
    deadline=time.time()+timeout
    while time.time()<deadline:
        body=client.get(f"/api/v1/studies/{study_id}/status", headers=headers).json()
        if body["status"]!="processing":
            return body
        time.sleep(0.5)
    raise AssertionError("upload did not finish")


def test_upload_is_processed_and_analysed_like_a_demo_case(client, make_user, deployed):  # noqa: F811
    make_user("alice")
    headers=login(client, "alice")
    r=_post(client, headers, _study())
    assert r.status_code==202, r.text
    study_id=r.json()["study_id"]
    assert _wait(client, headers, study_id)["status"]=="ready"

    profile=client.get(f"/api/v1/studies/{study_id}/profile", headers=headers)
    assert profile.status_code==200
    assert any(m["status"]=="predicted" for m in profile.json()["markers"])
    volumes=client.get(f"/api/v1/studies/{study_id}/volumes", headers=headers).json()["sequences"]
    assert set(volumes)=={"t1", "t1c", "t2", "flair", "seg"}
    assert client.get(f"/api/v1/studies/{study_id}/volume/flair", headers=headers).status_code==200
    cases=client.get("/api/v1/cases", headers=headers).json()["items"]
    assert any(c["id"]==study_id and c["kind"]=="upload" for c in cases)

    make_user("bob")
    bob=login(client, "bob")
    assert client.get(f"/api/v1/studies/{study_id}/profile", headers=bob).status_code==404
    assert client.delete(f"/api/v1/studies/{study_id}", headers=bob).status_code==404

    assert client.delete(f"/api/v1/studies/{study_id}", headers=headers).status_code==204
    assert client.get(f"/api/v1/studies/{study_id}/status", headers=headers).status_code==404


@pytest.mark.parametrize(("files", "error_code"), [
    ({**_study(), "t2": b"not a nifti file at all"}, "NIFTI_INVALID"),
    (_study(labels=(1, 2, 3)), "MASK_INVALID"),
    (_study(skull=True), "NOT_SKULL_STRIPPED"),
    (_study(seg_size=SIZE-2), "NIFTI_SHAPE_MISMATCH"),
])
def test_bad_uploads_fail_with_a_clear_error(client, make_user, deployed, files, error_code):  # noqa: F811
    make_user("alice")
    headers=login(client, "alice")
    r=_post(client, headers, files)
    assert r.status_code==202, r.text
    status=_wait(client, headers, r.json()["study_id"])
    assert status["status"]=="failed" and status["error_code"]==error_code


def test_gzip_bomb_is_stopped_while_decompressing(client, make_user, deployed):  # noqa: F811
    make_user("alice")
    headers=login(client, "alice")
    bomb=gzip.compress(b"\0"*170_000_000, compresslevel=9)
    r=_post(client, headers, {**_study(), "t1": bomb})
    status=_wait(client, headers, r.json()["study_id"])
    assert status["error_code"]=="UPLOAD_TOO_LARGE"


def test_upload_rules(client, make_user, deployed):  # noqa: F811
    make_user("alice")
    make_user("rita", role=Role.REVIEWER)
    headers=login(client, "alice")
    assert _post(client, headers, _study(), age="12").status_code==422
    assert _post(client, headers, _study(), sex="X").status_code==422
    assert _post(client, login(client, "rita"), _study()).status_code==403
    assert client.post("/api/v1/studies", data={"age": "40", "sex": "M"}).status_code==401


def test_upload_label_and_entered_lab_results_are_shown_on_reveal(client, make_user, deployed):  # noqa: F811
    make_user("alice")
    headers=login(client, "alice")
    files=_study()
    r=client.post(
        "/api/v1/studies", headers=headers,
        data={"age": "41", "sex": "F", "label": "Case A - TCGA 289", "lab_idh": "mutant", "lab_grade": "2"},
        files={k: (f"{k}.nii.gz", io.BytesIO(v), "application/gzip") for k, v in files.items()},
    )
    assert r.status_code==202, r.text
    study_id=r.json()["study_id"]
    assert _wait(client, headers, study_id)["status"]=="ready"
    case=client.get(f"/api/v1/cases/{study_id}", headers=headers).json()
    assert case["label"]=="Case A - TCGA 289"
    revealed=client.get(f"/api/v1/studies/{study_id}/reveal", headers=headers).json()["results"]
    reveal={x["marker"]: x for x in revealed}
    assert reveal["IDH"]["value"]=={"value": "mutant", "provenance": "clinical_input"}
    assert reveal["GRADE"]["value"]["value"]=="grade 2-3" and reveal["GRADE"]["detail"]=="WHO grade 2"
    assert reveal["MGMT"]["value"]["provenance"]=="missing"
    # The entered results never reach the models: the profile has no known markers.
    profile=client.get(f"/api/v1/studies/{study_id}/profile", headers=headers).json()
    assert all(m["status"]!="known" for m in profile["markers"])


def test_upload_label_rejects_markup(client, make_user, deployed):  # noqa: F811
    make_user("alice")
    r=client.post(
        "/api/v1/studies", headers=login(client, "alice"),
        data={"age": "41", "sex": "F", "label": "<script>"},
        files={k: (f"{k}.nii.gz", io.BytesIO(v), "application/gzip") for k, v in _study().items()},
    )
    assert r.status_code==422
