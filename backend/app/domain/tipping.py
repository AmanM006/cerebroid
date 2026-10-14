"""Tipping evidence (CLAUDE.md §2.4 item 4): the smallest plausible change to a
clinician-verifiable input that flips the model set's majority call.

Only inputs a clinician can check are varied: age and the interpretable tumor
descriptors (volume, enhancing and necrotic fractions, edema-to-core ratio).
Each is swept across a plausible range (ages 18-100; descriptors over the
training patients' 1st-99th percentiles) with every other input held fixed,
and every model in the set is re-run at each value. The result is model
sensitivity, never a claim that changing the input would change the tumor.
"""
from dataclasses import dataclass

import numpy as np
import pandas as pd

from app.domain.contracts import FeatureVector

TIPPING_INPUTS: dict[str, tuple[str, str]]={
    "age": ("Age", "years"),
    "desc__total_volume_mm3": ("Tumor volume", "mm³"),
    "desc__enhancing_fraction": ("Enhancing share of the tumor", "fraction"),
    "desc__necrosis_fraction": ("Necrotic share of the tumor", "fraction"),
    "desc__edema_to_core_ratio": ("Edema-to-core ratio", "ratio"),
}
AGE_GRID=[float(a) for a in range(18, 101)]
QUANTILES=np.linspace(0.01, 0.99, 50)


@dataclass(frozen=True)
class CurvePoint:
    value: float
    positive_fraction: float
    prob_median: float


@dataclass(frozen=True)
class Tipping:
    column: str
    label: str
    unit: str
    current: float
    flip_at: float | None
    flips_to: str | None
    curve: list[CurvePoint]


def descriptor_grids(train_rows: dict[str, dict]) -> dict[str, list[float]]:
    """Plausible values per descriptor: quantiles of the training patients' own values."""
    grids={}
    for column in TIPPING_INPUTS:
        if column=="age":
            continue
        raw=[r[column] for r in train_rows.values() if r.get(column) is not None]
        values=np.array(raw, dtype=float)
        values=values[np.isfinite(values)]
        if len(values):
            grids[column]=sorted({round(float(v), 6) for v in np.quantile(values, QUANTILES)})
    return grids


def find_tipping_points(
    predictor, vector: FeatureVector, grids: dict[str, list[float]], labels: tuple[str, str],
) -> list[Tipping]:
    """predictor is a registry.SetMarkerPredictor; labels is (positive, negative) for the marker."""
    meta=predictor.meta
    threshold=meta.decision_threshold
    base=predictor._frame(vector).iloc[0].to_dict()
    current_call=predictor.predict_set(vector).call
    positive, negative=labels
    results=[]
    for column, (label, unit) in TIPPING_INPUTS.items():
        if column not in meta.feature_columns:
            continue
        current=float(base[column])
        grid=AGE_GRID if column=="age" else grids.get(column, [])
        if not np.isfinite(current) or not grid:
            continue
        frame=pd.DataFrame([{**base, column: v} for v in grid], columns=meta.feature_columns)
        probs=np.vstack([np.asarray(m.predict_proba(frame)[:, 1], dtype=float) for m in predictor.models])
        positive_fraction=(probs>=threshold).mean(axis=0)
        calls=np.where(positive_fraction>=0.5, positive, negative)
        flipped=[i for i, call in enumerate(calls) if call!=current_call]
        nearest=min(flipped, key=lambda i: abs(grid[i]-current)) if flipped else None
        results.append(Tipping(
            column=column,
            label=label,
            unit=unit,
            current=current,
            flip_at=None if nearest is None else float(grid[nearest]),
            flips_to=None if nearest is None else str(calls[nearest]),
            curve=[
                CurvePoint(
                    value=float(v), positive_fraction=float(f), prob_median=float(np.median(probs[:, i])),
                )
                for i, (v, f) in enumerate(zip(grid, positive_fraction, strict=True))
            ],
        ))
    return results
