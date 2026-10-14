"""Per-study inference routes. Access goes through get_accessible_study (anti-IDOR)."""
import hashlib
import json
import re
import time

from fastapi import APIRouter, Depends, Query, Request, status

from app.api.deps import get_accessible_study, get_feature_store, get_registry
from app.api.schemas import (
    KnownMarkerIn,
    MarkerProfileOut,
    ProfileInputs,
    ProfileOut,
    RevealOut,
    TrueResultOut,
)
from app.core.errors import AppError
from app.db.models import Study, StudyKind
from app.domain.contracts import Marker, Provenance, ProvenancedValue
from app.domain.feature_store import FeatureStore
from app.domain.profile import MarkerResult, build_profile, known_label
from app.domain.registry import MarkerRegistry, variant_label

router=APIRouter(prefix="/api/v1/studies", tags=["studies"])

_KNOWN_RE=re.compile(r"^(IDH|1p19q|MGMT|GRADE):([01])$")


def _parse_known(values: list[str]) -> dict[Marker, int]:
    known: dict[Marker, int]={}
    for raw in values:
        m=_KNOWN_RE.match(raw)
        if m is None:
            raise AppError(
                "INVALID_KNOWN_MARKER",
                "known must look like IDH:1 (IDH, 1p19q, MGMT or GRADE; 1 positive, 0 negative).",
                status.HTTP_422_UNPROCESSABLE_CONTENT,
            )
        marker=Marker(m.group(1))
        if marker in known:
            raise AppError(
                "INVALID_KNOWN_MARKER",
                f"{marker.value} was given more than once.",
                status.HTTP_422_UNPROCESSABLE_CONTENT,
            )
        known[marker]=int(m.group(2))
    return known


def _clinical(value: object) -> ProvenancedValue:
    if value is None:
        return ProvenancedValue(value=None, provenance=Provenance.MISSING)
    return ProvenancedValue(value=value, provenance=Provenance.CLINICAL_INPUT)  # type: ignore[arg-type]


def _marker_out(result: MarkerResult) -> MarkerProfileOut:
    if result.status=="known":
        return MarkerProfileOut(
            marker=result.marker, status="known", call=result.call,
            provenance=Provenance.CLINICAL_INPUT, evidence_ids=[],
        )
    if result.status=="unavailable" or result.prediction is None:
        return MarkerProfileOut(
            marker=result.marker, status="unavailable", call=None,
            provenance=Provenance.MISSING, evidence_ids=[], reason=result.reason,
        )
    p=result.prediction
    return MarkerProfileOut(
        marker=result.marker,
        status="predicted",
        call=p.call,
        provenance=p.provenance,
        evidence_ids=[],
        verdict=p.verdict,
        variant=result.variant,
        n_models=p.n_models,
        agreement=round(p.agreement, 4),
        prob_min=round(p.prob_min, 4),
        prob_median=round(p.prob_median, 4),
        prob_max=round(p.prob_max, 4),
        model_version=p.model_version,
        imaging_only_call=result.imaging_only.call if result.imaging_only else None,
        imaging_only_verdict=result.imaging_only.verdict if result.imaging_only else None,
        resolved_by_combining=result.resolved_by_combining,
    )


@router.get("/{study_id}/profile")
def get_profile(
    request: Request,
    known: list[str]=Query(default=[], max_length=4, description="Lab results already known, e.g. IDH:1"),
    study: Study=Depends(get_accessible_study),
    registry: MarkerRegistry=Depends(get_registry),
    store: FeatureStore=Depends(get_feature_store),
) -> ProfileOut:
    started=time.perf_counter()
    known_markers=_parse_known(known)

    if not store.has(study.source_patient_id) or store.version is None:
        raise AppError(
            "FEATURES_NOT_READY",
            "Imaging features for this study are not available yet.",
            status.HTTP_409_CONFLICT,
        )
    vector=store.vector_for(
        patient_id=study.source_patient_id,  # type: ignore[arg-type]
        study_id=str(study.id),
        age=study.age,
        sex=study.sex,
        prior_biopsy=study.prior_biopsy,
        known_markers=known_markers,
    )
    results=build_profile(registry, vector)

    canonical=json.dumps(vector.model_dump(mode="json"), sort_keys=True, separators=(",", ":"))
    biopsy=None if study.prior_biopsy is None else ("yes" if study.prior_biopsy else "no")
    return ProfileOut(
        study_id=study.id,
        inputs=ProfileInputs(
            age=_clinical(study.age),
            sex=_clinical(study.sex),
            prior_biopsy=_clinical(biopsy),
            known_markers=[
                KnownMarkerIn(marker=m, value=_clinical(known_label(m, v))) for m, v in known_markers.items()
            ],
        ),
        missing_inputs=vector.missing_inputs(),
        markers=[_marker_out(r) for r in results],
        model_versions={
            variant_label(r.marker, r.variant): r.prediction.model_version
            for r in results if r.prediction is not None and r.variant is not None
        },
        feature_pipeline_version=store.version,
        input_hash="sha256:"+hashlib.sha256(canonical.encode()).hexdigest(),
        request_id=getattr(request.state, "request_id", None),
        latency_ms=round((time.perf_counter()-started)*1000, 2),
    )


# Feature-table column holding each marker's lab label.
_LABEL_COLUMN={
    Marker.IDH: "idh",
    Marker.CODEL_1P19Q: "codeletion_1p19q",
    Marker.MGMT: "mgmt",
    Marker.GRADE: "who_grade",
}


def _true_label(marker: Marker, raw: object) -> str | None:
    if raw is None or raw!=raw:  # missing or NaN
        return None
    if marker==Marker.GRADE:
        return known_label(marker, 1 if float(raw)==4 else 0)  # type: ignore[arg-type]
    return known_label(marker, int(raw))  # type: ignore[call-overload]


@router.get("/{study_id}/reveal")
def reveal(
    study: Study=Depends(get_accessible_study),
    store: FeatureStore=Depends(get_feature_store),
) -> RevealOut:
    """True lab results for demo cases only; kept out of /profile so they can never feed a prediction."""
    if study.kind!=StudyKind.DEMO or not store.has(study.source_patient_id):
        raise AppError(
            "NO_GROUND_TRUTH", "No lab results are available for this study.", status.HTTP_409_CONFLICT,
        )
    row=store.rows[study.source_patient_id]  # type: ignore[index]
    results=[]
    for marker in Marker:
        label=_true_label(marker, row.get(_LABEL_COLUMN[marker]))
        provenance=Provenance.MISSING if label is None else Provenance.MEASURED
        value=ProvenancedValue(value=label, provenance=provenance)
        results.append(TrueResultOut(marker=marker, value=value))
    return RevealOut(study_id=study.id, results=results)
