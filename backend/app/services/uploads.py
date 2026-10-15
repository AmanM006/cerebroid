"""Uploaded studies: saving, background processing and retention.

Flow: the API saves the five files under server-chosen names and creates a PROCESSING study. A
background thread runs app.ingest.worker in a separate process, one upload at a time (the host has
512 MB), then marks the study READY and adds its features to the in-memory feature store, or FAILED
with the worker's error code. Uploads are deleted after upload_ttl_hours; on restart, ready uploads
are reloaded from disk and interrupted ones are marked FAILED.

Nothing derived from the client (file names, header text) is stored or logged.
"""
import json
import os
import shutil
import subprocess
import sys
import threading
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import BinaryIO

import structlog
from sqlalchemy import select

from app.core.config import get_settings
from app.db.models import Study, StudyKind, StudyStatus
from app.db.session import get_session_factory
from app.domain.feature_store import FeatureStore
from app.ingest.nifti_validate import MAX_FILE_BYTES, UploadError

logger=structlog.get_logger("uploads")

FILES=("t1", "t1c", "t2", "flair", "seg")
BACKEND_DIR=Path(__file__).resolve().parents[2]
_one_at_a_time=threading.Lock()


def patient_id_for(study_id: uuid.UUID) -> str:
    return f"upload-{study_id.hex[:12]}"


def study_dir(patient_id: str) -> Path:
    return get_settings().uploads_root/patient_id


def save_files(patient_id: str, files: dict[str, BinaryIO]) -> None:
    """Copies each upload to <dir>/raw/<name>, enforcing the per-file size cap while copying."""
    raw=study_dir(patient_id)/"raw"
    raw.mkdir(parents=True, exist_ok=False)
    for name in FILES:
        written=0
        with (raw/name).open("wb") as out:
            while chunk:=files[name].read(1<<20):
                written+=len(chunk)
                if written>MAX_FILE_BYTES:
                    raise UploadError("UPLOAD_TOO_LARGE", f"{name} is larger than the 40 MB limit.")
                out.write(chunk)
        if written==0:
            raise UploadError("NIFTI_INVALID", f"{name} is empty.")


def result_of(patient_id: str) -> dict | None:
    path=study_dir(patient_id)/"result.json"
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _register(store: FeatureStore, patient_id: str) -> bool:
    try:
        features=json.loads((study_dir(patient_id)/"features.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return False
    store.rows[patient_id]={"patient_id": patient_id, **{k: (float("nan") if v is None else v)
                                                            for k, v in features.items()}}
    return True


def _set_status(study_id: uuid.UUID, status: StudyStatus) -> None:
    with get_session_factory()() as db:
        study=db.get(Study, study_id)
        if study is not None:
            study.status=status
            db.commit()


def _run(study_id: uuid.UUID, patient_id: str, store: FeatureStore) -> None:
    settings=get_settings()
    directory=study_dir(patient_id)
    with _one_at_a_time:
        started=datetime.now(UTC)
        env={**os.environ, "OMP_NUM_THREADS": "1", "OPENBLAS_NUM_THREADS": "1",
             "ITK_GLOBAL_DEFAULT_NUMBER_OF_THREADS": "1"}
        try:
            subprocess.run(
                [sys.executable, "-m", "app.ingest.worker", str(directory)],
                cwd=BACKEND_DIR, env=env, timeout=settings.upload_timeout_seconds,
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False,
            )
        except subprocess.TimeoutExpired:
            (directory/"result.json").write_text(json.dumps({
                "status": "failed", "error_code": "EXTRACTION_TIMEOUT",
                "message": "Processing took too long and was stopped.",
            }), encoding="utf-8")
            shutil.rmtree(directory/"raw", ignore_errors=True)
            shutil.rmtree(directory/"work", ignore_errors=True)
        result=result_of(patient_id) or {"status": "failed", "error_code": "EXTRACTION_FAILED"}
        ready=result.get("status")=="ready" and _register(store, patient_id)
        _set_status(study_id, StudyStatus.READY if ready else StudyStatus.FAILED)
        logger.info("upload_processed", study_id=str(study_id), ready=ready,
                    error_code=None if ready else result.get("error_code"),
                    seconds=round((datetime.now(UTC)-started).total_seconds(), 1))


def start(study_id: uuid.UUID, patient_id: str, store: FeatureStore) -> None:
    threading.Thread(target=_run, args=(study_id, patient_id, store), name="upload", daemon=True).start()


def delete_dir(patient_id: str) -> None:
    shutil.rmtree(study_dir(patient_id), ignore_errors=True)


def delete(study: Study) -> None:
    if study.source_patient_id:
        delete_dir(study.source_patient_id)


def purge_expired() -> int:
    """Deletes uploads older than the retention period (database rows and files)."""
    cutoff=datetime.now(UTC)-timedelta(hours=get_settings().upload_ttl_hours)
    with get_session_factory()() as db:
        old=db.scalars(select(Study).where(Study.kind==StudyKind.UPLOAD, Study.created_at<cutoff)).all()
        for study in old:
            delete(study)
            db.delete(study)
        db.commit()
    return len(old)


def restore(store: FeatureStore) -> None:
    """At start-up: reload ready uploads; uploads that were mid-processing or lost their files fail."""
    purge_expired()
    with get_session_factory()() as db:
        for study in db.scalars(select(Study).where(Study.kind==StudyKind.UPLOAD)).all():
            pid=study.source_patient_id
            if study.status==StudyStatus.READY and pid and _register(store, pid):
                continue
            if study.status!=StudyStatus.FAILED:
                study.status=StudyStatus.FAILED
        db.commit()
