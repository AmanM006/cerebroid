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
from app.domain.contracts import ProvenancedValue


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


class CaseList(_Response):
    items: list[CaseOut]
    total: int
    limit: int
    offset: int
