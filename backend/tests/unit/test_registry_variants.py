"""Model variants: imaging-only / clinical-only counterfactual sets and sets that
use lab results the clinician already knows (fused_given_*)."""
import numpy as np
import pandas as pd
import pytest
from pydantic import ValidationError
from sklearn.linear_model import LogisticRegression

from app.domain.contracts import FeatureVector, Marker
from app.domain.registry import load_registry
from tests.unit.test_registry import _meta, _write_manifest, _write_marker

IMAGING=["t1ce__et__glcm__Contrast", "desc__enhancing_fraction"]


def _fit(columns: list[str], drive: str | None=None) -> list:
    """Two logistic models on random data; `drive` names the column the label depends on."""
    rng=np.random.default_rng(3)
    frame=pd.DataFrame({c: rng.normal(0, 1, 200) for c in columns})
    for c in columns:
        if c.startswith("known__") or c=="sex":
            frame[c]=rng.integers(0, 2, 200).astype(float)
        if c=="age":
            frame[c]=rng.integers(20, 85, 200).astype(float)
    signal=frame[drive] if drive else frame[columns[0]]
    y=(signal>signal.mean()).astype(int)
    return [LogisticRegression(C=c).fit(frame[columns], y) for c in (0.5, 2.0)]


def _variant_meta(marker: str, variant: str, columns: list[str], given: list[str] | None=None) -> dict:
    return _meta(
        marker=marker,
        n_models=2,
        variant=variant,
        given=given or [],
        feature_columns=columns,
        feature_medians={c: 0.0 if c!="age" else 55.0 for c in columns},
    )


def _config(tmp_path, entries: list[tuple[str, str, str]]):
    lines=["markers:"]
    for marker, variant, folder in entries:
        lines.append(f"  - marker: '{marker}'\n    variant: {variant}\n    artifact_dir: {folder}")
    path=tmp_path/"markers.yaml"
    path.write_text("\n".join(lines))
    return path


def _load(tmp_path, specs: list[tuple[str, str, str, list[str], list[str] | None]]):
    """specs: (marker, variant, folder, columns, given)."""
    root=tmp_path/"artifacts"
    for marker, variant, folder, columns, given in specs:
        drive="known__idh" if "known__idh" in columns else None
        _write_marker(root, folder, _fit(columns, drive), _variant_meta(marker, variant, columns, given))
    _write_manifest(root)
    return load_registry(root, _config(tmp_path, [(m, v, f) for m, v, f, _, _ in specs]))


def _patient(**known) -> FeatureVector:
    return FeatureVector(
        study_id="s1", age=50, sex="F",
        features={"t1ce__et__glcm__Contrast": 0.2, "desc__enhancing_fraction": 0.4},
        known_markers=known,
    )


FUSED=["age", "sex", *IMAGING]


def test_counterfactual_variants_load_with_their_own_labels(tmp_path):
    registry=_load(tmp_path, [
        ("IDH", "fused", "models/idh", FUSED, None),
        ("IDH", "imaging_only", "models/idh_imaging", IMAGING, None),
        ("IDH", "clinical_only", "models/idh_clinical", ["age", "sex"], None),
    ])
    assert registry.status=={"IDH": "loaded", "IDH:imaging_only": "loaded", "IDH:clinical_only": "loaded"}
    assert registry.get(Marker.IDH, "imaging_only").predict_set(_patient()).n_models==2


@pytest.mark.parametrize("variant, columns", [
    ("imaging_only", ["age", *IMAGING]),
    ("clinical_only", ["age", "sex", "desc__enhancing_fraction"]),
])
def test_variant_input_scope_is_enforced(tmp_path, variant, columns):
    registry=_load(tmp_path, [("IDH", variant, "models/x", columns, None)])
    assert registry.status[f"IDH:{variant}"]=="invalid"


def test_known_result_variant_is_chosen_only_when_the_result_is_known(tmp_path):
    registry=_load(tmp_path, [
        ("1p19q", "fused", "models/codel", FUSED, None),
        ("1p19q", "fused_given_idh", "models/codel_idh", [*FUSED, "known__idh"], ["IDH"]),
    ])
    assert registry.all_loaded
    assert registry.for_patient(Marker.CODEL_1P19Q, {Marker.IDH}).variant=="fused_given_idh"
    assert registry.for_patient(Marker.CODEL_1P19Q, set()).variant=="fused"


def test_a_known_marker_is_never_predicted(tmp_path):
    registry=_load(tmp_path, [("IDH", "fused", "models/idh", FUSED, None)])
    assert registry.for_patient(Marker.IDH, {Marker.IDH}) is None


def test_known_result_changes_the_prediction(tmp_path):
    registry=_load(tmp_path, [
        ("1p19q", "fused_given_idh", "models/codel_idh", [*FUSED, "known__idh"], ["IDH"]),
    ])
    predictor=registry.get(Marker.CODEL_1P19Q, "fused_given_idh")
    mutant=predictor.predict_set(_patient(IDH=1)).prob_median
    wildtype=predictor.predict_set(_patient(IDH=0)).prob_median
    assert mutant>wildtype


def test_known_result_variant_refuses_to_guess_a_missing_result(tmp_path):
    registry=_load(tmp_path, [
        ("1p19q", "fused_given_idh", "models/codel_idh", [*FUSED, "known__idh"], ["IDH"]),
    ])
    with pytest.raises(ValueError, match="needs a known IDH result"):
        registry.get(Marker.CODEL_1P19Q, "fused_given_idh").predict_set(_patient())


@pytest.mark.parametrize("marker, variant, columns, given", [
    ("1p19q", "fused", [*FUSED, "known__idh"], ["IDH"]),           # known input outside a fused_given variant
    ("1p19q", "fused_given_idh", FUSED, ["IDH"]),                   # given without its known__ column
    ("1p19q", "fused_given_idh", [*FUSED, "known__mgmt"], ["IDH"]),  # column doesn't match given
    ("IDH", "fused_given_idh", [*FUSED, "known__idh"], ["IDH"]),     # a marker given to itself
])
def test_inconsistent_known_result_metadata_is_rejected(tmp_path, marker, variant, columns, given):
    registry=_load(tmp_path, [(marker, variant, "models/x", columns, given)])
    label=marker if variant=="fused" else f"{marker}:{variant}"
    assert registry.status[label]=="invalid"


def test_meta_variant_must_match_config(tmp_path):
    root=tmp_path/"artifacts"
    _write_marker(root, "models/idh", _fit(IMAGING), _variant_meta("IDH", "imaging_only", IMAGING))
    _write_manifest(root)
    registry=load_registry(root, _config(tmp_path, [("IDH", "fused", "models/idh")]))
    assert registry.status["IDH"]=="invalid"


def test_prior_biopsy_history_is_a_clinical_input(tmp_path):
    columns=["age", "sex", "prior_biopsy"]
    registry=_load(tmp_path, [
        ("IDH", "clinical_only", "models/idh_clinical", columns, None),
        ("IDH", "imaging_only", "models/idh_imaging", [*IMAGING, "prior_biopsy"], None),
    ])
    assert registry.status["IDH:clinical_only"]=="loaded"
    assert registry.status["IDH:imaging_only"]=="invalid"

    predictor=registry.get(Marker.IDH, "clinical_only")
    unrecorded=predictor._frame(_patient())
    assert np.isnan(unrecorded["prior_biopsy"].iloc[0])
    recorded=FeatureVector(study_id="s1", age=50, sex="F", prior_biopsy=True, features={})
    assert predictor._frame(recorded)["prior_biopsy"].iloc[0]==1.0


def test_known_marker_values_are_binary():
    with pytest.raises(ValidationError):
        _patient(IDH=2)
