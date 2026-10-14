"""Request and response bodies for the public API.

Requests reject unknown fields (no mass assignment) and cap every string.
Responses use ProvenancedValue for anything shown as patient data, so a
clinical value can't be returned without saying where it came from.
"""
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.db.models import Role, StudyKind, StudyStatus
from app.domain.contracts import Marker, Provenance, ProvenancedValue, StabilityVerdict
from app.domain.volume_store import Sequence


class _Request(BaseModel):
    model_config=ConfigDict(extra="forbid", strict=True)


class _Response(BaseModel):
    model_config=ConfigDict(extra="forbid")


class LoginRequest(_Request):
    username: str=Field(min_length=1, max_length=64)
    password: str=Field(min_length=1, max_length=256)


class TokenResponse(_Response):
    access_token: str
    token_type: Literal["bearer"]="bearer"
    expires_in: int


class UserOut(_Response):
    id: uuid.UUID
    username: str
    role: Role
    is_synthetic: bool


class CaseOut(_Response):
    id: uuid.UUID
    kind: StudyKind
    label: str
    age: ProvenancedValue
    sex: ProvenancedValue
    status: StudyStatus
    created_at: datetime


class KnownMarkerIn(_Response):
    marker: Marker
    value: ProvenancedValue


class ProfileInputs(_Response):
    age: ProvenancedValue
    sex: ProvenancedValue
    prior_biopsy: ProvenancedValue
    known_markers: list[KnownMarkerIn]


class MarkerProfileOut(_Response):
    """One marker on the profile card. provenance and evidence_ids are required,
    so a claim without them cannot be serialized (CLAUDE.md §4.4)."""

    marker: Marker
    status: Literal["known", "predicted", "unavailable"]
    call: str | None
    provenance: Provenance
    evidence_ids: list[str]
    verdict: StabilityVerdict | None=None
    variant: str | None=None
    n_models: int | None=None
    agreement: float | None=None
    prob_min: float | None=None
    prob_median: float | None=None
    prob_max: float | None=None
    model_version: str | None=None
    reason: str | None=None
    imaging_only_call: str | None=None
    imaging_only_verdict: StabilityVerdict | None=None
    resolved_by_combining: bool=False
    # Relative CV log-loss gain over guessing the base rate; low_signal means the
    # verdict reflects agreement on the prior, not evidence, so tissue testing is needed.
    skill: float | None=None
    low_signal: bool=False


class EvidenceItemOut(_Response):
    """One evidence group for one marker; provenance is required (CLAUDE.md §4.4)."""

    evidence_id: str
    group: str
    label: str
    direction: Literal["toward_positive", "toward_negative"]
    supports_call: bool
    weight: float
    agreement: float | None
    n_columns: int
    provenance: Provenance


class EvidenceOut(_Response):
    study_id: uuid.UUID
    input_hash: str
    marker: Marker
    variant: str
    call: str
    low_signal: bool
    method: str
    reference: ProvenancedValue
    explanation_agreement: float | None
    items: list[EvidenceItemOut]
    model_version: str
    request_id: str | None
    latency_ms: float


class DoubtComponentOut(_Response):
    source: Literal["multiplicity", "ambiguity", "data_sparsity", "missing_inputs", "model_skill"]
    level: Literal["low", "medium", "high", "unknown"]
    value: float | None
    detail: str
    action: str
    provenance: Provenance


class DoubtOut(_Response):
    study_id: uuid.UUID
    input_hash: str
    marker: Marker
    variant: str
    call: str
    verdict: StabilityVerdict
    primary_source: str | None
    recommended_action: str
    components: list[DoubtComponentOut]
    model_version: str
    request_id: str | None
    latency_ms: float


class CurvePointOut(_Response):
    value: float
    positive_fraction: float
    prob_median: float


class TippingItemOut(_Response):
    """How far one clinician-verifiable input would have to move to flip the call."""

    input: str
    label: str
    unit: str
    current: float
    flip_at: float | None
    flips_to: str | None
    curve: list[CurvePointOut]
    provenance: Provenance


class TippingOut(_Response):
    study_id: uuid.UUID
    input_hash: str
    marker: Marker
    variant: str
    call: str
    method: str
    items: list[TippingItemOut]
    model_version: str
    request_id: str | None
    latency_ms: float


class ClaimOut(_Response):
    """One templated statement; provenance and evidence_ids are required (CLAUDE.md §4.4)."""

    short: str
    text: str
    evidence_ids: list[str]=Field(min_length=1)
    provenance: Provenance


class FalsificationOut(_Response):
    study_id: uuid.UUID
    input_hash: str
    marker: Marker
    variant: str
    call: str
    verdict: StabilityVerdict
    supporting: list[ClaimOut]
    contradicting: list[ClaimOut]
    competing: ClaimOut
    overturn: list[ClaimOut]
    confirmatory_test: str
    model_version: str
    request_id: str | None
    latency_ms: float


class MarkerStateOut(_Response):
    marker: Marker
    value: str | None
    settled: bool
    from_lab: bool
    reason: str
    provenance: Provenance


class TestSuggestionOut(_Response):
    marker: Marker
    test: str
    settled: bool
    remaining_worst_case: int | None
    reason: str


class NextMeasurementsOut(_Response):
    study_id: uuid.UUID
    input_hash: str
    label: Literal["decision-support heuristic"]
    marker_states: list[MarkerStateOut]
    candidate_categories: list[str]
    tests: list[TestSuggestionOut]
    request_id: str | None


class ProfileOut(_Response):
    study_id: uuid.UUID
    view: Literal["fused", "imaging_only", "clinical_only"]
    inputs: ProfileInputs
    missing_inputs: list[str]
    markers: list[MarkerProfileOut]
    model_versions: dict[str, str]
    feature_pipeline_version: str
    input_hash: str
    request_id: str | None
    latency_ms: float


class TrueResultOut(_Response):
    marker: Marker
    value: ProvenancedValue


class RevealOut(_Response):
    """The dataset's lab results for a held-out demo case, for checking predictions."""

    study_id: uuid.UUID
    results: list[TrueResultOut]


class CaseList(_Response):
    items: list[CaseOut]
    total: int
    limit: int
    offset: int


class VolumesOut(_Response):
    """Which MRI volumes the viewer can load for a study."""

    study_id: uuid.UUID
    sequences: list[Sequence]


class AuditVerifyOut(_Response):
    valid: bool
    entries: int
    first_invalid_seq: int | None
    head_hash: str


class ModelSetCardOut(_Response):
    marker: Marker
    variant: str
    model_version: str
    n_models: int
    families: list[str]
    epsilon: float
    best_cv_log_loss: float
    baseline_log_loss: float | None
    skill: float | None
    low_signal: bool
    verdict_thresholds: dict[str, float]
    feature_count: int
    library_versions: dict[str, str]
    # Test-split results from ml/pipeline/evaluate.py, shown only for the exact deployed model file.
    held_out: dict | None
    held_out_stale: bool


class ModelCardOut(_Response):
    intended_use: str
    disclaimer: str
    data_source: str
    cohort: dict[str, int]
    feature_pipeline_version: str | None
    held_out_patients: int | None
    model_sets: list[ModelSetCardOut]
    limitations: list[str]
    request_id: str | None
