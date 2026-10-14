"""Tipping evidence on a small real model set whose label is "younger than 45"
(positive = mutant), so the true tipping age is known."""
import pytest

from app.domain.contracts import MARKER_LABELS, FeatureVector, Marker
from app.domain.registry import load_registry
from app.domain.tipping import AGE_GRID, descriptor_grids, find_tipping_points
from tests.unit.test_registry import _meta, _train_set, _write_config, _write_manifest, _write_marker

GRIDS={"desc__enhancing_fraction": [0.0, 0.1, 0.2, 0.4, 0.6]}


@pytest.fixture
def predictor(tmp_path):
    root=tmp_path/"artifacts"
    _write_marker(root, "models/idh", _train_set(), _meta())
    _write_manifest(root)
    return load_registry(root, _write_config(tmp_path, {"IDH": "models/idh"})).get(Marker.IDH)


def _patient(age: int) -> FeatureVector:
    return FeatureVector(
        study_id="s1", age=age, sex="F",
        features={"t1ce__et__glcm__Contrast": 0.0, "desc__enhancing_fraction": 0.3},
    )


def _by_input(points):
    return {p.column: p for p in points}


def test_age_flips_the_call_near_the_true_boundary(predictor):
    points=_by_input(find_tipping_points(predictor, _patient(30), GRIDS, MARKER_LABELS[Marker.IDH]))
    age=points["age"]
    assert age.current==30
    assert age.flips_to=="wildtype"
    assert age.flip_at is not None and 38<=age.flip_at<=52
    assert len(age.curve)==len(AGE_GRID)

    older=_by_input(find_tipping_points(predictor, _patient(70), GRIDS, MARKER_LABELS[Marker.IDH]))["age"]
    assert older.flips_to=="mutant" and older.flip_at<70


def test_an_input_the_models_ignore_never_flips_the_call(predictor):
    enhancing=_by_input(find_tipping_points(predictor, _patient(30), GRIDS, MARKER_LABELS[Marker.IDH]))[
        "desc__enhancing_fraction"
    ]
    assert enhancing.flip_at is None and enhancing.flips_to is None


def test_inputs_without_a_plausible_range_are_skipped(predictor):
    points=_by_input(find_tipping_points(predictor, _patient(30), {}, MARKER_LABELS[Marker.IDH]))
    assert set(points)=={"age"}


def test_descriptor_grids_come_from_training_values_only():
    rows={f"p{i}": {"desc__necrosis_fraction": i/100, "age": 50.0} for i in range(101)}
    rows["p_nan"]={"desc__necrosis_fraction": float("nan")}
    grids=descriptor_grids(rows)
    assert set(grids)=={"desc__necrosis_fraction"}
    assert grids["desc__necrosis_fraction"][0]==pytest.approx(0.01)
    assert grids["desc__necrosis_fraction"][-1]==pytest.approx(0.99)
