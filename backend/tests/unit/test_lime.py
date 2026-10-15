"""LIME on a small real model set whose label depends only on age (positive when younger than 45)."""
import pytest

from app.domain.contracts import FeatureVector, Marker, Region
from app.domain.lime import explain_lime, region_of
from app.domain.registry import load_registry
from tests.unit.test_registry import _meta, _train_set, _write_config, _write_manifest, _write_marker


@pytest.fixture
def predictor(tmp_path):
    root=tmp_path/"artifacts"
    _write_marker(root, "models/idh", _train_set(), _meta())  # cohort medians: age 55, sex 1
    _write_manifest(root)
    return load_registry(root, _write_config(tmp_path, {"IDH": "models/idh"})).get(Marker.IDH)


def _patient(age: int) -> FeatureVector:
    features={"t1ce__et__glcm__Contrast": 0.0, "desc__enhancing_fraction": 0.5}
    return FeatureVector(study_id="s1", age=age, sex="M", features=features)


def test_the_driving_input_is_the_top_factor_and_points_the_right_way(predictor):
    young=explain_lime(predictor, _patient(25))
    assert young.factors[0].group=="clinical__age" and young.factors[0].effect>0
    assert young.factors[0].agreement==1.0
    old=explain_lime(predictor, _patient(80))
    assert old.factors[0].group=="clinical__age" and old.factors[0].effect<0


def test_surrogate_is_faithful_and_deterministic(predictor):
    a=explain_lime(predictor, _patient(30))
    assert 0.5<=a.fidelity_r2<=1.0
    assert a==explain_lime(predictor, _patient(30))


def test_region_map_sums_groups_measured_in_each_region(predictor):
    result=explain_lime(predictor, _patient(30))
    assert set(result.regions)==set(Region)
    in_enhancing=sum(f.effect for f in result.factors if f.region==Region.ENHANCING)
    assert result.regions[Region.ENHANCING]==pytest.approx(in_enhancing, abs=1e-3)


@pytest.mark.parametrize(("group", "region"), [
    ("t1ce__et", Region.ENHANCING), ("shape__ncr", Region.NECROTIC_CORE), ("flair__ed", Region.EDEMA),
    ("clinical__age", None), ("descriptors", None), ("known__IDH", None), ("missing_inputs", None),
])
def test_region_of_group(group, region):
    assert region_of(group)==region
