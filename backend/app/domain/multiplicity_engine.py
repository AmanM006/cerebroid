"""Turns the near-optimal model set's votes for one patient into a verdict.

The thresholds are not chosen here: they are fitted on cross-validation data
during training and shipped in each marker's
meta.json, so the API applies exactly what the notebook validated.
"""
import statistics

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.domain.contracts import StabilityVerdict


class VerdictThresholds(BaseModel):
    """
    STABLE:    agreement >= stable_min_agreement and IQR <= stable_max_iqr
    ARBITRARY: agreement <= arbitrary_max_agreement (close to a 50/50 split)
    CONTESTED: everything in between
    """

    model_config=ConfigDict(extra="forbid", frozen=True)

    stable_min_agreement: float=Field(ge=0.5, le=1.0)
    stable_max_iqr: float=Field(ge=0.0, le=1.0)
    arbitrary_max_agreement: float=Field(ge=0.5, le=1.0)

    @model_validator(mode="after")
    def _ordered(self) -> "VerdictThresholds":
        if self.arbitrary_max_agreement>=self.stable_min_agreement:
            raise ValueError("arbitrary_max_agreement must be below stable_min_agreement")
        return self


def agreement(probabilities: list[float], decision_threshold: float) -> float:
    """Fraction of models that agree with the majority call."""
    positive=sum(1 for p in probabilities if p>=decision_threshold)/len(probabilities)
    return max(positive, 1.0-positive)


def iqr(probabilities: list[float]) -> float:
    if len(probabilities)<2:
        return 0.0
    q1, _, q3=statistics.quantiles(probabilities, n=4, method="inclusive")
    return q3-q1


def compute_verdict(
    probabilities: list[float],
    decision_threshold: float,
    thresholds: VerdictThresholds,
) -> StabilityVerdict:
    agree=agreement(probabilities, decision_threshold)
    if agree<=thresholds.arbitrary_max_agreement:
        return StabilityVerdict.ARBITRARY
    if agree>=thresholds.stable_min_agreement and iqr(probabilities)<=thresholds.stable_max_iqr:
        return StabilityVerdict.STABLE
    return StabilityVerdict.CONTESTED
