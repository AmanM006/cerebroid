"""Loads the committed model artifacts exactly as the API does.

Skipped until artifacts/manifest.json exists. Once it does, CI proves that
every committed marker loads in the API environment (pinned library versions,
sha256 match, valid metadata, warm-up), and that predictions on real held-out
patients vary with the input rather than being constant.
"""
import pandas as pd
import pytest

from app.core.config import get_settings
from app.domain.contracts import FeatureVector, Marker, Sex
from app.domain.registry import MANIFEST_FILE, MarkersConfig, load_registry

settings=get_settings()
ARTIFACTS=settings.artifacts_root
FEATURE_TABLE=ARTIFACTS/"features"/"features.parquet"

pytestmark=pytest.mark.skipif(not (ARTIFACTS/MANIFEST_FILE).is_file(), reason="model artifacts not committed")


@pytest.fixture(scope="module")
def registry():
    return load_registry(ARTIFACTS, settings.markers_config_path)


def _committed_markers() -> list[Marker]:
    import yaml
    config=MarkersConfig.model_validate(yaml.safe_load(settings.markers_config_path.read_text()))
    return [e.marker for e in config.markers if (ARTIFACTS/e.artifact_dir).is_dir()]


def test_every_committed_marker_loads(registry):
    committed=_committed_markers()
    assert committed, "manifest exists but no marker directory was found"
    problems={m.value: registry.status[m] for m in committed if registry.status[m]!="loaded"}
    assert not problems, f"markers that failed to load (see API logs for detail): {problems}"


def test_every_model_file_is_listed_in_manifest():
    import json
    listed=set(json.loads((ARTIFACTS/MANIFEST_FILE).read_text())["files"])
    on_disk={p.relative_to(ARTIFACTS).as_posix() for p in (ARTIFACTS/"models").rglob("*") if p.is_file()}
    unlisted=on_disk-listed
    assert not unlisted, f"model files missing from manifest: {sorted(unlisted)}"


@pytest.mark.skipif(not FEATURE_TABLE.is_file(), reason="feature table not committed")
def test_predictions_on_held_out_patients_depend_on_input(registry):
    table=pd.read_parquet(FEATURE_TABLE)
    test_rows=table[table["split"]=="test"].head(25)
    assert len(test_rows)>=5, "need at least 5 test-split patients"

    for marker in _committed_markers():
        predictor=registry.get(marker)
        assert predictor is not None
        medians=[]
        for _, row in test_rows.iterrows():
            features={
                c: (None if pd.isna(row[c]) else float(row[c]))
                for c in predictor.meta.feature_columns
                if c not in ("age", "sex")
            }
            vector=FeatureVector(
                study_id=str(row["patient_id"]),
                age=int(round(row["age"])),
                sex=Sex.MALE if int(row["sex"])==1 else Sex.FEMALE,
                features=features,
            )
            medians.append(predictor.predict_set(vector).prob_median)
        assert len(set(round(m, 6) for m in medians))>1, f"{marker.value}: identical output for every patient"


@pytest.mark.skipif(not FEATURE_TABLE.is_file(), reason="feature table not committed")
def test_model_inputs_exist_in_feature_table(registry):
    columns=set(pd.read_parquet(FEATURE_TABLE).columns)
    for marker in _committed_markers():
        predictor=registry.get(marker)
        assert predictor is not None
        absent=set(predictor.meta.feature_columns)-columns
        assert not absent, f"{marker.value} expects columns not in the feature table: {sorted(absent)[:20]}"
