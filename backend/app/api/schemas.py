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


class ProfileOut(_Response):
    study_id: uuid.UUID
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
