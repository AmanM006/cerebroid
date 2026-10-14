"""Doubt decomposition (CLAUDE.md §2.4 item 5): why a marker call is uncertain,
and what a clinician can do about each reason.

Sources, each rated low / medium / high (or unknown when it can't be measured):
- multiplicity:   equally good models disagree with each other
- ambiguity:      the models agree, but on a probability close to the decision boundary
- data_sparsity:  the patient's imaging features are unlike the training patients
- missing_inputs: an MRI sequence or tumor region is absent
- model_skill:    the model set barely beats guessing the base rate for this marker

Data sparsity is measured in the space of imaging features, robustly scaled with
the training split's medians and IQRs: the distance to the patient's k-th nearest
training patient is compared with the same distance for every training patient
(leave-one-out). A patient further out than 99% of the training cohort is "high".
"""
from dataclasses import dataclass
from typing import Literal

import numpy as np

from app.domain.contracts import (
    FeatureVector,
    Provenance,
    SetPrediction,
    StabilityVerdict,
    parse_feature_name,
)
from app.domain.multiplicity_engine import iqr

Level=Literal["low", "medium", "high", "unknown"]
LEVEL_ORDER: dict[Level, int]={"unknown": 0, "low": 1, "medium": 2, "high": 3}

K_NEIGHBOURS=5
# Robust z-scores are clipped so one extreme feature can't dominate the distance.
Z_CLIP=10.0


@dataclass(frozen=True)
class DoubtComponent:
    source: Literal["multiplicity", "ambiguity", "data_sparsity", "missing_inputs", "model_skill"]
    level: Level
    value: float | None
    detail: str
    action: str
    provenance: Provenance


def _imaging_columns(columns: list[str]) -> list[str]:
    picked=[]
    for name in columns:
        try:
            parsed=parse_feature_name(name)
        except ValueError:
            continue
        if parsed.kind!="missing_flag":
            picked.append(name)
    return sorted(picked)


class CohortReference:
    """Training-split imaging features, scaled, for nearest-neighbour distances."""

    def __init__(self, train_rows: dict[str, dict]):
        self.patient_ids=list(train_rows)
        first=next(iter(train_rows.values()))
        self.columns=_imaging_columns(list(first))
        raw=np.array(
            [[_number(train_rows[p].get(c)) for c in self.columns] for p in self.patient_ids], dtype=float,
        )
        self.median=np.nanmedian(raw, axis=0)
        q75, q25=np.nanpercentile(raw, [75, 25], axis=0)
        scale=q75-q25
        scale[~np.isfinite(scale) | (scale==0)]=1.0
        self.scale=scale
        self.matrix=self._scale(raw)
        self.loo_distances=np.sort(self._kth_distances(self.matrix))

    def _scale(self, raw: np.ndarray) -> np.ndarray:
        filled=np.where(np.isnan(raw), self.median, raw)
        z=(filled-self.median)/self.scale
        return np.nan_to_num(np.clip(z, -Z_CLIP, Z_CLIP))

    def _kth_distances(self, matrix: np.ndarray) -> np.ndarray:
        distances=np.sqrt(((matrix[:, None, :]-self.matrix[None, :, :])**2).sum(axis=2))
        np.fill_diagonal(distances, np.inf)  # leave each training patient out of its own neighbours
        return np.sort(distances, axis=1)[:, K_NEIGHBOURS-1]

    def percentile(self, features: dict[str, float | None], patient_id: str | None) -> float:
        """Share of training patients that sit closer to their own neighbours than this patient does."""
        row=np.array([[_number(features.get(c)) for c in self.columns]], dtype=float)
        z=self._scale(row)
        distances=np.sqrt(((self.matrix-z)**2).sum(axis=1))
        if patient_id in self.patient_ids:
            distances[self.patient_ids.index(patient_id)]=np.inf
        kth=float(np.sort(distances)[K_NEIGHBOURS-1])
        return float(np.searchsorted(self.loo_distances, kth, side="right")/len(self.loo_distances))


def _number(value: object) -> float:
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return float("nan")


def decompose(
    prediction: SetPrediction,
    low_signal: bool,
    skill: float | None,
    vector: FeatureVector,
    reference: CohortReference | None,
    patient_id: str | None,
) -> list[DoubtComponent]:
    components=[]

    agreement, spread=prediction.agreement, iqr(prediction.model_probabilities)
    verdict_levels: dict[StabilityVerdict, Level]={
        StabilityVerdict.STABLE: "low",
        StabilityVerdict.CONTESTED: "medium",
        StabilityVerdict.ARBITRARY: "high",
    }
    level: Level=verdict_levels[prediction.verdict]
    components.append(DoubtComponent(
        source="multiplicity", level=level, value=round(1.0-agreement, 4),
        detail=f"{round(agreement*prediction.n_models)} of {prediction.n_models} equally good models agree; "
        f"their probabilities span an interquartile range of {spread:.2f}.",
        action="Confirm with tissue testing: equally good models disagree on this patient.",
        provenance=Provenance.MODEL_INFERRED,
    ))

    margin=abs(prediction.prob_median-prediction.decision_threshold)
    level="high" if margin<0.1 else "medium" if margin<0.2 else "low"
    components.append(DoubtComponent(
        source="ambiguity", level=level, value=round(margin, 4),
        detail=f"Median probability {prediction.prob_median:.2f} is {margin:.2f} from the decision boundary "
        f"({prediction.decision_threshold:.2f}).",
        action="Confirm with tissue testing: the imaging evidence sits on the boundary between results.",
        provenance=Provenance.MODEL_INFERRED,
    ))

    if reference is None:
        components.append(DoubtComponent(
            source="data_sparsity", level="unknown", value=None,
            detail="No training cohort is loaded, so similarity to training patients is unmeasured.",
            action="Treat the output with the usual caution.", provenance=Provenance.REFERENCE_COHORT,
        ))
    else:
        pct=reference.percentile(vector.features, patient_id)
        level="high" if pct>=0.99 else "medium" if pct>=0.95 else "low"
        components.append(DoubtComponent(
            source="data_sparsity", level=level, value=round(pct, 4),
            detail=f"This tumor is further from its nearest training patients than {pct:.0%} of the training "
            "cohort is from theirs.",
            action="Do not rely on the AI here; refer for expert review: the tumor is unlike training cases.",
            provenance=Provenance.REFERENCE_COHORT,
        ))

    REGION_NAMES={"et": "enhancing tumor (et)", "ncr": "necrotic core (ncr)", "ed": "edema (ed)"}
    missing=vector.missing_inputs()
    sequences_missing=[m for m in missing if m in {"t1", "t1ce", "t2", "flair", "adc", "asl"}]
    regions_missing=[REGION_NAMES.get(m, m) for m in missing if m in REGION_NAMES]
    level="high" if sequences_missing else "medium" if missing else "low"
    if sequences_missing:
        detail=f"Missing: {', '.join(missing)}."
        action=f"Supply the missing input ({', '.join(sequences_missing)}) and re-run."
    elif regions_missing:
        detail=f"Absent tumor sub-region in mask: {', '.join(regions_missing)} (features imputed to cohort median)."
        action="Verify segmentation mask; absence of necrosis or enhancement may reflect tumor biology rather than missing data."
    else:
        detail="All expected MRI inputs are present."
        action="No action needed."
    components.append(DoubtComponent(
        source="missing_inputs", level=level, value=float(len(missing)),
        detail=detail,
        action=action,
        provenance=Provenance.MISSING if missing else Provenance.CLINICAL_INPUT,
    ))

    if skill is None:
        components.append(DoubtComponent(
            source="model_skill", level="unknown", value=None,
            detail="The model set does not report how much better than guessing it is.",
            action="Treat the output with the usual caution.", provenance=Provenance.MODEL_INFERRED,
        ))
    else:
        level="high" if low_signal else "low"
        components.append(DoubtComponent(
            source="model_skill", level=level, value=round(skill, 4),
            detail=f"The best model is {max(skill, 0.0):.0%} better than guessing from how common each "
            "result is.",
            action="Imaging cannot decide this marker: confirm with tissue testing." if low_signal
            else "No action needed.",
            provenance=Provenance.MODEL_INFERRED,
        ))
    return components


def primary(components: list[DoubtComponent]) -> DoubtComponent | None:
    """The strongest reason for doubt, or None when every measured source is low."""
    worst=max(components, key=lambda c: LEVEL_ORDER[c.level])
    return worst if LEVEL_ORDER[worst.level]>=LEVEL_ORDER["medium"] else None
