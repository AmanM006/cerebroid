"""Per-study inference routes. Access goes through get_accessible_study (anti-IDOR)."""
import hashlib
import json
import re
import time
from typing import Literal

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import FileResponse

from app.api.deps import (
    Auditor,
    get_accessible_study,
    get_auditor,
    get_feature_store,
    get_registry,
    get_volume_store,
)
from app.api.schemas import (
    CurvePointOut,
    KnownMarkerIn,
    MarkerProfileOut,
    ProfileInputs,
    ProfileOut,
    RevealOut,
    DoubtComponentOut,
    DoubtOut,
    EvidenceItemOut,
    EvidenceOut,
    LimeFactorOut,
    LimeOut,
    LimeRegionOut,
    ClaimOut,
    FalsificationOut,
    MarkerStateOut,
    PathwayOut,
    NextMeasurementsOut,
    NextStepOut,
    TestSuggestionOut,
    TippingItemOut,
    TippingOut,
    TrueResultOut,
    VolumesOut,
)
from app.core.errors import AppError
from app.db.models import Study, StudyKind
from app.core.compute import heavy_slot
from app.core.ratelimit import limit_analysis
from app.domain.contracts import MARKER_LABELS, FeatureVector, Marker, Provenance, ProvenancedValue
from app.domain.doubt import decompose, primary
from app.domain.explain import REGION_LABELS, explain_set
from app.domain.lime import explain_lime
from app.domain.falsification import CONFIRMATORY_TEST, Claim, build_falsification
from app.domain.next_measurement import plan
from app.domain.pathways import LABEL as PATHWAY_LABEL
from app.domain.pathways import SOURCES as PATHWAY_SOURCES
from app.domain.tipping import find_tipping_points
from app.domain.feature_store import FeatureStore
from app.domain.profile import MarkerResult, build_profile, known_label
from app.domain.registry import MarkerRegistry, SetMarkerPredictor, variant_label
from app.domain.volume_store import Sequence, VolumeStore

# Every study route is rate limited per user and client IP (app/core/ratelimit.py).
router=APIRouter(prefix="/api/v1/studies", tags=["studies"], dependencies=[Depends(limit_analysis)])

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


def _input_hash(vector: FeatureVector) -> str:
    """sha256 of every model input for this request, so any output can be reproduced exactly."""
    canonical=json.dumps(vector.model_dump(mode="json"), sort_keys=True, separators=(",", ":"))
    return "sha256:"+hashlib.sha256(canonical.encode()).hexdigest()


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
        skill=None if result.skill is None else round(result.skill, 4),
        low_signal=result.low_signal,
    )


@router.get("/{study_id}/profile")
def get_profile(
    request: Request,
    known: list[str]=Query(default=[], max_length=4, description="Lab results already known, e.g. IDH:1"),
    view: Literal["fused", "imaging_only", "clinical_only"]=Query(
        default="fused", description="Inputs the models may use: all, MRI only, or patient info only",
    ),
    study: Study=Depends(get_accessible_study),
    audit: Auditor=Depends(get_auditor),
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
    results=build_profile(registry, vector, view)
    versions={
        variant_label(r.marker, r.variant): r.prediction.model_version
        for r in results if r.prediction is not None and r.variant is not None
    }
    audit(
        f"profile.read:{view}", str(study.id),
        "sha256:"+hashlib.sha256(json.dumps(versions, sort_keys=True).encode()).hexdigest(),
    )

    biopsy=None if study.prior_biopsy is None else ("yes" if study.prior_biopsy else "no")
    return ProfileOut(
        study_id=study.id,
        view=view,
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
        model_versions=versions,
        feature_pipeline_version=store.version,
        input_hash=_input_hash(vector),
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
    audit: Auditor=Depends(get_auditor),
    store: FeatureStore=Depends(get_feature_store),
) -> RevealOut:
    """True lab results for demo cases only; kept out of /profile so they can never feed a prediction."""
    if study.kind!=StudyKind.DEMO or not store.has(study.source_patient_id):
        raise AppError(
            "NO_GROUND_TRUTH", "No lab results are available for this study.", status.HTTP_409_CONFLICT,
        )
    audit("reveal.read", str(study.id))
    row=store.rows[study.source_patient_id]  # type: ignore[index]
    results=[]
    for marker in Marker:
        label=_true_label(marker, row.get(_LABEL_COLUMN[marker]))
        provenance=Provenance.MISSING if label is None else Provenance.MEASURED
        value=ProvenancedValue(value=label, provenance=provenance)
        raw=row.get(_LABEL_COLUMN[marker])
        detail=f"WHO grade {int(float(raw))}" if marker==Marker.GRADE and label is not None else None  # type: ignore[arg-type]
        results.append(TrueResultOut(marker=marker, value=value, detail=detail))
    return RevealOut(study_id=study.id, results=results)


@router.get("/{study_id}/volumes")
def list_volumes(
    study: Study=Depends(get_accessible_study),
    volumes: VolumeStore=Depends(get_volume_store),
) -> VolumesOut:
    return VolumesOut(study_id=study.id, sequences=volumes.available(study.source_patient_id))


@router.get("/{study_id}/volume/{sequence}", response_class=FileResponse)
def get_volume(
    sequence: Sequence,
    study: Study=Depends(get_accessible_study),
    audit: Auditor=Depends(get_auditor),
    volumes: VolumeStore=Depends(get_volume_store),
) -> FileResponse:
    """Streams one compressed NIfTI volume; the file name carries no patient id."""
    path=volumes.path_for(study.source_patient_id, sequence)
    if path is None:
        raise AppError(
            "VOLUME_NOT_AVAILABLE", "This volume is not available for this study.", status.HTTP_404_NOT_FOUND,
        )
    audit(f"volume.read:{sequence.value}", str(study.id))
    return FileResponse(
        path,
        media_type="application/gzip",
        filename=f"{sequence.value}.nii.gz",
        headers={"Cache-Control": "private, max-age=3600"},
    )


def _marker_inputs(
    marker: Marker, known: list[str], study: Study, registry: MarkerRegistry, store: FeatureStore,
) -> tuple[SetMarkerPredictor, FeatureVector]:
    """The model set /profile would use for this marker, and the patient's inputs to it."""
    known_markers=_parse_known(known)
    if marker in known_markers:
        raise AppError(
            "MARKER_ALREADY_KNOWN", f"{marker.value} is a known lab result, so it is not predicted.",
            status.HTTP_409_CONFLICT,
        )
    if not store.has(study.source_patient_id) or store.version is None:
        raise AppError(
            "FEATURES_NOT_READY", "Imaging features for this study are not available yet.",
            status.HTTP_409_CONFLICT,
        )
    predictor=registry.for_patient(marker, set(known_markers))
    if predictor is None:
        raise AppError(
            "MODEL_NOT_AVAILABLE", f"No model set is deployed for {marker.value}.", status.HTTP_409_CONFLICT,
        )
    vector=store.vector_for(
        patient_id=study.source_patient_id,  # type: ignore[arg-type]
        study_id=str(study.id),
        age=study.age,
        sex=study.sex,
        prior_biopsy=study.prior_biopsy,
        known_markers=known_markers,
    )
    return predictor, vector


_EVIDENCE_METHOD=(
    "Grouped perturbation: each group of inputs is reset to the training-cohort median and every model "
    "in the set is re-run; the change in probability is that group's effect. It measures model "
    "sensitivity, not cause."
)


@router.get("/{study_id}/evidence")
def get_evidence(
    request: Request,
    marker: Marker,
    known: list[str]=Query(default=[], max_length=4, description="Lab results already known, e.g. IDH:1"),
    study: Study=Depends(get_accessible_study),
    audit: Auditor=Depends(get_auditor),
    registry: MarkerRegistry=Depends(get_registry),
    store: FeatureStore=Depends(get_feature_store),
) -> EvidenceOut:
    """Which input groups drove this marker's call, using the same model set as /profile."""
    started=time.perf_counter()
    predictor, vector=_marker_inputs(marker, known, study, registry, store)
    prediction=predictor.predict_set(vector)
    explanation=explain_set(predictor, vector)
    audit(f"evidence.read:{marker.value}", str(study.id), prediction.model_version)
    sizes={e.group: (e.label, e.n_columns) for e in explanation.effects}
    toward_positive=prediction.call==known_label(marker, 1)
    return EvidenceOut(
        study_id=study.id,
        input_hash=_input_hash(vector),
        marker=marker,
        variant=predictor.variant,
        call=prediction.call,
        low_signal=predictor.low_signal,
        method=_EVIDENCE_METHOD,
        reference=ProvenancedValue(value="training-cohort median", provenance=Provenance.REFERENCE_COHORT),
        explanation_agreement=None if explanation.explanation_agreement is None
        else round(explanation.explanation_agreement, 4),
        items=[
            EvidenceItemOut(
                evidence_id=item.evidence_id,
                group=item.group,
                label=sizes[item.group][0],
                direction=item.direction,
                supports_call=(item.direction=="toward_positive")==toward_positive,
                weight=round(item.weight, 5),
                agreement=None if item.agreement is None else round(item.agreement, 4),
                n_columns=sizes[item.group][1],
                provenance=item.provenance,
            )
            for item in explanation.items
        ],
        model_version=prediction.model_version,
        request_id=getattr(request.state, "request_id", None),
        latency_ms=round((time.perf_counter()-started)*1000, 2),
    )


_LIME_METHOD=(
    "LIME (Ribeiro et al., 2016): each evidence group is switched between this patient's values and the "
    "training-cohort median in 400 random patterns; a weighted linear model fitted per model in the set "
    "gives each group's local effect on the probability. Model sensitivity, not biological cause."
)


@router.get("/{study_id}/lime")
def get_lime(
    request: Request,
    marker: Marker,
    known: list[str]=Query(default=[], max_length=4, description="Lab results already known, e.g. IDH:1"),
    study: Study=Depends(get_accessible_study),
    audit: Auditor=Depends(get_auditor),
    registry: MarkerRegistry=Depends(get_registry),
    store: FeatureStore=Depends(get_feature_store),
) -> LimeOut:
    """LIME local explanation of this marker's call, per evidence group and per tumor region."""
    started=time.perf_counter()
    predictor, vector=_marker_inputs(marker, known, study, registry, store)
    prediction=predictor.predict_set(vector)
    with heavy_slot():
        result=explain_lime(predictor, vector)
    audit(f"lime.read:{marker.value}", str(study.id), prediction.model_version)
    toward_positive=prediction.call==known_label(marker, 1)
    prefix=f"{marker.value}:{predictor.variant}:lime"

    def direction(effect: float) -> str:
        return "toward_positive" if effect>0 else "toward_negative"

    return LimeOut(
        study_id=study.id,
        input_hash=_input_hash(vector),
        marker=marker,
        variant=predictor.variant,
        call=prediction.call,
        low_signal=predictor.low_signal,
        method=_LIME_METHOD,
        reference=ProvenancedValue(value="training-cohort median", provenance=Provenance.REFERENCE_COHORT),
        n_samples=result.n_samples,
        fidelity_r2=round(result.fidelity_r2, 4),
        explanation_agreement=None if result.explanation_agreement is None
        else round(result.explanation_agreement, 4),
        typical=ProvenancedValue(
            value=round(result.typical_probability, 4), provenance=Provenance.REFERENCE_COHORT,
        ),
        probability=ProvenancedValue(
            value=round(prediction.prob_median, 4), provenance=Provenance.MODEL_INFERRED,
        ),
        factors=[
            LimeFactorOut(
                evidence_id=f"{prefix}:{f.group}", group=f.group, label=f.label, region=f.region,
                effect=round(f.effect, 5), direction=direction(f.effect),  # type: ignore[arg-type]
                supports_call=(f.effect>0)==toward_positive,
                agreement=None if f.agreement is None else round(f.agreement, 4),
                provenance=Provenance.MODEL_INFERRED,
            )
            for f in result.factors
        ],
        regions=[
            LimeRegionOut(
                evidence_id=f"{prefix}:region:{region.value}", region=region, label=REGION_LABELS[region],
                effect=round(effect, 5),
                direction="neutral" if abs(effect)<1e-4 else direction(effect),  # type: ignore[arg-type]
                supports_call=abs(effect)>=1e-4 and (effect>0)==toward_positive,
                provenance=Provenance.MODEL_INFERRED,
            )
            for region, effect in result.regions.items()
        ],
        model_version=prediction.model_version,
        request_id=getattr(request.state, "request_id", None),
        latency_ms=round((time.perf_counter()-started)*1000, 2),
    )


@router.get("/{study_id}/doubt")
def get_doubt(
    request: Request,
    marker: Marker,
    known: list[str]=Query(default=[], max_length=4, description="Lab results already known, e.g. IDH:1"),
    study: Study=Depends(get_accessible_study),
    audit: Auditor=Depends(get_auditor),
    registry: MarkerRegistry=Depends(get_registry),
    store: FeatureStore=Depends(get_feature_store),
) -> DoubtOut:
    """Why this marker's call is uncertain, split by source, each with the action it calls for."""
    started=time.perf_counter()
    predictor, vector=_marker_inputs(marker, known, study, registry, store)
    prediction=predictor.predict_set(vector)
    components=decompose(
        prediction, predictor.low_signal, predictor.meta.skill, vector, store.reference,
        study.source_patient_id,
    )
    worst=primary(components)
    audit(f"doubt.read:{marker.value}", str(study.id), prediction.model_version)
    return DoubtOut(
        study_id=study.id,
        input_hash=_input_hash(vector),
        marker=marker,
        variant=predictor.variant,
        call=prediction.call,
        verdict=prediction.verdict,
        primary_source=None if worst is None else worst.source,
        recommended_action=worst.action if worst is not None
        else "No strong source of doubt: the imaging call is as reliable as this model set gets.",
        components=[
            DoubtComponentOut(
                source=c.source, level=c.level, value=c.value, detail=c.detail, action=c.action,
                provenance=c.provenance,
            )
            for c in components
        ],
        model_version=prediction.model_version,
        request_id=getattr(request.state, "request_id", None),
        latency_ms=round((time.perf_counter()-started)*1000, 2),
    )


_TIPPING_METHOD=(
    "Each clinician-verifiable input is swept across plausible values (ages 18-100; tumor descriptors over "
    "the training patients' 1st-99th percentiles) with everything else fixed, re-running every model in the "
    "set. flip_at is the nearest value where the majority call changes. Model sensitivity, not cause."
)


@router.get("/{study_id}/tipping")
def get_tipping(
    request: Request,
    marker: Marker,
    known: list[str]=Query(default=[], max_length=4, description="Lab results already known, e.g. IDH:1"),
    study: Study=Depends(get_accessible_study),
    audit: Auditor=Depends(get_auditor),
    registry: MarkerRegistry=Depends(get_registry),
    store: FeatureStore=Depends(get_feature_store),
) -> TippingOut:
    """What it would take to flip this marker's call, per clinician-verifiable input."""
    started=time.perf_counter()
    predictor, vector=_marker_inputs(marker, known, study, registry, store)
    prediction=predictor.predict_set(vector)
    with heavy_slot():
        points=find_tipping_points(predictor, vector, store.descriptor_grids, MARKER_LABELS[marker])
    audit(f"tipping.read:{marker.value}", str(study.id), prediction.model_version)
    return TippingOut(
        study_id=study.id,
        input_hash=_input_hash(vector),
        marker=marker,
        variant=predictor.variant,
        call=prediction.call,
        method=_TIPPING_METHOD,
        items=[
            TippingItemOut(
                input=t.column, label=t.label, unit=t.unit, current=round(t.current, 6),
                flip_at=t.flip_at, flips_to=t.flips_to,
                curve=[
                    CurvePointOut(
                        value=round(c.value, 6), positive_fraction=round(c.positive_fraction, 4),
                        prob_median=round(c.prob_median, 4),
                    )
                    for c in t.curve
                ],
                provenance=Provenance.MODEL_INFERRED,
            )
            for t in points
        ],
        model_version=prediction.model_version,
        request_id=getattr(request.state, "request_id", None),
        latency_ms=round((time.perf_counter()-started)*1000, 2),
    )


def _claim(claim: Claim) -> ClaimOut:
    return ClaimOut(
        short=claim.short, text=claim.text, evidence_ids=claim.evidence_ids, provenance=claim.provenance,
    )


@router.get("/{study_id}/falsification")
def get_falsification(
    request: Request,
    marker: Marker,
    known: list[str]=Query(default=[], max_length=4, description="Lab results already known, e.g. IDH:1"),
    study: Study=Depends(get_accessible_study),
    audit: Auditor=Depends(get_auditor),
    registry: MarkerRegistry=Depends(get_registry),
    store: FeatureStore=Depends(get_feature_store),
) -> FalsificationOut:
    """The case for and against this marker's call, and what would overturn it."""
    started=time.perf_counter()
    predictor, vector=_marker_inputs(marker, known, study, registry, store)
    prediction=predictor.predict_set(vector)
    explanation=explain_set(predictor, vector)
    with heavy_slot():
        tipping=find_tipping_points(predictor, vector, store.descriptor_grids, MARKER_LABELS[marker])
    labels={e.group: e.label for e in explanation.effects}
    panel=build_falsification(marker, predictor.variant, prediction, explanation, labels, tipping)
    audit(f"falsification.read:{marker.value}", str(study.id), prediction.model_version)
    return FalsificationOut(
        study_id=study.id,
        input_hash=_input_hash(vector),
        marker=marker,
        variant=predictor.variant,
        call=prediction.call,
        verdict=prediction.verdict,
        supporting=[_claim(c) for c in panel.supporting],
        contradicting=[_claim(c) for c in panel.contradicting],
        competing=_claim(panel.competing),
        overturn=[_claim(c) for c in panel.overturn],
        confirmatory_test=panel.confirmatory_test,
        model_version=prediction.model_version,
        request_id=getattr(request.state, "request_id", None),
        latency_ms=round((time.perf_counter()-started)*1000, 2),
    )


@router.get("/{study_id}/next-measurements")
def get_next_measurements(
    request: Request,
    known: list[str]=Query(default=[], max_length=4, description="Lab results already known, e.g. IDH:1"),
    study: Study=Depends(get_accessible_study),
    audit: Auditor=Depends(get_auditor),
    registry: MarkerRegistry=Depends(get_registry),
    store: FeatureStore=Depends(get_feature_store),
) -> NextMeasurementsOut:
    """Which WHO CNS5 categories the current calls leave open, and which lab test narrows them most."""
    known_markers=_parse_known(known)
    if not store.has(study.source_patient_id) or store.version is None:
        raise AppError(
            "FEATURES_NOT_READY", "Imaging features for this study are not available yet.",
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
    result=plan(build_profile(registry, vector), age=study.age)
    audit("next_measurements.read", str(study.id))
    return NextMeasurementsOut(
        study_id=study.id,
        input_hash=_input_hash(vector),
        label="decision-support heuristic",
        marker_states=[
            MarkerStateOut(
                marker=s.marker, value=s.value, settled=s.settled, from_lab=s.from_lab, reason=s.reason,
                provenance=Provenance.CLINICAL_INPUT if s.from_lab
                else Provenance.MISSING if s.value is None else Provenance.MODEL_INFERRED,
            )
            for s in result.states
        ],
        pathways=[
            PathwayOut(category=p.category, steps=p.steps, mgmt_note=p.mgmt_note, grade_note=p.grade_note)
            for p in result.pathways
        ],
        next_step=NextStepOut(
            kind=result.next_step.kind,  # type: ignore[arg-type]
            marker=result.next_step.marker, title=result.next_step.title, reason=result.next_step.reason,
            test=CONFIRMATORY_TEST[result.next_step.marker] if result.next_step.marker else None,
        ),
        pathway_basis=result.basis,
        pathway_label=PATHWAY_LABEL,
        pathway_sources=list(PATHWAY_SOURCES),
        candidate_categories=result.candidates,
        tests=[
            TestSuggestionOut(
                marker=t.marker, test=t.test, settled=t.settled, remaining_worst_case=t.remaining_worst_case,
                reason=t.reason,
            )
            for t in result.tests
        ],
        request_id=getattr(request.state, "request_id", None),
    )
