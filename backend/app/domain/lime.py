"""LIME local explanations (Ribeiro, Singh and Guestrin, KDD 2016) for one patient and marker.

Interpretable representation: one on/off switch per evidence group (the groups of explain.py, e.g.
"T1 contrast · enhancing tumor", "Shape and size · edema", "Age"), as LIME does with superpixels in
images. On keeps the patient's own values; off replaces the whole group with the training-cohort
medians, i.e. "what a typical patient looks like there".

For each model in the near-optimal set: score N random switch patterns, weight each pattern by how
close it is to the patient (LIME's exponential kernel on cosine distance, width 0.25), and fit a
weighted ridge regression of P(positive) on the switches. A group's coefficient is how much the
patient's own values in that group, versus typical values, move the probability; the weighted R2 is
the surrogate's local fidelity. Across the set we report the median coefficient, the share of
models agreeing on its direction, and the rank agreement of |coefficients|.

Region map: coefficients of the groups measured inside one tumor region (enhancing tumor, necrotic
core, edema; any sequence or shape) are summed, giving how strongly each region of this tumor pushes
the call: the region-level picture Grad-CAM gives for image networks. These models read measured
features, not pixels, so the map is per region, never per voxel.

Deterministic (fixed seed). Describes model sensitivity, not biological cause.
"""
from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge

from app.domain.contracts import FeatureVector, Region
from app.domain.explain import _groups, _rank_agreement

N_SAMPLES=400
KERNEL_WIDTH=0.25
SEED=0
MIN_EFFECT=1e-4
REGION_OF_GROUP_SUFFIX={r.value: r for r in Region}


@dataclass(frozen=True)
class LimeFactor:
    group: str
    label: str
    region: Region | None
    effect: float            # median coefficient across models: + pushes toward the positive class
    agreement: float | None  # share of models whose coefficient has the same sign as the median


@dataclass(frozen=True)
class LimeResult:
    factors: list[LimeFactor]
    regions: dict[Region, float]
    fidelity_r2: float
    explanation_agreement: float | None
    n_samples: int


def region_of(group: str) -> Region | None:
    """The tumor region a group is measured in, if any (e.g. 't1ce__et' and 'shape__et' -> enhancing)."""
    suffix=group.rsplit("__", 1)[-1]
    if "__" not in group or group.startswith(("clinical", "known")):
        return None
    return REGION_OF_GROUP_SUFFIX.get(suffix)


def _patterns(n_groups: int, rng: np.random.Generator) -> np.ndarray:
    """First row: the patient as is. Others: a uniform number of groups switched off at random."""
    rows=np.ones((N_SAMPLES, n_groups))
    for i in range(1, N_SAMPLES):
        off=rng.integers(1, n_groups+1)
        rows[i, rng.choice(n_groups, size=off, replace=False)]=0
    return rows


def _kernel(patterns: np.ndarray) -> np.ndarray:
    on=patterns.sum(axis=1)
    cosine_distance=1-on/(np.sqrt(on.clip(min=1e-12))*np.sqrt(patterns.shape[1]))
    return np.sqrt(np.exp(-(cosine_distance**2)/KERNEL_WIDTH**2))


def explain_lime(predictor, features: FeatureVector) -> LimeResult:
    """predictor is a registry.SetMarkerPredictor; typed loosely to avoid an import cycle."""
    meta=predictor.meta
    base=predictor._frame(features).iloc[0]
    groups=list(_groups(meta.feature_columns).items())
    patterns=_patterns(len(groups), np.random.default_rng(SEED))
    weights=_kernel(patterns)

    medians=pd.Series(meta.feature_medians)
    rows=np.tile(base[meta.feature_columns].to_numpy(dtype=float), (N_SAMPLES, 1))
    column_index={c: i for i, c in enumerate(meta.feature_columns)}
    for g, (_, (_, columns)) in enumerate(groups):
        idx=[column_index[c] for c in columns]
        off=patterns[:, g]==0
        rows[np.ix_(off, idx)]=medians[columns].to_numpy(dtype=float)
    frame=pd.DataFrame(rows, columns=meta.feature_columns)

    coefficients=[]
    fidelities=[]
    for model in predictor.models:
        p=np.asarray(model.predict_proba(frame)[:, 1], dtype=float)
        if not np.all(np.isfinite(p)):
            raise ValueError(f"{meta.marker.value} model returned a non-finite probability in LIME")
        surrogate=Ridge(alpha=1.0).fit(patterns, p, sample_weight=weights)
        coefficients.append(surrogate.coef_)
        fidelities.append(surrogate.score(patterns, p, sample_weight=weights) if np.ptp(p)>0 else 1.0)
    matrix=np.vstack(coefficients)  # models x groups

    factors=[]
    regions: dict[Region, float]={r: 0.0 for r in Region}
    for g, (group, (label, _)) in enumerate(groups):
        values=matrix[:, g]
        effect=float(np.median(values))
        region=region_of(group)
        if region is not None:
            regions[region]+=effect
        if abs(effect)<MIN_EFFECT:
            continue
        nonzero=values[np.abs(values)>=MIN_EFFECT]
        agreement=(float(np.mean(np.sign(nonzero)==np.sign(effect)))
                   if len(values)>1 and len(nonzero) else None)
        factors.append(LimeFactor(group, label, region, effect, agreement))
    factors.sort(key=lambda f: abs(f.effect), reverse=True)
    return LimeResult(
        factors=factors,
        regions=regions,
        fidelity_r2=float(np.median(fidelities)),
        explanation_agreement=_rank_agreement(np.abs(matrix)),
        n_samples=N_SAMPLES,
    )
