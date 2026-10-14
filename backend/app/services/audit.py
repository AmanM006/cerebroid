"""Hash-chained audit log: append under a lock, verify by recomputing.

Each entry's hash covers its sequence number, timestamp, actor, action, object,
model version and the previous entry's hash. A Postgres transaction-level
advisory lock serialises appends, so two requests can never both extend the
same previous hash and fork the chain.
"""
import hashlib
import json
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.db.models import AuditEntry

GENESIS="0"*64
_LOCK_KEY=0x5642580A  # arbitrary constant identifying the audit-log lock


def _digest(seq: int, ts: datetime, actor_id: uuid.UUID | None, action: str, object_id: str | None,
            model_version: str | None, prev_hash: str) -> str:
    payload={
        "seq": seq,
        "ts": ts.astimezone(UTC).isoformat(),
        "actor": None if actor_id is None else str(actor_id),
        "action": action,
        "object": object_id,
        "model_version": model_version,
        "prev_hash": prev_hash,
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def record(
    db: Session, actor_id: uuid.UUID | None, action: str, object_id: str | None=None,
    model_version: str | None=None,
) -> AuditEntry:
    """Append one entry and commit it."""
    bind = db.get_bind()
    if bind is not None and bind.dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": _LOCK_KEY})
    last=db.scalar(select(AuditEntry).order_by(AuditEntry.seq.desc()).limit(1))
    seq=1 if last is None else last.seq+1
    prev_hash=GENESIS if last is None else last.hash
    ts=datetime.now(UTC)
    entry=AuditEntry(
        seq=seq, ts=ts, actor_id=actor_id, action=action, object_id=object_id, model_version=model_version,
        prev_hash=prev_hash, hash=_digest(seq, ts, actor_id, action, object_id, model_version, prev_hash),
    )
    db.add(entry)
    db.commit()
    return entry


@dataclass(frozen=True)
class ChainCheck:
    valid: bool
    entries: int
    first_invalid_seq: int | None
    head_hash: str


def verify(db: Session) -> ChainCheck:
    """Recompute every hash from the start; report the first entry that doesn't match."""
    prev_hash=GENESIS
    expected_seq=1
    count=0
    for entry in db.scalars(select(AuditEntry).order_by(AuditEntry.seq)):
        digest=_digest(
            entry.seq, entry.ts, entry.actor_id, entry.action, entry.object_id, entry.model_version,
            entry.prev_hash,
        )
        if entry.seq!=expected_seq or entry.prev_hash!=prev_hash or entry.hash!=digest:
            return ChainCheck(valid=False, entries=count, first_invalid_seq=entry.seq, head_hash=prev_hash)
        prev_hash=entry.hash
        expected_seq+=1
        count+=1
    return ChainCheck(valid=True, entries=count, first_invalid_seq=None, head_hash=prev_hash)
