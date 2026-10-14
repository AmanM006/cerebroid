"""Shared types between the ML track and the API track.

Everything that crosses the boundary between a marker plugin and the API is
one of these models. Changing a field here changes the contract for both
tracks, so changes go through the integration owner (CLAUDE.md §9A).

Models are frozen and reject unknown fields, so a typo in a field name is an
error instead of a silently dropped value.
"""
import re
import statistics
from enum import Enum
from typing import Literal, Protocol, runtime_checkable

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator


class Provenance(str, Enum):
    """Where a value came from. Every value shown to a user carries one."""

    CLINICAL_INPUT="clinical_input"
    MEASURED="measured"
    MODEL_INFERRED="model_inferred"
    REFERENCE_COHORT="reference_cohort"
    MISSING="missing"
    SYNTHETIC="synthetic"


class Marker(str, Enum):
    IDH="IDH"
    CODEL_1P19Q="1p19q"
    MGMT="MGMT"
    GRADE="GRADE"


# (label when the binary target is 1, label when it is 0)
MARKER_LABELS: dict[Marker, tuple[str, str]]={
    Marker.IDH: ("mutant", "wildtype"),
    Marker.CODEL_1P19Q: ("codeleted", "intact"),
    Marker.MGMT: ("methylated", "unmethylated"),
    Marker.GRADE: ("grade 4", "grade 2-3"),
}


class Sex(str, Enum):
    MALE="M"
    FEMALE="F"


class Sequence(str, Enum):
    """MRI inputs. The first four show anatomy; ADC and ASL show tissue physiology."""

    T1="t1"
    T1CE="t1ce"
    T2="t2"
    FLAIR="flair"
    ADC="adc"  # diffusion: how densely packed the cells are
    ASL="asl"  # perfusion: how much blood reaches the tissue


class Region(str, Enum):
    ENHANCING="et"
    NECROTIC_CORE="ncr"
    EDEMA="ed"


class StabilityVerdict(str, Enum):
    STABLE="STABLE"
    CONTESTED="CONTESTED"
    ARBITRARY="ARBITRARY"


# --- feature column naming ---------------------------------------------------
# Radiomics:   {sequence}__{region}__{featureclass}__{feature}  e.g. t1ce__et__glcm__Contrast
# Shape:       shape__{region}__shape__{feature}                  (sequence-independent)
# Descriptor:  desc__{name}                                       e.g. desc__enhancing_fraction
# Missing:     missing__{sequence|region}                         1.0 when that input is absent
# age and sex are not feature columns; they live on FeatureVector directly.

_SEQ="|".join(s.value for s in Sequence)
_REG="|".join(r.value for r in Region)
_RADIOMIC_RE=re.compile(rf"^({_SEQ}|shape)__({_REG})__([a-z0-9]+)__([A-Za-z0-9_]+)$")
_DESCRIPTOR_RE=re.compile(r"^desc__[a-z0-9_]+$")
_MISSING_RE=re.compile(rf"^missing__({_SEQ}|{_REG})$")


class FeatureName(BaseModel):
    """A parsed feature column name, used to group features for explanations."""

    model_config=ConfigDict(extra="forbid", frozen=True)

    kind: Literal["radiomic", "descriptor", "missing_flag"]
    sequence: Sequence | None=None
    region: Region | None=None
    feature_class: str | None=None
    feature: str

    @property
    def group(self) -> str:
        """Evidence group for grouped SHAP: sequence x region x feature class."""
        if self.kind=="radiomic":
            seq=self.sequence.value if self.sequence else "shape"
            region=self.region.value if self.region else ""
            return f"{seq}__{region}__{self.feature_class}"
        return self.kind


def parse_feature_name(name: str) -> FeatureName:
    if m:=_RADIOMIC_RE.match(name):
        seq, region, feature_class, feature=m.groups()
        return FeatureName(
            kind="radiomic",
            sequence=None if seq=="shape" else Sequence(seq),
            region=Region(region),
            feature_class=feature_class,
            feature=feature,
        )
    if _DESCRIPTOR_RE.match(name):
        return FeatureName(kind="descriptor", feature=name.removeprefix("desc__"))
    if _MISSING_RE.match(name):
        return FeatureName(kind="missing_flag", feature=name.removeprefix("missing__"))
    raise ValueError(f"feature name does not follow the naming convention: {name!r}")


# Model input columns for the clinical inputs. Models see sex as a number.
CLINICAL_COLUMNS=("age", "sex")
SEX_ENCODING: dict[Sex, float]={Sex.MALE: 1.0, Sex.FEMALE: 0.0}

# A marker result the clinician already has from the lab is a model input named
# known__<marker> (1.0 = positive class, 0.0 = negative), e.g. known__idh.
KNOWN_PREFIX="known__"


def known_column(marker: Marker) -> str:
    return f"{KNOWN_PREFIX}{marker.value.lower()}"


def known_marker_of(column: str) -> Marker | None:
    """The marker behind a known__ column, or None if the column isn't one."""
    for marker in Marker:
        if column==known_column(marker):
            return marker
    return None


def validate_model_column(name: str) -> None:
    """A trained model may use the clinical columns, known lab results and convention-named features."""
    if name in CLINICAL_COLUMNS or known_marker_of(name) is not None:
        return
    parse_feature_name(name)


# --- core contract models ------------------------------------------------------

class _Contract(BaseModel):
    model_config=ConfigDict(extra="forbid", frozen=True)


class ProvenancedValue(_Contract):
    """A single displayable value; it cannot exist without a provenance."""

    value: float | int | str | None
    provenance: Provenance


class FeatureVector(_Contract):
    """Everything a marker plugin is allowed to see about one study.

    age and sex are the only clinical inputs (CLAUDE.md §3 leakage rules);
    there is deliberately no field for grade, pathology, treatment or outcome.
    A feature value of None means missing, never zero.

    known_markers holds lab results the clinician already has (1 = positive
    class, 0 = negative). A known marker is never predicted; it can only inform
    the prediction of the other markers.
    """

    study_id: str=Field(min_length=1, max_length=64)
    age: int=Field(ge=18, le=100)
    sex: Sex
    features: dict[str, float | None]
    known_markers: dict[Marker, Literal[0, 1]]=Field(default_factory=dict)

    @field_validator("features")
    @classmethod
    def _names_follow_convention(cls, features: dict[str, float | None]) -> dict[str, float | None]:
        for name in features:
            parse_feature_name(name)
        return features

    def missing_inputs(self) -> list[str]:
        return sorted(
            name.removeprefix("missing__")
            for name, value in self.features.items()
            if name.startswith("missing__") and value==1.0
        )


class SetPrediction(_Contract):
    """Output of the whole near-optimal model set for one marker on one study.

    Summary statistics are computed from the per-model probabilities instead
    of being passed in, so they can never disagree with the underlying votes.
    The verdict is supplied by the multiplicity engine, because its thresholds
    are chosen on cross-validation data (CLAUDE.md §2.4 item 2).
    """

    marker: Marker
    model_probabilities: list[float]=Field(min_length=1)
    decision_threshold: float=Field(default=0.5, gt=0.0, lt=1.0)
    verdict: StabilityVerdict
    model_version: str=Field(min_length=1)
    provenance: Literal[Provenance.MODEL_INFERRED]=Provenance.MODEL_INFERRED

    @field_validator("model_probabilities")
    @classmethod
    def _probabilities_in_unit_interval(cls, probs: list[float]) -> list[float]:
        for p in probs:
            if not 0.0<=p<=1.0:
                raise ValueError(f"probability outside [0, 1]: {p}")
        return probs

    @computed_field  # type: ignore[prop-decorator]
    @property
    def n_models(self) -> int:
        return len(self.model_probabilities)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def positive_fraction(self) -> float:
        votes=sum(1 for p in self.model_probabilities if p>=self.decision_threshold)
        return votes/self.n_models

    @computed_field  # type: ignore[prop-decorator]
    @property
    def call(self) -> str:
        positive, negative=MARKER_LABELS[self.marker]
        return positive if self.positive_fraction>=0.5 else negative

    @computed_field  # type: ignore[prop-decorator]
    @property
    def agreement(self) -> float:
        """Fraction of models that agree with the majority call."""
        return max(self.positive_fraction, 1.0-self.positive_fraction)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def prob_min(self) -> float:
        return min(self.model_probabilities)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def prob_median(self) -> float:
        return statistics.median(self.model_probabilities)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def prob_max(self) -> float:
        return max(self.model_probabilities)


class EvidenceItem(_Contract):
    """One group of inputs and how it pushed a marker's prediction.

    weight is the mean absolute grouped-SHAP contribution across the model
    set; agreement is how consistently set members rank this group (None when
    only one model contributed).
    """

    evidence_id: str=Field(min_length=1)
    marker: Marker
    group: str=Field(min_length=1)
    direction: Literal["toward_positive", "toward_negative"]
    weight: float=Field(ge=0.0)
    agreement: float | None=Field(default=None, ge=0.0, le=1.0)
    provenance: Provenance


@runtime_checkable
class MarkerPredictor(Protocol):
    """One plugin per marker, registered via ml/configs/markers.yaml."""

    marker: Marker

    def required_inputs(self) -> set[str]: ...

    def predict_set(self, features: FeatureVector) -> SetPrediction: ...

    def explain(self, features: FeatureVector) -> list[EvidenceItem]: ...
