"""Loads the committed model artifacts exactly as the API does.

Skipped until artifacts/manifest.json exists. Once it does, CI proves that
every committed marker loads in the API environment (pinned library versions,
sha256 match, valid metadata, warm-up), and that predictions on real held-out
patients vary with the input rather than being constant.
"""
import pandas as pd
import pytest

from app.core.config import get_settings
from app.domain.contracts import CLINICAL_COLUMNS, FeatureVector, Marker, Sex, known_marker_of
from app.domain.registry import MANIFEST_FILE, MarkersConfig, load_registry, variant_label

# Feature-table column holding each marker's lab label (used to supply known results).
TARGET_COLUMN={
    Marker.IDH: "idh",
    Marker.CODEL_1P19Q: "codeletion_1p19q",
    Marker.MGMT: "mgmt",
    Marker.GRADE: "who_grade",
}


def _as_known(marker: Marker, value) -> int:
    """Lab label -> 0/1 positive class; WHO grade is stored as 2/3/4 and grade 4 is positive."""
    return int(value==4) if marker==Marker.GRADE else int(value)

settings=get_settings()
ARTIFACTS=settings.artifacts_root
FEATURE_TABLE=ARTIFACTS/"features"/"features.parquet"

pytestmark=pytest.mark.skipif(not (ARTIFACTS/MANIFEST_FILE).is_file(), reason="model artifacts not committed")


@pytest.fixture(scope="module")
def registry():
    return load_registry(ARTIFACTS, settings.markers_config_path)


def _committed_entries():
    import yaml
    config=MarkersConfig.model_validate(yaml.safe_load(settings.markers_config_path.read_text()))
    return [e for e in config.markers if (ARTIFACTS/e.artifact_dir).is_dir()]


def test_every_committed_marker_loads(registry):
    committed=_committed_entries()
    assert committed, "manifest exists but no marker directory was found"
    labels=[variant_label(e.marker, e.variant) for e in committed]
    problems={label: registry.status[label] for label in labels if registry.status[label]!="loaded"}
    assert not problems, f"marker variants that failed to load (see API logs for detail): {problems}"


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

    for entry in _committed_entries():
        predictor=registry.get(entry.marker, entry.variant)
        assert predictor is not None
        medians=[]
        for _, row in test_rows.iterrows():
            known={
                m: _as_known(m, row[TARGET_COLUMN[m]])
                for m in predictor.meta.given
                if pd.notna(row[TARGET_COLUMN[m]])
            }
            if len(known)<len(predictor.meta.given):
                continue
            features={
                c: (None if pd.isna(row[c]) else float(row[c]))
                for c in predictor.meta.feature_columns
                if c not in CLINICAL_COLUMNS and known_marker_of(c) is None
            }
            biopsy=row.get("prior_biopsy")
            vector=FeatureVector(
                study_id=str(row["patient_id"]),
                age=int(round(row["age"])),
                sex=Sex.MALE if int(row["sex"])==1 else Sex.FEMALE,
                prior_biopsy=None if biopsy is None or pd.isna(biopsy) else bool(biopsy),
                features=features,
                known_markers=known,
            )
            medians.append(predictor.predict_set(vector).prob_median)
        label=variant_label(entry.marker, entry.variant)
        assert len(medians)>=2, f"{label}: fewer than 2 usable test patients"
        assert len(set(round(m, 6) for m in medians))>1, f"{label}: identical output for every patient"


@pytest.mark.skipif(not FEATURE_TABLE.is_file(), reason="feature table not committed")
def test_model_inputs_exist_in_feature_table(registry):
    columns=set(pd.read_parquet(FEATURE_TABLE).columns)
    for entry in _committed_entries():
        predictor=registry.get(entry.marker, entry.variant)
        assert predictor is not None
        inputs={c for c in predictor.meta.feature_columns if known_marker_of(c) is None}
        absent=inputs-columns
        label=variant_label(entry.marker, entry.variant)
        assert not absent, f"{label} expects columns not in the feature table: {sorted(absent)[:20]}"
