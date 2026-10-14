"""Builds the per-marker molecular profile for one patient.

Each marker ends up in exactly one state:
- known:       the clinician supplied the lab result; it is shown, never predicted
- predicted:   the near-optimal set that best fits what is known produced a SetPrediction
- unavailable: no deployed set, or the set's output failed validation; never guessed
"""
from dataclasses import dataclass
from typing import Literal

import structlog

from app.domain.contracts import MARKER_LABELS, FeatureVector, Marker, SetPrediction
from app.domain.registry import MarkerRegistry, ModelOutputError

logger=structlog.get_logger("profile")


@dataclass(frozen=True)
class MarkerResult:
    marker: Marker
    status: Literal["known", "predicted", "unavailable"]
    call: str | None=None
    variant: str | None=None
    prediction: SetPrediction | None=None
    reason: str | None=None


def known_label(marker: Marker, value: int) -> str:
    positive, negative=MARKER_LABELS[marker]
    return positive if value==1 else negative


def build_profile(registry: MarkerRegistry, vector: FeatureVector) -> list[MarkerResult]:
    known=set(vector.known_markers)
    results=[]
    for marker in Marker:
        if marker in known:
            call=known_label(marker, vector.known_markers[marker])
            results.append(MarkerResult(marker, "known", call=call))
            continue
        predictor=registry.for_patient(marker, known)
        if predictor is None:
            results.append(MarkerResult(marker, "unavailable", reason="model set not deployed"))
            continue
        try:
            prediction=predictor.predict_set(vector)
        except ModelOutputError as exc:
            logger.error("model_output_invalid", marker=marker.value, detail=str(exc))
            results.append(MarkerResult(marker, "unavailable", reason="model output failed validation"))
            continue
        results.append(MarkerResult(
            marker, "predicted", call=prediction.call, variant=predictor.variant, prediction=prediction,
        ))
    return results
