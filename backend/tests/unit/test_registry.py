"""Registry tests against small real scikit-learn model sets built in a temp dir.

Nothing here is committed as a model artifact; the sets are trained on random
data inside each test only to exercise loading, integrity checks and inference.
"""
import json
import math
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import pytest
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from app.domain.contracts import FeatureVector, Marker, Provenance, StabilityVerdict
from app.domain.registry import ModelOutputError, load_registry, sha256_file

COLUMNS=["age", "sex", "t1ce__et__glcm__Contrast", "desc__enhancing_fraction"]


class NaNModel:
    def predict_proba(self, frame):
        return np.array([[math.nan, math.nan]])


class Exploit:
    """Unpickling this creates a file: proof of code execution if it ever loads."""

    def __init__(self, target: Path):
        self.target=str(target)

    def __reduce__(self):
        return (open, (self.target, "w"))


def _train_set(n_models: int=3) -> list:
    rng=np.random.default_rng(0)
    frame=pd.DataFrame({
        "age": rng.integers(20, 85, 300).astype(float),
        "sex": rng.integers(0, 2, 300).astype(float),
        "t1ce__et__glcm__Contrast": rng.normal(0, 1, 300),
        "desc__enhancing_fraction": rng.uniform(0, 1, 300),
    })
    y=((frame["age"]<45).astype(int)^(rng.uniform(0, 1, 300)<0.1)).astype(int)
    models=[]
    for c in [0.1, 1.0, 10.0][:n_models]:
        model=make_pipeline(SimpleImputer(strategy="median"), StandardScaler(), LogisticRegression(C=c))
        models.append(model.fit(frame[COLUMNS], y))
    return models


def _meta(marker: str="IDH", n_models: int=3, **overrides) -> dict:
    meta={
        "marker": marker,
        "feature_columns": COLUMNS,
        "feature_medians": dict(zip(COLUMNS, [55.0, 1.0, 0.0, 0.5], strict=True)),
        "decision_threshold": 0.5,
        "verdict_thresholds": {
            "stable_min_agreement": 0.9,
            "stable_max_iqr": 0.2,
            "arbitrary_max_agreement": 0.6,
        },
        "epsilon": 0.03,
        "models": [
            {"model_id": f"logreg-{i}", "family": "logreg", "cv_log_loss": 0.5} for i in range(n_models)
        ],
        "library_versions": {"scikit-learn": "1.9.1"},
    }
    meta.update(overrides)
    return meta


def _write_marker(root: Path, artifact_dir: str, models, meta: dict) -> None:
    folder=root/artifact_dir
    folder.mkdir(parents=True, exist_ok=True)
    joblib.dump(models, folder/"models.joblib")
    (folder/"meta.json").write_text(json.dumps(meta))


def _write_manifest(root: Path) -> None:
    files={
        p.relative_to(root).as_posix(): sha256_file(p)
        for p in root.rglob("*")
        if p.is_file() and p.name!="manifest.json"
    }
    (root/"manifest.json").write_text(json.dumps({"files": files, "library_versions": {}}))


def _write_config(tmp_path: Path, entries: dict[str, str]) -> Path:
    path=tmp_path/"markers.yaml"
    lines=["markers:"]+[f"  - marker: '{m}'\n    artifact_dir: {d}" for m, d in entries.items()]
    path.write_text("\n".join(lines))
    return path


@pytest.fixture
def artifacts(tmp_path):
    root=tmp_path/"artifacts"
    _write_marker(root, "models/idh", _train_set(), _meta())
    _write_manifest(root)
    return root, _write_config(tmp_path, {"IDH": "models/idh"})


def _patient(age: int, **features) -> FeatureVector:
    base={"t1ce__et__glcm__Contrast": 0.1, "desc__enhancing_fraction": 0.4}
    base.update(features)
    return FeatureVector(study_id="s1", age=age, sex="M", features=base)


def test_loads_and_predicts_with_every_model(artifacts):
    root, config=artifacts
    registry=load_registry(root, config)

    assert registry.status=={"IDH": "loaded"}
    assert registry.all_loaded
    prediction=registry.get(Marker.IDH).predict_set(_patient(40))
    assert prediction.n_models==3
    assert prediction.provenance==Provenance.MODEL_INFERRED
    assert prediction.model_version=="sha256:"+sha256_file(root/"models/idh/models.joblib")


def test_predictions_depend_on_the_input(artifacts):
    registry=load_registry(*artifacts)
    predictor=registry.get(Marker.IDH)
    young=predictor.predict_set(_patient(25)).prob_median
    old=predictor.predict_set(_patient(80)).prob_median
    assert young>old


def test_missing_feature_value_is_passed_as_nan_and_imputed(artifacts):
    predictor=load_registry(*artifacts).get(Marker.IDH)
    prediction=predictor.predict_set(_patient(40, desc__enhancing_fraction=None))
    assert all(0.0<=p<=1.0 for p in prediction.model_probabilities)


def test_tampered_artifact_is_never_unpickled(artifacts, tmp_path):
    root, config=artifacts
    proof=tmp_path/"code_was_executed"
    joblib.dump(Exploit(proof), root/"models/idh/models.joblib")

    registry=load_registry(root, config)

    assert registry.status["IDH"]=="integrity_error"
    assert registry.get(Marker.IDH) is None
    assert not proof.exists()


def test_tampered_meta_is_rejected(artifacts):
    root, config=artifacts
    meta=json.loads((root/"models/idh/meta.json").read_text())
    meta["decision_threshold"]=0.1
    (root/"models/idh/meta.json").write_text(json.dumps(meta))
    assert load_registry(root, config).status[Marker.IDH]=="integrity_error"


def test_manifest_entry_outside_artifacts_dir_is_rejected(tmp_path):
    root=tmp_path/"artifacts"
    root.mkdir()
    outside=tmp_path/"outside"
    _write_marker(outside, "", _train_set(), _meta())
    files={
        "../outside/meta.json": sha256_file(outside/"meta.json"),
        "../outside/models.joblib": sha256_file(outside/"models.joblib"),
    }
    (root/"manifest.json").write_text(json.dumps({"files": files, "library_versions": {}}))
    config=_write_config(tmp_path, {"IDH": "../outside"})
    assert load_registry(root, config).status[Marker.IDH]=="integrity_error"


def test_no_manifest_means_every_marker_missing(tmp_path):
    root=tmp_path/"artifacts"
    root.mkdir()
    config=_write_config(tmp_path, {"IDH": "models/idh", "MGMT": "models/mgmt"})
    registry=load_registry(root, config)
    assert registry.status=={"IDH": "missing", "MGMT": "missing"}
    assert not registry.all_loaded


def test_one_broken_marker_does_not_block_the_others(artifacts, tmp_path):
    root, _=artifacts
    config=_write_config(tmp_path, {"IDH": "models/idh", "MGMT": "models/mgmt"})
    registry=load_registry(root, config)
    assert registry.status["IDH"]=="loaded"
    assert registry.status["MGMT"]=="integrity_error"
    assert not registry.all_loaded


@pytest.mark.parametrize("bad_meta", [
    _meta(feature_columns=["age", "who_grade"], feature_medians={"age": 50.0, "who_grade": 3.0}),
    _meta(feature_medians={"age": 55.0}),
    _meta(n_models=2),
    _meta(marker="NOT_A_MARKER"),
    {**_meta(), "unexpected_field": 1},
])
def test_invalid_meta_is_rejected(tmp_path, bad_meta):
    root=tmp_path/"artifacts"
    _write_marker(root, "models/idh", _train_set(), bad_meta)
    _write_manifest(root)
    registry=load_registry(root, _write_config(tmp_path, {"IDH": "models/idh"}))
    assert registry.status["IDH"]=="invalid"


def test_model_returning_nan_fails_warm_up(tmp_path):
    root=tmp_path/"artifacts"
    _write_marker(root, "models/idh", [NaNModel()], _meta(n_models=1))
    _write_manifest(root)
    registry=load_registry(root, _write_config(tmp_path, {"IDH": "models/idh"}))
    assert registry.status["IDH"]=="invalid"


def test_model_returning_nan_at_prediction_time_raises(artifacts):
    predictor=load_registry(*artifacts).get(Marker.IDH)
    predictor.models[0]=NaNModel()
    with pytest.raises(ModelOutputError):
        predictor.predict_set(_patient(40))


def test_verdict_comes_from_meta_thresholds(artifacts):
    predictor=load_registry(*artifacts).get(Marker.IDH)
    prediction=predictor.predict_set(_patient(25))
    assert prediction.verdict in set(StabilityVerdict)


def test_repo_markers_config_is_valid():
    from app.core.config import get_settings
    from app.domain.registry import MarkersConfig

    import yaml
    config=MarkersConfig.model_validate(yaml.safe_load(get_settings().markers_config_path.read_text()))
    assert {e.marker for e in config.markers}==set(Marker)
