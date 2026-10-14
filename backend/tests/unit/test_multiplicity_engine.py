import pytest
from pydantic import ValidationError

from app.domain.contracts import StabilityVerdict
from app.domain.multiplicity_engine import VerdictThresholds, agreement, compute_verdict, iqr

THRESHOLDS=VerdictThresholds(stable_min_agreement=0.9, stable_max_iqr=0.2, arbitrary_max_agreement=0.6)


def test_agreement_is_majority_fraction():
    assert agreement([0.9, 0.8, 0.2, 0.1], 0.5)==0.5
    assert agreement([0.9, 0.8, 0.7, 0.1], 0.5)==0.75


def test_iqr_of_single_model_is_zero():
    assert iqr([0.7])==0.0


def test_unanimous_and_tight_is_stable():
    assert compute_verdict([0.85, 0.9, 0.88, 0.92, 0.87], 0.5, THRESHOLDS)==StabilityVerdict.STABLE


def test_unanimous_but_widely_spread_is_contested():
    assert compute_verdict([0.51, 0.55, 0.9, 0.99, 0.6], 0.5, THRESHOLDS)==StabilityVerdict.CONTESTED


def test_near_even_split_is_arbitrary():
    assert compute_verdict([0.7, 0.6, 0.4, 0.3, 0.55], 0.5, THRESHOLDS)==StabilityVerdict.ARBITRARY


def test_clear_majority_with_dissent_is_contested():
    probs=[0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.2, 0.2, 0.2]
    assert compute_verdict(probs, 0.5, THRESHOLDS)==StabilityVerdict.CONTESTED


def test_thresholds_must_be_ordered():
    with pytest.raises(ValidationError):
        VerdictThresholds(stable_min_agreement=0.7, stable_max_iqr=0.2, arbitrary_max_agreement=0.8)
