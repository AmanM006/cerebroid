"""The "resolved by combining" rule on hand-built set predictions."""
import pytest

from app.domain.contracts import Marker, SetPrediction, StabilityVerdict
from app.domain.profile import MarkerResult


def _set(verdict: StabilityVerdict) -> SetPrediction:
    return SetPrediction(
        marker=Marker.IDH, model_probabilities=[0.8, 0.7], verdict=verdict, model_version="sha256:x",
    )


@pytest.mark.parametrize("imaging, combined, resolved", [
    (StabilityVerdict.ARBITRARY, StabilityVerdict.STABLE, True),
    (StabilityVerdict.CONTESTED, StabilityVerdict.STABLE, True),
    (StabilityVerdict.STABLE, StabilityVerdict.STABLE, False),
    (StabilityVerdict.ARBITRARY, StabilityVerdict.CONTESTED, False),
])
def test_resolved_by_combining(imaging, combined, resolved):
    result=MarkerResult(Marker.IDH, "predicted", prediction=_set(combined), imaging_only=_set(imaging))
    assert result.resolved_by_combining is resolved


def test_not_resolved_without_an_imaging_only_set():
    result=MarkerResult(Marker.IDH, "predicted", prediction=_set(StabilityVerdict.STABLE))
    assert result.resolved_by_combining is False
