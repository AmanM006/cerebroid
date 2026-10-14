"""Grouped perturbation attribution: which groups of inputs pushed a call, and
whether the models in the near-optimal set agree on why.

Method (model-agnostic, deterministic): for each evidence group, replace the
patient's values of that group with the training-cohort medians from meta.json
and re-run every model. The change in P(positive) is that group's effect on
that model: positive means the patient's own values push toward the positive
class. A group whose values are already typical moves nothing, so the result
reads "what about this patient, compared with a typical patient, drove the
call". It measures model sensitivity, not biological cause.

Explanation agreement (CLAUDE.md §2.4 item 3) is the mean pairwise Spearman
rank correlation of the groups' absolute effects across set members: models
can agree on the call while relying on different evidence.
"""
import itertools
import math
from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy.stats import spearmanr

from app.domain.contracts import (
    CLINICAL_COLUMNS,
    EvidenceItem,
    FeatureVector,
    Provenance,
    Region,
    Sequence,
    known_marker_of,
    parse_feature_name,
)

SEQUENCE_LABELS={
    Sequence.T1: "T1", Sequence.T1CE: "T1 contrast", Sequence.T2: "T2", Sequence.FLAIR: "FLAIR",
    Sequence.ADC: "Diffusion (ADC)", Sequence.ASL: "Perfusion (ASL)",
}
REGION_LABELS={
    Region.ENHANCING: "enhancing tumor", Region.NECROTIC_CORE: "necrotic core", Region.EDEMA: "edema",
}
CLINICAL_LABELS={"age": "Age", "sex": "Sex", "prior_biopsy": "Biopsy before MRI"}

# Below this mean absolute change in probability a group is reported as having no effect.
MIN_WEIGHT=1e-4


def evidence_group(column: str) -> tuple[str, str]:
    """(group id, human label) for a model input column."""
    if column in CLINICAL_COLUMNS:
        return f"clinical__{column}", CLINICAL_LABELS[column]
    if (marker:=known_marker_of(column)) is not None:
        return f"known__{marker.value}", f"Known {marker.value} result"
    name=parse_feature_name(column)
    if name.kind=="radiomic" and name.region is not None:
        region=REGION_LABELS[name.region]
        if name.sequence is None:
            return f"shape__{name.region.value}", f"Shape and size · {region}"
        return f"{name.sequence.value}__{name.region.value}", f"{SEQUENCE_LABELS[name.sequence]} · {region}"
    if name.kind=="descriptor":
        return "descriptors", "Tumor composition (enhancing / necrotic / edema fractions, volume)"
    return "missing_inputs", "Missing-input flags"


@dataclass(frozen=True)
class GroupEffect:
    group: str
    label: str
    n_columns: int
    effects: list[float]  # per set member: P(original) - P(group at cohort median)


@dataclass(frozen=True)
class Explanation:
    items: list[EvidenceItem]
    effects: list[GroupEffect]
    explanation_agreement: float | None


def _groups(columns: list[str]) -> dict[str, tuple[str, list[str]]]:
    groups: dict[str, tuple[str, list[str]]]={}
    for column in columns:
        group, label=evidence_group(column)
        groups.setdefault(group, (label, []))[1].append(column)
    return groups


def _rank_agreement(matrix: np.ndarray) -> float | None:
    """Mean pairwise Spearman correlation between models' |effect| vectors."""
    if matrix.shape[0]<2 or matrix.shape[1]<2:
        return None
    scores=[]
    for a, b in itertools.combinations(range(matrix.shape[0]), 2):
        if np.ptp(matrix[a])==0 or np.ptp(matrix[b])==0:
            continue
        rho=float(spearmanr(matrix[a], matrix[b]).statistic)
        if math.isfinite(rho):
            scores.append(rho)
    return float(np.mean(scores)) if scores else None


def explain_set(predictor, features: FeatureVector) -> Explanation:
    """Attribute one patient's set prediction to evidence groups.

    predictor is a registry.SetMarkerPredictor; typed loosely to avoid an import cycle.
    """
    meta=predictor.meta
    base=predictor._frame(features)
    groups=_groups(meta.feature_columns)
    # One row per group with that group reset to the cohort median, plus the patient's own row first.
    rows=[base.iloc[0].to_dict()]
    for _, columns in groups.values():
        row=dict(rows[0])
        for column in columns:
            row[column]=meta.feature_medians[column]
        rows.append(row)
    frame=pd.DataFrame(rows, columns=meta.feature_columns)

    per_model=[]
    for model in predictor.models:
        p=np.asarray(model.predict_proba(frame)[:, 1], dtype=float)
        if not np.all(np.isfinite(p)):
            raise ValueError(f"{meta.marker.value} model returned a non-finite probability in attribution")
        per_model.append(p[0]-p[1:])
    matrix=np.vstack(per_model)  # models x groups

    effects=[
        GroupEffect(group=g, label=label, n_columns=len(columns), effects=[float(x) for x in matrix[:, i]])
        for i, (g, (label, columns)) in enumerate(groups.items())
    ]
    items=[]
    for effect in effects:
        values=np.asarray(effect.effects)
        weight=float(np.mean(np.abs(values)))
        if weight<MIN_WEIGHT:
            continue
        sign=1.0 if float(np.median(values))>=0 else -1.0
        nonzero=values[np.abs(values)>=MIN_WEIGHT]
        agreement=float(np.mean(np.sign(nonzero)==sign)) if len(values)>1 and len(nonzero) else None
        items.append(EvidenceItem(
            evidence_id=f"{meta.marker.value}:{meta.variant}:{effect.group}",
            marker=meta.marker,
            group=effect.group,
            direction="toward_positive" if sign>0 else "toward_negative",
            weight=weight,
            agreement=agreement,
            provenance=Provenance.MODEL_INFERRED,
        ))
    items.sort(key=lambda item: item.weight, reverse=True)
    return Explanation(items=items, effects=effects, explanation_agreement=_rank_agreement(np.abs(matrix)))
