"""Builds the per-marker molecular profile for one patient.

Each marker ends up in exactly one state:
- known:       the clinician supplied the lab result; it is shown, never predicted
- predicted:   the near-optimal set that best fits what is known produced a SetPrediction
- unavailable: no deployed set, or the set's output failed validation; never guessed
"""
import json
import threading
from collections import OrderedDict
from dataclasses import dataclass, replace
from typing import Literal

import structlog

from app.core.compute import heavy_slot
from app.domain.contracts import MARKER_LABELS, FeatureVector, Marker, SetPrediction, StabilityVerdict
from app.domain.registry import FUSED, IMAGING_ONLY, MarkerRegistry, ModelOutputError

logger=structlog.get_logger("profile")

# A loaded registry's model sets never change, so a profile depends only on its inputs. Each registry
# keeps its own cache (keyed by every model input), which makes repeat views instant on slow hosts.
CACHE_SIZE=512
_cache_lock=threading.Lock()


def _cache_for(registry: MarkerRegistry) -> OrderedDict[tuple, list["MarkerResult"]]:
    cache=registry.__dict__.get("_profile_cache")
    if cache is None:
        cache=OrderedDict()
        object.__setattr__(registry, "_profile_cache", cache)
    return cache


@dataclass(frozen=True)
class MarkerResult:
    marker: Marker
    status: Literal["known", "predicted", "unavailable"]
    call: str | None=None
    variant: str | None=None
    prediction: SetPrediction | None=None
    reason: str | None=None
    imaging_only: SetPrediction | None=None
    skill: float | None=None
    low_signal: bool=False
    # The scan's imaging features are further from the training patients than 99% of them are from
    # each other: the models are extrapolating, so the call is never shown as Stable.
    out_of_distribution: bool=False

    @property
    def resolved_by_combining(self) -> bool:
        """MRI alone could not decide, but MRI + patient context is Stable."""
        return (
            not self.low_signal
            and self.prediction is not None and self.imaging_only is not None
            and self.prediction.verdict==StabilityVerdict.STABLE
            and self.imaging_only.verdict!=StabilityVerdict.STABLE
        )


def screen_out_of_distribution(results: list[MarkerResult], unlike_training: bool) -> list[MarkerResult]:
    """Applies the data-sparsity check of the doubt decomposition to every predicted call: on a scan
    unlike the training cases, agreement among the models is not evidence, so a Stable verdict
    becomes Contested and the result is flagged."""
    if not unlike_training:
        return results
    screened=[]
    for r in results:
        if r.status!="predicted" or r.prediction is None:
            screened.append(r)
            continue
        prediction=r.prediction
        if prediction.verdict==StabilityVerdict.STABLE:
            prediction=prediction.model_copy(update={"verdict": StabilityVerdict.CONTESTED})
        screened.append(replace(r, prediction=prediction, out_of_distribution=True))
    return screened


def known_label(marker: Marker, value: int) -> str:
    positive, negative=MARKER_LABELS[marker]
    return positive if value==1 else negative


def build_profile(registry: MarkerRegistry, vector: FeatureVector, view: str=FUSED) -> list[MarkerResult]:
    """view=fused uses the best set for what is known; the other views re-score with the
    imaging-only or clinical-only set, so the UI can show what each source decides alone."""
    key=(view, json.dumps(vector.model_dump(mode="json"), sort_keys=True))
    with _cache_lock:
        cache=_cache_for(registry)
        if key in cache:
            cache.move_to_end(key)
            return list(cache[key])
    with heavy_slot():
        results=_compute(registry, vector, view)
    with _cache_lock:
        cache[key]=results
        while len(cache)>CACHE_SIZE:
            cache.popitem(last=False)
    return list(results)


def _compute(registry: MarkerRegistry, vector: FeatureVector, view: str) -> list[MarkerResult]:
    known=set(vector.known_markers)
    results=[]
    for marker in Marker:
        if marker in known:
            call=known_label(marker, vector.known_markers[marker])
            results.append(MarkerResult(marker, "known", call=call))
            continue
        predictor=registry.for_patient(marker, known) if view==FUSED else registry.get(marker, view)
        if predictor is None:
            scope="" if view==FUSED else view.replace("_", "-")+" "
            reason=f"{scope}model set not deployed"
            results.append(MarkerResult(marker, "unavailable", reason=reason))
            continue
        try:
            prediction=predictor.predict_set(vector)
        except (ModelOutputError, ValueError) as exc:
            logger.error("model_output_invalid", marker=marker.value, detail=str(exc))
            results.append(MarkerResult(marker, "unavailable", reason="model output failed validation"))
            continue
        imaging_only=None
        imaging_predictor=registry.get(marker, IMAGING_ONLY) if view==FUSED else None
        if imaging_predictor is not None:
            try:
                imaging_only=imaging_predictor.predict_set(vector)
            except (ModelOutputError, ValueError) as exc:
                logger.error(
                    "model_output_invalid", marker=marker.value, variant=IMAGING_ONLY, detail=str(exc),
                )
        results.append(MarkerResult(
            marker, "predicted", call=prediction.call, variant=predictor.variant,
            prediction=prediction, imaging_only=imaging_only,
            skill=predictor.meta.skill, low_signal=predictor.low_signal,
        ))
    return results
