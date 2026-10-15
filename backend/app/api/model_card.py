"""GET /api/v1/model-card: what the models are, what they were trained on, how
well they do on held-out patients, and what they must not be used for."""
import json
from pathlib import Path

import pandas as pd

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_feature_store, get_registry
from app.api.schemas import HeldOutMetricOut, MetricsSummaryOut, ModelCardOut, ModelSetCardOut
from app.core.config import get_settings
from app.db.models import Study, StudyKind, User
from app.db.session import get_db
from app.domain.feature_store import FeatureStore
from app.domain.contracts import Marker
from app.domain.registry import MarkerRegistry

router=APIRouter(prefix="/api/v1", tags=["model card"])

INTENDED_USE=(
    "Research decision-support prototype for pre-operative assessment of adult diffuse gliomas: "
    "estimates IDH mutation, 1p/19q co-deletion, MGMT promoter methylation and WHO grade 4 vs 2-3 "
    "from MRI and patient context, and reports how stable each estimate is. Not a diagnostic device; "
    "every result needs tissue confirmation before clinical use."
)
DISCLAIMER=(
    "Research decision-support prototype. Not a diagnostic device. Trained on public de-identified data."
)
LIMITATIONS=[
    "Trained on two sources: UCSF-PDGM (395 patients, one hospital) and 70% of a TCGA cohort from many US "
    "hospitals (116 patients). On the 51 held-out TCGA patients IDH was 91% accurate (AUC 0.99) "
    "and grade 86% (AUC 0.95); the same patients scored 80% and 65% with models trained on UCSF alone. "
    "See ml/notebooks/04_external_validation_tcga.ipynb.",
    "Race: absent from UCSF-PDGM; TCGA is mostly White. The 116 TCGA training patients include 9 Black "
    "and 1 Asian patient; the held-out split has 3 and 2, too few for per-race conclusions. "
    "Race is never a model input.",
    "Only 22 1p/19q co-deleted patients among 511 training patients, so calibrated probabilities stay below "
    "the 0.5 call threshold: the models rank co-deletion (UCSF AUC 0.92) but make no positive calls.",
    "MGMT methylation is not predictable from these MRI features (no reliable signal); it is never called.",
    "Features are radiomics-style statistics computed with SciPy/scikit-image, not pyradiomics.",
    "First-order intensity features use raw scanner values; training on two sources reduced the scanner "
    "effect, but a new scanner type can still shift calls. Brain-normalized features (v2) exist.",
    "Calls depend on the tumor segmentation; one-voxel outline errors changed a few stress-test calls.",
    "Explanations (evidence, tipping points) describe model sensitivity, not biological cause.",
    "Adults (18+) only; paediatric gliomas were excluded from training.",
]


def _tcga_training_rows(root: Path) -> list[dict]:
    path=root/"features"/"external_tcga.parquet"
    if not path.is_file():
        return []
    columns=["split", "age", "sex", "idh", "codeletion_1p19q", "who_grade", "race"]
    table=pd.read_parquet(path, columns=columns)
    return table[table["split"]=="train"].to_dict("records")


def _population(store: FeatureStore, root: Path) -> dict:
    """Training-cohort makeup (both sites), so users can judge whether a patient resembles it."""
    ucsf=[r for r in store.rows.values() if r.get("split")=="train"]
    tcga=_tcga_training_rows(root)
    rows=ucsf+tcga
    if not rows:
        return {}
    ages=sorted(float(r["age"]) for r in rows if r.get("age") is not None and r["age"]==r["age"])
    def types(r: dict) -> str:
        if r.get("idh")==0:
            return "IDH-wildtype"
        if r.get("idh")==1:
            return "IDH-mutant, 1p/19q codeleted" if r.get("codeletion_1p19q")==1 else "IDH-mutant"
        return "IDH not recorded"
    counts: dict[str, int]={}
    for r in rows:
        counts[types(r)]=counts.get(types(r), 0)+1
    return {
        "site": (f"UCSF-PDGM ({len(ucsf)}, one hospital) + TCGA ({len(tcga)}, many US hospitals)"
                 if tcga else "UCSF (one US academic hospital), UCSF-PDGM public dataset"),
        "patients": len(rows),
        "female": sum(1 for r in rows if r.get("sex")==0),
        "male": sum(1 for r in rows if r.get("sex")==1),
        "age_median": ages[len(ages)//2],
        "age_range": [ages[0], ages[-1]],
        "grade_4_share": round(sum(1 for r in rows if r.get("who_grade")==4)/len(rows), 3),
        "tumor_types": counts,
        "race": (
            "not recorded for the UCSF patients; TCGA training patients: "
            +", ".join(f"{n} {g}" for g, n in pd.Series([r["race"] for r in tcga]).value_counts().items())
            if tcga else "not included in the public UCSF-PDGM release"
        ),
    }


def _load_json(path: Path) -> dict | None:
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


@router.get("/model-card")
def model_card(
    request: Request,
    user: User=Depends(get_current_user),
    registry: MarkerRegistry=Depends(get_registry),
    store: FeatureStore=Depends(get_feature_store),
) -> ModelCardOut:
    settings=get_settings()
    cohort=_load_json(settings.artifacts_root/"features"/"provenance.json") or {}
    metrics=_load_json(settings.artifacts_root/"metrics"/"heldout.json") or {"sets": []}
    held_out={(m["marker"], m["variant"]): m for m in metrics.get("sets", [])}

    sets=[]
    ordered=sorted(registry.predictors.items(), key=lambda kv: (kv[0][0].value, kv[0][1]))
    for (marker, variant), predictor in ordered:
        meta=predictor.meta
        result=held_out.get((marker.value, variant))
        current=result is not None and result.get("model_version")==predictor.model_version
        sets.append(ModelSetCardOut(
            marker=marker,
            variant=variant,
            model_version=predictor.model_version,
            n_models=len(meta.models),
            families=sorted({m.family for m in meta.models}),
            epsilon=meta.epsilon,
            best_cv_log_loss=min(m.cv_log_loss for m in meta.models),
            baseline_log_loss=meta.baseline_log_loss,
            skill=meta.skill,
            low_signal=predictor.low_signal,
            verdict_thresholds=meta.verdict_thresholds.model_dump(),
            feature_count=len(meta.feature_columns),
            library_versions=meta.library_versions,
            held_out=result if current else None,
            held_out_stale=result is not None and not current,
        ))
    return ModelCardOut(
        intended_use=INTENDED_USE,
        disclaimer=DISCLAIMER,
        data_source="UCSF-PDGM (The Cancer Imaging Archive), CC BY 4.0",
        cohort={k: v for k, v in cohort.items() if isinstance(v, int)},
        feature_pipeline_version=store.version,
        held_out_patients=metrics.get("n_patients"),
        model_sets=sets,
        limitations=LIMITATIONS,
        training_population=_population(store, settings.artifacts_root),
        subgroups=_load_json(settings.artifacts_root/"metrics"/"subgroups_ucsf.json"),
        external_validation=_load_json(settings.artifacts_root/"metrics"/"external_tcga.json"),
        request_id=getattr(request.state, "request_id", None),
    )


@router.get("/metrics/summary")
def metrics_summary(
    request: Request,
    registry: MarkerRegistry=Depends(get_registry),
    db: Session=Depends(get_db),
) -> MetricsSummaryOut:
    """Public (no sign-in): held-out AUCs of the deployed model sets and the number of demo cases.

    Only results computed for the exact deployed model files (matching sha256) are returned, so the
    landing page can never show numbers from older models.
    """
    metrics=_load_json(get_settings().artifacts_root/"metrics"/"heldout.json") or {"sets": []}
    sets=[]
    for m in metrics.get("sets", []):
        predictor=registry.predictors.get((Marker(m["marker"]), m["variant"]))
        if predictor is None or predictor.model_version!=m.get("model_version"):
            continue
        sets.append(HeldOutMetricOut(
            marker=m["marker"], variant=m["variant"], auc=m.get("auc"), auc_ci95=m.get("auc_ci95"),
        ))
    demo=db.scalar(select(func.count()).select_from(Study).where(Study.kind==StudyKind.DEMO)) or 0
    return MetricsSummaryOut(
        held_out_patients=metrics.get("n_patients"), demo_cases=demo, sets=sets,
        request_id=getattr(request.state, "request_id", None),
    )
