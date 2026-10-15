"""GET /api/v1/studies/{id}/profile end to end, with small real model sets and a
temporary feature table (nothing here is a committed artifact)."""
import hashlib
import uuid

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


def test_low_signal_set_is_flagged_instead_of_trusted(tmp_path, client, make_user, demo_study):
    """A set no better than the base rate is reported as low_signal, never resolved by combining."""
    root=tmp_path/"artifacts"
    _write_marker(root, "models/idh", _train_set(), _meta(baseline_log_loss=0.505))
    _write_manifest(root)
    (root/"features").mkdir()
    table_path=root/"features"/"features.parquet"
    _table().to_parquet(table_path)
    client.app.state.registry=load_registry(root, _config(tmp_path, [("IDH", "fused", "models/idh")]))
    client.app.state.feature_store=load_feature_store(table_path)

    make_user("alice")
    study=demo_study()
    r=client.get(f"/api/v1/studies/{study.id}/profile", headers=login(client, "alice"))
    idh=next(m for m in r.json()["markers"] if m["marker"]=="IDH")
    assert idh["low_signal"] is True
    assert idh["skill"]==pytest.approx(1-0.5/0.505, abs=1e-4)
    assert idh["resolved_by_combining"] is False


def test_evidence_explains_the_same_set_as_the_profile(client, make_user, deployed, demo_study):
    make_user("alice")
    study=demo_study()
    headers=login(client, "alice")
    profile=client.get(f"/api/v1/studies/{study.id}/profile", headers=headers).json()
    idh=next(m for m in profile["markers"] if m["marker"]=="IDH")

    r=client.get(f"/api/v1/studies/{study.id}/evidence", params={"marker": "IDH"}, headers=headers)
    assert r.status_code==200
    body=r.json()
    assert body["call"]==idh["call"] and body["model_version"]==idh["model_version"]
    assert body["reference"]["provenance"]=="reference_cohort"
    assert body["items"], "a patient that differs from the cohort median has at least one effect"
    weights=[i["weight"] for i in body["items"]]
    assert weights==sorted(weights, reverse=True)
    for item in body["items"]:
        assert item["provenance"]=="model_inferred"
        assert item["supports_call"]==((item["direction"]=="toward_positive")==(body["call"]=="mutant"))


def test_evidence_for_a_known_marker_is_refused(client, make_user, deployed, demo_study):
    make_user("alice")
    study=demo_study()
    r=client.get(
        f"/api/v1/studies/{study.id}/evidence", params={"marker": "IDH", "known": "IDH:1"},
        headers=login(client, "alice"),
    )
    assert r.status_code==409
    assert r.json()["error_code"]=="MARKER_ALREADY_KNOWN"


def test_evidence_for_an_undeployed_marker_is_a_clear_conflict(client, make_user, deployed, demo_study):
    make_user("alice")
    study=demo_study()
    url=f"/api/v1/studies/{study.id}/evidence"
    r=client.get(url, params={"marker": "MGMT"}, headers=login(client, "alice"))
    assert r.status_code==409
    assert r.json()["error_code"]=="MODEL_NOT_AVAILABLE"


def test_other_users_study_evidence_is_not_found(client, make_user, make_study, deployed):
    owner=make_user("owner")
    make_user("mallory")
    study=make_study(kind=StudyKind.UPLOAD, owner=owner)
    url=f"/api/v1/studies/{study.id}/evidence"
    r=client.get(url, params={"marker": "IDH"}, headers=login(client, "mallory"))
    assert r.status_code==404


def test_doubt_breaks_down_the_same_call_as_the_profile(client, make_user, deployed, demo_study):
    make_user("alice")
    study=demo_study()
    headers=login(client, "alice")
    profile=client.get(f"/api/v1/studies/{study.id}/profile", headers=headers).json()
    idh=next(m for m in profile["markers"] if m["marker"]=="IDH")

    r=client.get(f"/api/v1/studies/{study.id}/doubt", params={"marker": "IDH"}, headers=headers)
    assert r.status_code==200
    body=r.json()
    assert body["call"]==idh["call"] and body["verdict"]==idh["verdict"]
    sources={c["source"] for c in body["components"]}
    assert sources=={"multiplicity", "ambiguity", "data_sparsity", "missing_inputs", "model_skill"}
    assert all(c["provenance"] for c in body["components"])
    assert body["recommended_action"]


def test_other_users_study_doubt_is_not_found(client, make_user, make_study, deployed):
    owner=make_user("owner")
    make_user("mallory")
    study=make_study(kind=StudyKind.UPLOAD, owner=owner)
    url=f"/api/v1/studies/{study.id}/doubt"
    assert client.get(url, params={"marker": "IDH"}, headers=login(client, "mallory")).status_code==404


def test_imaging_only_view_rescores_with_the_context_blind_set(client, make_user, deployed, demo_study):
    make_user("alice")
    study=demo_study()
    headers=login(client, "alice")
    r=client.get(f"/api/v1/studies/{study.id}/profile", params={"view": "imaging_only"}, headers=headers)
    assert r.status_code==200
    body=r.json()
    assert body["view"]=="imaging_only"
    markers={m["marker"]: m for m in body["markers"]}
    assert markers["IDH"]["status"]=="predicted" and markers["IDH"]["variant"]=="imaging_only"
    assert markers["IDH"]["resolved_by_combining"] is False
    assert markers["1p19q"]["status"]=="unavailable"
    assert markers["1p19q"]["reason"]=="imaging-only model set not deployed"


def test_clinical_only_view_never_falls_back_to_another_set(client, make_user, deployed, demo_study):
    make_user("alice")
    study=demo_study()
    url=f"/api/v1/studies/{study.id}/profile"
    r=client.get(url, params={"view": "clinical_only"}, headers=login(client, "alice"))
    assert all(m["status"]=="unavailable" for m in r.json()["markers"])


def test_unknown_view_is_rejected(client, make_user, deployed, demo_study):
    make_user("alice")
    study=demo_study()
    url=f"/api/v1/studies/{study.id}/profile"
    r=client.get(url, params={"view": "everything"}, headers=login(client, "alice"))
    assert r.status_code==422


def test_tipping_sweeps_age_for_the_same_call_as_the_profile(client, make_user, deployed, demo_study):
    make_user("alice")
    study=demo_study()
    headers=login(client, "alice")
    r=client.get(f"/api/v1/studies/{study.id}/tipping", params={"marker": "IDH"}, headers=headers)
    assert r.status_code==200
    body=r.json()
    age=next(i for i in body["items"] if i["input"]=="age")
    assert age["current"]==30 and age["provenance"]=="model_inferred"
    assert len(age["curve"])==83
    assert all(0<=p["positive_fraction"]<=1 for p in age["curve"])
    if age["flip_at"] is not None:
        assert age["flips_to"]!=body["call"]


def test_other_users_study_tipping_is_not_found(client, make_user, make_study, deployed):
    owner=make_user("owner")
    make_user("mallory")
    study=make_study(kind=StudyKind.UPLOAD, owner=owner)
    url=f"/api/v1/studies/{study.id}/tipping"
    assert client.get(url, params={"marker": "IDH"}, headers=login(client, "mallory")).status_code==404


def test_falsification_links_every_claim_to_evidence(client, make_user, deployed, demo_study):
    make_user("alice")
    study=demo_study()
    headers=login(client, "alice")
    r=client.get(f"/api/v1/studies/{study.id}/falsification", params={"marker": "IDH"}, headers=headers)
    assert r.status_code==200
    body=r.json()
    url=f"/api/v1/studies/{study.id}/evidence"
    evidence=client.get(url, params={"marker": "IDH"}, headers=headers).json()
    known_ids={i["evidence_id"] for i in evidence["items"]}
    claims=body["supporting"]+body["contradicting"]
    assert claims, "a patient unlike the cohort median has evidence on at least one side"
    for claim in claims:
        assert claim["evidence_ids"] and set(claim["evidence_ids"])<=known_ids
        assert claim["provenance"]=="model_inferred"
    assert body["competing"]["evidence_ids"]==["IDH:fused:set"]
    other="wildtype" if body["call"]=="mutant" else "mutant"
    assert other in body["competing"]["text"]
    for claim in body["overturn"]:
        assert claim["evidence_ids"][0].startswith("IDH:fused:tipping:")
    assert "IDH1" in body["confirmatory_test"]


def test_other_users_study_falsification_is_not_found(client, make_user, make_study, deployed):
    owner=make_user("owner")
    make_user("mallory")
    study=make_study(kind=StudyKind.UPLOAD, owner=owner)
    url=f"/api/v1/studies/{study.id}/falsification"
    assert client.get(url, params={"marker": "IDH"}, headers=login(client, "mallory")).status_code==404


def test_every_model_response_carries_the_same_input_hash(client, make_user, deployed, demo_study):
    make_user("alice")
    study=demo_study()
    headers=login(client, "alice")
    base=f"/api/v1/studies/{study.id}"
    expected=client.get(f"{base}/profile", headers=headers).json()["input_hash"]
    for path in ("evidence", "doubt", "tipping", "falsification"):
        body=client.get(f"{base}/{path}", params={"marker": "IDH"}, headers=headers).json()
        assert body["input_hash"]==expected, path


def test_model_card_describes_each_deployed_set(client, make_user, deployed):
    make_user("alice")
    r=client.get("/api/v1/model-card", headers=login(client, "alice"))
    assert r.status_code==200
    body=r.json()
    assert "Not a diagnostic device" in body["disclaimer"]
    assert body["limitations"]
    sets={(s["marker"], s["variant"]): s for s in body["model_sets"]}
    assert set(sets)=={("IDH", "fused"), ("IDH", "imaging_only"), ("1p19q", "fused_given_idh")}
    idh=sets[("IDH", "fused")]
    assert idh["n_models"]==3 and idh["model_version"].startswith("sha256:")
    # Held-out numbers belong to the committed model files, never to these test models.
    assert idh["held_out"] is None


def test_model_card_requires_authentication(client, deployed):
    assert client.get("/api/v1/model-card").status_code==401


def test_next_measurements_is_labelled_a_heuristic(client, make_user, deployed, demo_study):
    make_user("alice")
    study=demo_study()
    headers=login(client, "alice")
    r=client.get(f"/api/v1/studies/{study.id}/next-measurements", params={"known": "IDH:1"}, headers=headers)
    assert r.status_code==200
    body=r.json()
    assert body["label"]=="decision-support heuristic"
    idh=next(s for s in body["marker_states"] if s["marker"]=="IDH")
    assert idh["from_lab"] and idh["provenance"]=="clinical_input"
    assert "Glioblastoma, IDH-wildtype" not in body["candidate_categories"]
    assert all(t["marker"]!="IDH" for t in body["tests"])


def test_next_measurements_carry_guideline_pathways(client, make_user, deployed, demo_study):
    make_user("alice")
    study=demo_study()
    r=client.get(f"/api/v1/studies/{study.id}/next-measurements", headers=login(client, "alice"))
    body=r.json()
    assert [p["category"] for p in body["pathways"]]==body["candidate_categories"]
    assert all(p["steps"] for p in body["pathways"])
    assert "not a treatment recommendation" in body["pathway_label"]
    assert body["next_step"]["kind"] in {"decide_type", "decide_treatment", "confirm", "review"}
    assert body["pathway_basis"]


def test_metrics_summary_is_public_and_only_reports_deployed_models(client, deployed, demo_study):
    demo_study()
    r=client.get("/api/v1/metrics/summary")
    assert r.status_code==200
    body=r.json()
    assert body["demo_cases"]==1
    # The committed heldout.json belongs to the real model files, not these test models: nothing shown.
    assert body["sets"]==[]


def test_lime_explains_the_call_with_provenance_and_region_map(client, make_user, deployed, demo_study):
    make_user("alice")
    study=demo_study()
    r=client.get(f"/api/v1/studies/{study.id}/lime", params={"marker": "IDH"}, headers=login(client, "alice"))
    assert r.status_code==200
    body=r.json()
    assert body["method"].startswith("LIME") and body["n_samples"]==400
    assert 0<=body["fidelity_r2"]<=1
    assert {g["region"] for g in body["regions"]}=={"et", "ncr", "ed"}
    for item in body["factors"]+body["regions"]:
        assert item["provenance"]=="model_inferred" and item["evidence_id"].startswith("IDH:")
    assert body["reference"]["provenance"]=="reference_cohort"


def test_lime_requires_access_to_the_study(client, make_user, deployed):
    make_user("alice")
    url=f"/api/v1/studies/{uuid.uuid4()}/lime"
    r=client.get(url, params={"marker": "IDH"}, headers=login(client, "alice"))
    assert r.status_code==404
