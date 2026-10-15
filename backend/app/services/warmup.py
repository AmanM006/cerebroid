"""Background warm-up: computes every demo case's default profiles once after start-up.

On a small shared CPU one profile takes seconds; computing them before anyone asks means
the first viewer gets the cached result. Runs in a daemon thread so start-up and /health
are never delayed, and any failure is logged and ignored (the endpoint computes on demand).
"""
import threading
import time

import structlog
from sqlalchemy import select

from app.db.models import Study, StudyKind
from app.db.session import get_session_factory
from app.domain.feature_store import FeatureStore
from app.domain.profile import build_profile
from app.domain.registry import FUSED, MarkerRegistry

logger=structlog.get_logger("warmup")


def _warm(registry: MarkerRegistry, store: FeatureStore) -> None:
    started=time.perf_counter()
    try:
        with get_session_factory()() as db:
            studies=db.scalars(select(Study).where(Study.kind==StudyKind.DEMO)).all()
        demo=[s for s in studies if s.source_patient_id and store.has(s.source_patient_id)]
        # Only the default view: it loads the same model sets as one viewer opening one case,
        # so the warm-up never raises memory above normal use (the host has 512 MB).
        jobs=[(s, FUSED, {}) for s in demo]
        for study, view, known in jobs:
            vector=store.vector_for(
                patient_id=study.source_patient_id, study_id=str(study.id), age=study.age,
                sex=study.sex, prior_biopsy=study.prior_biopsy, known_markers=known,
            )
            build_profile(registry, vector, view)
        logger.info("warmup_done", profiles=len(jobs), seconds=round(time.perf_counter()-started, 1))
    except Exception as exc:  # noqa: BLE001 - warm-up is best-effort
        logger.warning("warmup_failed", error=type(exc).__name__)


def start(registry: MarkerRegistry, store: FeatureStore) -> None:
    threading.Thread(target=_warm, args=(registry, store), name="profile-warmup", daemon=True).start()
