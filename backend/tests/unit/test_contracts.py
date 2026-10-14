"""Contract tests: these pin down the shape both tracks code against."""
import pytest
from pydantic import ValidationError

from app.domain.contracts import (
    EvidenceItem,
    FeatureVector,
    Marker,
    MarkerPredictor,
    Provenance,
    ProvenancedValue,
    Region,
    Sequence,
    SetPrediction,
    StabilityVerdict,
    parse_feature_name,
)


def _vector(**overrides):
    data={
        "study_id": "study-1",
        "age": 54,
        "sex": "F",
        "features": {"t1ce__et__glcm__Contrast": 1.5, "desc__enhancing_fraction": 0.4, "missing__t2": 0.0},
    }
    data.update(overrides)
    return FeatureVector(**data)


def _set_prediction(probs, **overrides):
    data={
        "marker": Marker.IDH,
        "model_probabilities": probs,
        "verdict": StabilityVerdict.STABLE,
        "model_version": "sha256:abc",
    }
    data.update(overrides)
    return SetPrediction(**data)


# --- feature naming ---

def test_parse_radiomic_feature():
    f=parse_feature_name("t1ce__et__glcm__Contrast")
    assert f.kind=="radiomic"
    assert f.sequence==Sequence.T1CE
    assert f.region==Region.ENHANCING
    assert f.group=="t1ce__et__glcm"


def test_parse_shape_feature_has_no_sequence():
    f=parse_feature_name("shape__ncr__shape__VoxelVolume")
    assert f.sequence is None
    assert f.group=="shape__ncr__shape"


@pytest.mark.parametrize("name, sequence", [
    ("adc__et__firstorder__Mean", Sequence.ADC),
    ("asl__ncr__glcm__Contrast", Sequence.ASL),
])
def test_physiological_sequences_follow_the_same_convention(name, sequence):
    f=parse_feature_name(name)
    assert f.sequence==sequence
    assert f.kind=="radiomic"


def test_missing_physiological_sequence_flag_is_valid():
    assert parse_feature_name("missing__asl").kind=="missing_flag"
    assert parse_feature_name("missing__adc").kind=="missing_flag"


def test_parse_descriptor_and_missing_flag():
    assert parse_feature_name("desc__edema_to_core_ratio").kind=="descriptor"
    assert parse_feature_name("missing__flair").kind=="missing_flag"


@pytest.mark.parametrize("name", [
    "age",
    "who_grade",
    "t1ce_et_glcm_Contrast",
    "dwi__et__glcm__Contrast",
    "t1ce__tumor__glcm__Contrast",
    "missing__dwi",
])
def test_names_outside_convention_are_rejected(name):
    with pytest.raises(ValueError):
        parse_feature_name(name)


# --- FeatureVector ---

def test_feature_vector_rejects_leaked_clinical_field():
    with pytest.raises(ValidationError):
        _vector(who_grade=4)


def test_feature_vector_rejects_clinical_column_inside_features():
    with pytest.raises(ValidationError):
        _vector(features={"overall_survival": 300.0})


@pytest.mark.parametrize("age", [17, 101])
def test_feature_vector_age_range(age):
    with pytest.raises(ValidationError):
        _vector(age=age)


def test_missing_inputs_listed_from_flags():
    v=_vector(features={"missing__t2": 1.0, "missing__ncr": 1.0, "missing__flair": 0.0})
    assert v.missing_inputs()==["ncr", "t2"]


def test_feature_vector_is_immutable():
    v=_vector()
    with pytest.raises(ValidationError):
        v.age=60


# --- SetPrediction ---

def test_set_prediction_summary_is_derived_from_votes():
    p=_set_prediction([0.9, 0.8, 0.7, 0.2])
    assert p.n_models==4
    assert p.positive_fraction==0.75
    assert p.agreement==0.75
    assert p.call=="mutant"
    assert (p.prob_min, p.prob_max)==(0.2, 0.9)
    assert p.prob_median==pytest.approx(0.75)


def test_set_prediction_negative_majority_uses_negative_label():
    p=_set_prediction([0.1, 0.3, 0.6], marker=Marker.MGMT)
    assert p.call=="unmethylated"


def test_set_prediction_summary_cannot_be_overridden():
    with pytest.raises(ValidationError):
        _set_prediction([0.9], call="wildtype")


def test_set_prediction_rejects_bad_probability():
    with pytest.raises(ValidationError):
        _set_prediction([0.5, 1.2])


def test_set_prediction_requires_at_least_one_model():
    with pytest.raises(ValidationError):
        _set_prediction([])


def test_set_prediction_provenance_is_always_model_inferred():
    with pytest.raises(ValidationError):
        _set_prediction([0.9], provenance=Provenance.MEASURED)


def test_set_prediction_serializes_summary_fields():
    dumped=_set_prediction([0.9, 0.1]).model_dump(mode="json")
    assert dumped["provenance"]=="model_inferred"
    assert {"call", "agreement", "prob_min", "prob_max", "n_models"}<=dumped.keys()


# --- provenance is mandatory ---

def test_provenanced_value_requires_provenance():
    with pytest.raises(ValidationError):
        ProvenancedValue(value=54)


def test_evidence_item_requires_provenance():
    with pytest.raises(ValidationError):
        EvidenceItem(
            evidence_id="e1",
            marker=Marker.IDH,
            group="t1ce__et__glcm",
            direction="toward_positive",
            weight=0.3,
        )


# --- plugin protocol ---

def test_marker_predictor_protocol_is_structural():
    class Dummy:
        marker=Marker.IDH

        def required_inputs(self):
            return set()

        def predict_set(self, features):
            raise NotImplementedError

        def explain(self, features):
            raise NotImplementedError

    assert isinstance(Dummy(), MarkerPredictor)
