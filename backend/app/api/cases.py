"""Cases a signed-in user may open: public demo cases plus their own uploads."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import accessible_studies, get_accessible_study, get_current_user
from app.api.schemas import CaseList, CaseOut
from app.db.models import Study, User
from app.db.session import get_db
from app.domain.contracts import Provenance, ProvenancedValue

router=APIRouter(prefix="/api/v1/cases", tags=["cases"])


def _to_case_out(study: Study) -> CaseOut:
    return CaseOut(
        id=study.id,
        kind=study.kind,
        label=study.label,
        age=ProvenancedValue(value=study.age, provenance=Provenance.CLINICAL_INPUT),
        sex=ProvenancedValue(value=study.sex, provenance=Provenance.CLINICAL_INPUT),
        status=study.status,
        created_at=study.created_at,
    )


@router.get("")
def list_cases(
    limit: int=Query(default=50, ge=1, le=100),
    offset: int=Query(default=0, ge=0, le=10_000),
    user: User=Depends(get_current_user),
    db: Session=Depends(get_db),
) -> CaseList:
    query=accessible_studies(user)
    total=db.scalar(select(func.count()).select_from(query.subquery())) or 0
    studies=db.scalars(query.order_by(Study.created_at.desc(), Study.id).limit(limit).offset(offset)).all()
    return CaseList(items=[_to_case_out(s) for s in studies], total=total, limit=limit, offset=offset)


@router.get("/{study_id}")
def get_case(study: Study=Depends(get_accessible_study)) -> CaseOut:
    return _to_case_out(study)
