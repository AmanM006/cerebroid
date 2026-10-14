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


class CaseList(_Response):
    items: list[CaseOut]
    total: int
    limit: int
    offset: int
