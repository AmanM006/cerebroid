"""Doubt decomposition: each source is rated from real inputs, and the primary
source is the strongest one."""
import numpy as np
import pytest

from app.domain.contracts import FeatureVector, Marker, Provenance, SetPrediction, StabilityVerdict
from app.domain.doubt import CohortReference, decompose, primary

COLUMNS=["t1ce__et__glcm__Contrast", "flair__ed__firstorder__Mean", "desc__enhancing_fraction"]


@pytest.fixture(scope="module")
def reference():
    rng=np.random.default_rng(1)
    rows={
        f"UCSF-PDGM-{i:04d}": {c: float(rng.normal(0, 1)) for c in COLUMNS} | {"missing__t2": 0.0}
        for i in range(200)
    }
    return CohortReference(rows)


def _vector(values: dict[str, float], missing: tuple[str, ...]=()) -> FeatureVector:
    features: dict[str, float | None]=dict(values)
    features.update({f"missing__{m}": 1.0 for m in missing})
    return FeatureVector(study_id="s1", age=50, sex="F", features=features)


def _prediction(probabilities: list[float], verdict: StabilityVerdict) -> SetPrediction:
    return SetPrediction(
        marker=Marker.IDH, model_probabilities=probabilities, verdict=verdict, model_version="sha256:x",
    )


def _by_source(components):
    return {c.source: c for c in components}


def test_typical_tumor_is_close_to_the_cohort_and_an_extreme_one_is_not(reference):
    typical=reference.percentile({c: 0.0 for c in COLUMNS}, None)
    extreme=reference.percentile({c: 8.0 for c in COLUMNS}, None)
    assert typical<0.5
    assert extreme>=0.99


def test_missing_flags_are_not_used_as_distance_features(reference):
    assert reference.columns==sorted(COLUMNS)


def test_a_training_patient_is_not_its_own_neighbour(reference):
    pid=reference.patient_ids[0]
    row=dict(zip(reference.columns, reference.matrix[0], strict=True))
    assert reference.percentile(row, pid)>0.0


def test_confident_stable_typical_case_has_no_primary_doubt(reference):
    components=decompose(
        _prediction([0.9, 0.92, 0.95], StabilityVerdict.STABLE), False, 0.6,
        _vector({c: 0.0 for c in COLUMNS}), reference, None,
    )
    assert primary(components) is None
    assert all(c.level in {"low", "unknown"} for c in components)


def test_each_source_is_rated_from_its_own_evidence(reference):
    components=_by_source(decompose(
        _prediction([0.45, 0.55, 0.52], StabilityVerdict.CONTESTED), False, 0.6,
        _vector({c: 9.0 for c in COLUMNS}, missing=("t2",)), reference, None,
    ))
    assert components["multiplicity"].level=="medium"
    assert components["ambiguity"].level=="high"  # median 0.52 is 0.02 from the boundary
    assert components["data_sparsity"].level=="high"
    assert components["data_sparsity"].provenance==Provenance.REFERENCE_COHORT
    assert components["missing_inputs"].level=="high"
    assert "t2" in components["missing_inputs"].action
    assert components["model_skill"].level=="low"


def test_low_skill_set_points_to_tissue_testing(reference):
    components=decompose(
        _prediction([0.72, 0.73, 0.74], StabilityVerdict.STABLE), True, 0.01,
        _vector({c: 0.0 for c in COLUMNS}), reference, None,
    )
    worst=primary(components)
    assert worst is not None and worst.source=="model_skill"
    assert "tissue" in worst.action


def test_without_a_reference_sparsity_is_unknown_not_guessed():
    components=_by_source(decompose(
        _prediction([0.9, 0.9], StabilityVerdict.STABLE), False, None, _vector({COLUMNS[0]: 0.0}), None, None,
    ))
    assert components["data_sparsity"].level=="unknown"
    assert components["data_sparsity"].value is None
    assert components["model_skill"].level=="unknown"
