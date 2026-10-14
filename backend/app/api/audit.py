"""Reviewer-only check of the hash-chained audit log."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.api.schemas import AuditVerifyOut
from app.db.models import Role, User
from app.db.session import get_db
from app.services.audit import verify

router=APIRouter(prefix="/api/v1/audit", tags=["audit"])


@router.get("/verify")
def verify_chain(
    user: User=Depends(require_role(Role.REVIEWER)),
    db: Session=Depends(get_db),
) -> AuditVerifyOut:
    """Recomputes every entry's hash; any edited, deleted or reordered entry breaks the chain."""
    check=verify(db)
    return AuditVerifyOut(
        valid=check.valid, entries=check.entries, first_invalid_seq=check.first_invalid_seq,
        head_hash=check.head_hash,
    )
