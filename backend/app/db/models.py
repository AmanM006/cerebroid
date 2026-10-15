"""Database tables.

Privacy rules: no direct identifiers anywhere. Users are
pseudonymous usernames; studies hold only age (integer) and sex, never names,
dates of birth or hospital IDs. All primary keys are random UUIDv4 so IDs
can't be guessed or enumerated.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Role(str, enum.Enum):
    CLINICIAN="clinician"
    REVIEWER="reviewer"


class StudyKind(str, enum.Enum):
    DEMO="demo"      # public held-out case, visible to every signed-in user
    UPLOAD="upload"  # visible only to its owner


class StudyStatus(str, enum.Enum):
    PENDING="pending"
    PROCESSING="processing"
    READY="ready"
    FAILED="failed"


def _enum(e: type[enum.Enum], name: str) -> Enum:
    return Enum(e, name=name, values_callable=lambda members: [m.value for m in members])


class User(Base):
    __tablename__="users"

    id: Mapped[uuid.UUID]=mapped_column(primary_key=True, default=uuid.uuid4)
    username: Mapped[str]=mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str]=mapped_column(String(255))
    role: Mapped[Role]=mapped_column(_enum(Role, "user_role"))
    is_active: Mapped[bool]=mapped_column(Boolean, default=True)
    is_synthetic: Mapped[bool]=mapped_column(Boolean, default=False)
    failed_login_count: Mapped[int]=mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None]=mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), server_default=func.now())


class RefreshToken(Base):
    """A refresh token is stored only as its SHA-256 hash.

    Tokens issued from the same login share a family_id. Rotation revokes the
    old token and links it to its replacement; presenting an already-rotated
    token means it was stolen or replayed, so the whole family is revoked.
    """

    __tablename__="refresh_tokens"

    id: Mapped[uuid.UUID]=mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID]=mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    family_id: Mapped[uuid.UUID]=mapped_column(index=True)
    token_hash: Mapped[str]=mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime]=mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None]=mapped_column(DateTime(timezone=True))
    replaced_by_id: Mapped[uuid.UUID | None]=mapped_column(ForeignKey("refresh_tokens.id"))
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), server_default=func.now())


class Study(Base):
    """One imaging study: a public demo case or a user's own upload."""

    __tablename__="studies"
    __table_args__=(
        CheckConstraint("age BETWEEN 18 AND 100", name="ck_studies_age_range"),
        CheckConstraint("sex IN ('M', 'F')", name="ck_studies_sex"),
        CheckConstraint(
            "(kind = 'demo' AND owner_id IS NULL) OR (kind = 'upload' AND owner_id IS NOT NULL)",
            name="ck_studies_owner_matches_kind",
        ),
        UniqueConstraint("source_patient_id", name="uq_studies_source_patient_id"),
    )

    id: Mapped[uuid.UUID]=mapped_column(primary_key=True, default=uuid.uuid4)
    kind: Mapped[StudyKind]=mapped_column(_enum(StudyKind, "study_kind"))
    owner_id: Mapped[uuid.UUID | None]=mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    label: Mapped[str]=mapped_column(String(64))
    age: Mapped[int]=mapped_column(Integer)
    sex: Mapped[str]=mapped_column(String(1))
    prior_biopsy: Mapped[bool | None]=mapped_column(Boolean)
    # Demo cases only: the public dataset's pseudonymous patient ID, used to look up
    # that patient's extracted features in artifacts/features/features.parquet.
    source_patient_id: Mapped[str | None]=mapped_column(String(32))
    status: Mapped[StudyStatus]=mapped_column(_enum(StudyStatus, "study_status"), default=StudyStatus.PENDING)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), server_default=func.now())


class AuditEntry(Base):
    """One tamper-evident audit record.

    hash=sha256 over this row's fields and the previous row's hash, so editing,
    deleting or reordering any row breaks every hash after it. Rows hold IDs
    and action names only, never clinical values.
    """

    __tablename__="audit_log"

    seq: Mapped[int]=mapped_column(Integer, primary_key=True, autoincrement=False)
    ts: Mapped[datetime]=mapped_column(DateTime(timezone=True))
    actor_id: Mapped[uuid.UUID | None]=mapped_column(index=True)
    action: Mapped[str]=mapped_column(String(64))
    object_id: Mapped[str | None]=mapped_column(String(64))
    model_version: Mapped[str | None]=mapped_column(String(80))
    prev_hash: Mapped[str]=mapped_column(String(64))
    hash: Mapped[str]=mapped_column(String(64), unique=True)
