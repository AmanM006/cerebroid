"""GET /api/v1/studies/{id}/profile end to end, with small real model sets and a
temporary feature table (nothing here is a committed artifact)."""
import hashlib

import numpy as np
import pandas as pd
import pytest

from app.db.models import Study, StudyKind, StudyStatus
from app.domain.feature_store import load_feature_store
from app.domain.registry import load_registry
from tests.conftest import login
from tests.unit.test_registry import _meta, _train_set, _write_manifest, _write_marker
from tests.unit.test_registry_variants import FUSED, IMAGING, _config, _fit, _variant_meta


def _table(flip_labels: bool=False) -> pd.DataFrame:
    rng=np.random.default_rng(7)
    n=20
    labels=rng.integers(0, 2, n).astype(float)
    return pd.DataFrame({
        "patient_id": [f"UCSF-PDGM-{i:04d}" for i in range(n)],
        "split": ["test"]*n,
        "fold": [-1]*n,
        "age": np.linspace(25, 80, n),
        "sex": [i%2 for i in range(n)],
        "prior_biopsy": [np.nan if i%5==0 else float(i%2) for i in range(n)],
        "idh": 1-labels if flip_labels else labels,
        "codeletion_1p19q": labels,
        "mgmt": labels,
        "who_grade": [4.0]*n,
        "t1ce__et__glcm__Contrast": rng.normal(0, 1, n),
        "desc__enhancing_fraction": [np.nan if i==3 else v for i, v in enumerate(rng.uniform(0, 1, n))],
        "missing__ncr": [1.0 if i==3 else 0.0 for i in range(n)],
    })


@pytest.fixture
def deployed(tmp_path, client):
    """Deploys IDH (fused) and 1p19q (fused_given_idh) plus a feature table into the running app."""
    root=tmp_path/"artifacts"
    _write_marker(root, "models/idh", _train_set(), _meta())
    _write_marker(
        root, "models/codel_idh", _fit([*FUSED, "known__idh"], "known__idh"),
        _variant_meta("1p19q", "fused_given_idh", [*FUSED, "known__idh"], ["IDH"]),
    )
    _write_marker(root, "models/idh_imaging", _fit(IMAGING), _variant_meta("IDH", "imaging_only", IMAGING))
    _write_manifest(root)
    entries=[
        ("IDH", "fused", "models/idh"),
        ("IDH", "imaging_only", "models/idh_imaging"),
        ("1p19q", "fused_given_idh", "models/codel_idh"),
    ]
    config=_config(tmp_path, entries)
    (root/"features").mkdir()
    table_path=root/"features"/"features.parquet"
    _table().to_parquet(table_path)

    client.app.state.registry=load_registry(root, config)
    client.app.state.feature_store=load_feature_store(table_path)
    return {"root": root, "table": table_path, "tmp": tmp_path}


@pytest.fixture
def demo_study(db):
    def _make(patient_id: str="UCSF-PDGM-0002", age: int=30, prior_biopsy: bool | None=None) -> Study:
        study=Study(
            kind=StudyKind.DEMO, label=patient_id, age=age, sex="F",
            prior_biopsy=prior_biopsy, source_patient_id=patient_id, status=StudyStatus.READY,
        )
        db.add(study)
        db.commit()
        return study
    return _make


def _profile(client, headers, study_id, **params):
    return client.get(f"/api/v1/studies/{study_id}/profile", headers=headers, params=params)


def _marker(body, name):
    return next(m for m in body["markers"] if m["marker"]==name)


def test_profile_predicts_deployed_markers_and_reports_the_rest_unavailable(
    client, make_user, deployed, demo_study,
):
    make_user("alice")
    study=demo_study()
    response=_profile(client, login(client, "alice"), study.id)
    assert response.status_code==200, response.text
    body=response.json()

    idh=_marker(body, "IDH")
    assert idh["status"]=="predicted"
    assert idh["provenance"]=="model_inferred"
    assert idh["verdict"] in {"STABLE", "CONTESTED", "ARBITRARY"}
    assert idh["n_models"]==3
    assert idh["prob_min"]<=idh["prob_median"]<=idh["prob_max"]
    assert idh["evidence_ids"]==[]
    sha=hashlib.sha256((deployed["root"]/"models/idh/models.joblib").read_bytes()).hexdigest()
    assert idh["model_version"]=="sha256:"+sha
    assert body["model_versions"]["IDH"]=="sha256:"+sha
    assert idh["imaging_only_verdict"] in {"STABLE", "CONTESTED", "ARBITRARY"}
    assert isinstance(idh["resolved_by_combining"], bool)

    for name in ("1p19q", "MGMT", "GRADE"):
        marker=_marker(body, name)
        assert marker["status"]=="unavailable"
        assert marker["provenance"]=="missing"
        assert marker["call"] is None

    assert body["request_id"]==response.headers["X-Request-Id"]
    assert body["feature_pipeline_version"].startswith("sha256:")
    assert body["inputs"]["age"]=={"value": 30, "provenance": "clinical_input"}
    assert body["inputs"]["prior_biopsy"]=={"value": None, "provenance": "missing"}


def test_profile_is_reproducible(client, make_user, deployed, demo_study):
    make_user("alice")
    headers=login(client, "alice")
    study=demo_study()
    first=_profile(client, headers, study.id).json()
    second=_profile(client, headers, study.id).json()
    assert first["input_hash"]==second["input_hash"]
    assert _marker(first, "IDH")["prob_median"]==_marker(second, "IDH")["prob_median"]


def test_predictions_depend_on_the_patient(client, make_user, deployed, demo_study):
    make_user("alice")
    headers=login(client, "alice")
    young=demo_study("UCSF-PDGM-0002", age=25)
    old=demo_study("UCSF-PDGM-0017", age=80)
    p_young=_marker(_profile(client, headers, young.id).json(), "IDH")["prob_median"]
    p_old=_marker(_profile(client, headers, old.id).json(), "IDH")["prob_median"]
    assert p_young!=p_old


def test_lab_labels_in_the_feature_table_never_reach_the_models(client, make_user, deployed, demo_study):
    make_user("alice")
    headers=login(client, "alice")
    study=demo_study()
    before=_profile(client, headers, study.id).json()

    flipped=deployed["tmp"]/"flipped.parquet"
    _table(flip_labels=True).to_parquet(flipped)
    client.app.state.feature_store=load_feature_store(flipped)
    after=_profile(client, headers, study.id).json()

    assert _marker(before, "IDH")["prob_median"]==_marker(after, "IDH")["prob_median"]
    assert before["input_hash"]==after["input_hash"]


def test_known_result_is_shown_not_predicted_and_selects_the_conditional_set(
    client, make_user, deployed, demo_study,
):
    make_user("alice")
    study=demo_study()
    body=_profile(client, login(client, "alice"), study.id, known="IDH:1").json()

    idh=_marker(body, "IDH")
    assert idh["status"]=="known"
    assert idh["call"]=="mutant"
    assert idh["provenance"]=="clinical_input"

    codel=_marker(body, "1p19q")
    assert codel["status"]=="predicted"
    assert codel["variant"]=="fused_given_idh"
    assert body["inputs"]["known_markers"]==[
        {"marker": "IDH", "value": {"value": "mutant", "provenance": "clinical_input"}},
    ]


def test_missing_inputs_are_reported(client, make_user, deployed, demo_study):
    make_user("alice")
    study=demo_study("UCSF-PDGM-0003")
    body=_profile(client, login(client, "alice"), study.id).json()
    assert body["missing_inputs"]==["ncr"]
    assert _marker(body, "IDH")["status"]=="predicted"


@pytest.mark.parametrize("known", ["IDH:2", "IDH", "who_grade:1", "IDH:1&MGMT:0"])
def test_invalid_known_values_are_rejected(client, make_user, deployed, demo_study, known):
    make_user("alice")
    study=demo_study()
    response=_profile(client, login(client, "alice"), study.id, known=known)
    assert response.status_code==422
    assert response.json()["error_code"]=="INVALID_KNOWN_MARKER"


def test_duplicate_known_marker_is_rejected(client, make_user, deployed, demo_study):
    make_user("alice")
    study=demo_study()
    response=client.get(
        f"/api/v1/studies/{study.id}/profile?known=IDH:1&known=IDH:0", headers=login(client, "alice"),
    )
    assert response.status_code==422


def test_study_without_features_is_a_clear_conflict(client, make_user, make_study, deployed):
    make_user("alice")
    study=make_study(StudyKind.DEMO, label="no-features")
    response=_profile(client, login(client, "alice"), study.id)
    assert response.status_code==409
    assert response.json()["error_code"]=="FEATURES_NOT_READY"


def test_other_users_study_profile_is_not_found(client, make_user, make_study, deployed):
    make_user("alice")
    bob=make_user("bob")
    upload=make_study(StudyKind.UPLOAD, owner=bob, label="bob-1")
    assert _profile(client, login(client, "alice"), upload.id).status_code==404


def test_profile_requires_authentication(client, deployed, demo_study):
    study=demo_study()
    assert client.get(f"/api/v1/studies/{study.id}/profile").status_code==401


def test_reveal_shows_dataset_labels_as_measured(client, make_user, deployed, demo_study):
    make_user("alice")
    study=demo_study("UCSF-PDGM-0002")
    response=client.get(f"/api/v1/studies/{study.id}/reveal", headers=login(client, "alice"))
    assert response.status_code==200
    results={r["marker"]: r["value"] for r in response.json()["results"]}
    expected="mutant" if _table().loc[2, "idh"]==1 else "wildtype"
    assert results["IDH"]=={"value": expected, "provenance": "measured"}
    assert results["GRADE"]=={"value": "grade 4", "provenance": "measured"}


def test_reveal_is_refused_for_uploads_and_hidden_across_users(client, make_user, make_study, deployed):
    alice=make_user("alice")
    bob=make_user("bob")
    own=make_study(StudyKind.UPLOAD, owner=alice, label="alice-1")
    foreign=make_study(StudyKind.UPLOAD, owner=bob, label="bob-1")
    headers=login(client, "alice")
    own_reveal=client.get(f"/api/v1/studies/{own.id}/reveal", headers=headers)
    assert own_reveal.json()["error_code"]=="NO_GROUND_TRUTH"
    assert client.get(f"/api/v1/studies/{foreign.id}/reveal", headers=headers).status_code==404
