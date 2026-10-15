"""Upload a study (four MRI sequences + tumor mask + age/sex), poll its processing, delete it.

The uploaded study then works with every /api/v1/studies/{id}/... analysis route, exactly like a
demo case: the same feature extraction and the same model sets. Only its owner can see it.
"""
import uuid
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, Request, Response, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_accessible_study, get_current_user, get_feature_store, require_role
from app.api.schemas import UploadStatusOut
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.ratelimit import client_ip, hit
from app.db.models import Role, Study, StudyKind, StudyStatus, User
from app.db.session import get_db
from app.domain.feature_store import FeatureStore
from app.ingest.nifti_validate import UploadError
from app.services import uploads

router=APIRouter(prefix="/api/v1/studies", tags=["uploads"])
UPLOAD_PATH="/api/v1/studies"


def _status_out(study: Study, request: Request) -> UploadStatusOut:
    result=uploads.result_of(study.source_patient_id or "") if study.kind==StudyKind.UPLOAD else None
    failed=study.status==StudyStatus.FAILED
    return UploadStatusOut(
        study_id=study.id,
        status=study.status,
        error_code=(result or {}).get("error_code", "EXTRACTION_FAILED") if failed else None,
        message=(result or {}).get("message", "Processing failed or was interrupted.") if failed else None,
        request_id=getattr(request.state, "request_id", None),
    )


@router.post("", status_code=status.HTTP_202_ACCEPTED)
def upload_study(
    request: Request,
    age: int=Form(ge=18, le=100),
    sex: Literal["M", "F"]=Form(),
    t1: UploadFile=File(),
    t1c: UploadFile=File(),
    t2: UploadFile=File(),
    flair: UploadFile=File(),
    seg: UploadFile=File(description="Tumor mask: 1 necrotic core, 2 edema, 4 enhancing tumor"),
    user: User=Depends(require_role(Role.CLINICIAN)),
    db: Session=Depends(get_db),
    store: FeatureStore=Depends(get_feature_store),
) -> UploadStatusOut:
    """Accepts skull-stripped, co-registered NIfTI volumes (.nii or .nii.gz, 40 MB each at most)."""
    settings=get_settings()
    hit("upload", f"{user.id}|{client_ip(request)}", settings.upload_rate_limit,
        settings.upload_rate_window_seconds, "Too many uploads. Please wait and try again.")
    uploads.purge_expired()
    owned=db.scalar(select(func.count()).select_from(Study).where(
        Study.kind==StudyKind.UPLOAD, Study.owner_id==user.id)) or 0
    if owned>=settings.upload_max_per_user:
        raise AppError("UPLOAD_LIMIT", f"At most {settings.upload_max_per_user} uploads are kept per "
                       "account; delete one first.", status.HTTP_409_CONFLICT)

    study_id=uuid.uuid4()
    patient_id=uploads.patient_id_for(study_id)
    try:
        uploads.save_files(patient_id, {"t1": t1.file, "t1c": t1c.file, "t2": t2.file,
                                        "flair": flair.file, "seg": seg.file})
    except UploadError as exc:
        uploads.delete_dir(patient_id)
        status_code=status.HTTP_413_CONTENT_TOO_LARGE if exc.error_code=="UPLOAD_TOO_LARGE" \
            else status.HTTP_422_UNPROCESSABLE_CONTENT
        raise AppError(exc.error_code, exc.message, status_code) from exc

    study=Study(
        id=study_id, kind=StudyKind.UPLOAD, owner_id=user.id,
        label=f"Upload {datetime.now(UTC):%d %b %H:%M} UTC", age=age, sex=sex, prior_biopsy=None,
        source_patient_id=patient_id, status=StudyStatus.PROCESSING,
    )
    db.add(study)
    db.commit()
    uploads.start(study_id, patient_id, store)
    return _status_out(study, request)


@router.get("/{study_id}/status")
def upload_status(request: Request, study: Study=Depends(get_accessible_study)) -> UploadStatusOut:
    return _status_out(study, request)


@router.delete("/{study_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_upload(
    study: Study=Depends(get_accessible_study),
    user: User=Depends(get_current_user),
    db: Session=Depends(get_db),
    store: FeatureStore=Depends(get_feature_store),
) -> Response:
    """Deletes one of the caller's own uploads (files and record). Demo cases cannot be deleted."""
    if study.kind!=StudyKind.UPLOAD or study.owner_id!=user.id:
        raise AppError("FORBIDDEN", "Only your own uploads can be deleted.", status.HTTP_403_FORBIDDEN)
    if study.status==StudyStatus.PROCESSING:
        raise AppError("UPLOAD_BUSY", "This upload is still being processed.", status.HTTP_409_CONFLICT)
    uploads.delete(study)
    store.rows.pop(study.source_patient_id or "", None)
    db.delete(study)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
