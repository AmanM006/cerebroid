"""Grouped perturbation attribution on a small real model set whose label depends
only on age (positive when younger than 45)."""
import pytest

from app.domain.contracts import FeatureVector, Marker, Provenance
from app.domain.explain import evidence_group, explain_set
from app.domain.registry import load_registry
from tests.unit.test_registry import _meta, _train_set, _write_config, _write_manifest, _write_marker


@pytest.fixture
def predictor(tmp_path):
    root=tmp_path/"artifacts"
    _write_marker(root, "models/idh", _train_set(), _meta())  # cohort medians: age 55, sex 1
    _write_manifest(root)
    return load_registry(root, _write_config(tmp_path, {"IDH": "models/idh"})).get(Marker.IDH)


def _patient(age: int, sex: str="M") -> FeatureVector:
    features={"t1ce__et__glcm__Contrast": 0.0, "desc__enhancing_fraction": 0.5}
    return FeatureVector(study_id="s1", age=age, sex=sex, features=features)


def test_the_input_that_drives_the_label_ranks_first_and_points_the_right_way(predictor):
    explanation=explain_set(predictor, _patient(age=25))
    top=explanation.items[0]
    assert top.group=="clinical__age"
    assert top.direction=="toward_positive"  # being young pushes toward the positive class
    assert top.agreement==1.0
    assert top.provenance==Provenance.MODEL_INFERRED

    old=explain_set(predictor, _patient(age=80)).items[0]
    assert old.group=="clinical__age" and old.direction=="toward_negative"


def test_a_typical_value_has_no_effect(predictor):
    """At the cohort median age the age group is reset to itself, so it moves nothing."""
    explanation=explain_set(predictor, _patient(age=55))
    age=next(e for e in explanation.effects if e.group=="clinical__age")
    assert all(abs(x)<1e-9 for x in age.effects)
    assert "clinical__age" not in {item.group for item in explanation.items}


def test_effects_cover_every_group_for_every_model(predictor):
    explanation=explain_set(predictor, _patient(age=30))
    assert {e.group for e in explanation.effects}=={
        "clinical__age", "clinical__sex", "t1ce__et", "descriptors",
    }
    assert all(len(e.effects)==3 for e in explanation.effects)
    assert explanation.explanation_agreement is not None
    assert -1.0<=explanation.explanation_agreement<=1.0


def test_attribution_is_deterministic(predictor):
    a=explain_set(predictor, _patient(age=30))
    b=explain_set(predictor, _patient(age=30))
    assert a==b


@pytest.mark.parametrize(("column", "group"), [
    ("t1ce__et__glcm__Contrast", "t1ce__et"),
    ("flair__ed__firstorder__Mean", "flair__ed"),
    ("shape__ncr__shape__VoxelVolume", "shape__ncr"),
    ("desc__enhancing_fraction", "descriptors"),
    ("missing__adc", "missing_inputs"),
    ("known__idh", "known__IDH"),
    ("prior_biopsy", "clinical__prior_biopsy"),
])
def test_columns_map_to_readable_groups(column, group):
    assert evidence_group(column)[0]==group
