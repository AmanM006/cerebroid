"""GET /api/v1/model-card: what the models are, what they were trained on, how
well they do on held-out patients, and what they must not be used for."""
import json
from pathlib import Path

from fastapi import APIRouter, Depends, Request

from app.api.deps import get_current_user, get_feature_store, get_registry
from app.api.schemas import ModelCardOut, ModelSetCardOut
from app.core.config import get_settings
from app.db.models import User
from app.domain.feature_store import FeatureStore
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
    "Trained on one institution (UCSF-PDGM). On 167 external TCGA patients from many hospitals "
    "(models unchanged), IDH AUC fell from 0.98 to 0.79 and 1p/19q did not transfer (AUC 0.39); "
    "grade ranking held (AUC 0.90) but "
    "57 of 65 grade 2-3 tumors were called grade 4, a scanner-intensity shift. Stable IDH calls stayed more "
    "accurate (80% vs 73%). See ml/notebooks/04_external_validation_tcga.ipynb.",
    "Race: absent from UCSF-PDGM; on TCGA, Black (11-12 per marker) and Asian (2-3) patients are too few for "
    "statistically meaningful per-race comparisons. Race is evaluated, never used as a model input.",
    "Only 15 1p/19q co-deleted patients in the cohort (13 of 323 training patients, 4.0%), so calibrated "
    "probabilities stay below the 0.5 call threshold: good ranking (AUC 0.90) but no positive calls yet.",
    "MGMT methylation is barely predictable from these MRI features; the model card's held-out AUC shows it.",
    "Features are radiomics-style statistics computed with SciPy/scikit-image, not pyradiomics.",
    "First-order intensity features use raw scanner values (one institution); a stress test shows they shift "
    "with scanner gain, while noise and shading changed no calls. Brain-normalized features (v2) exist.",
    "Calls depend on the tumor segmentation; one-voxel outline errors changed a few stress-test calls.",
    "Explanations (evidence, tipping points) describe model sensitivity, not biological cause.",
    "Adults (18+) only; paediatric gliomas were excluded from training.",
]


def _population(store: FeatureStore) -> dict:
    """Training-cohort makeup, so users can judge whether a patient resembles it."""
    rows=[r for r in store.rows.values() if r.get("split")=="train"]
    if not rows:
        return {}
    ages=sorted(float(r["age"]) for r in rows)
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
        "site": "UCSF (one US academic hospital), UCSF-PDGM public dataset",
        "patients": len(rows),
        "female": sum(1 for r in rows if r.get("sex")==0),
        "male": sum(1 for r in rows if r.get("sex")==1),
        "age_median": ages[len(ages)//2],
        "age_range": [ages[0], ages[-1]],
        "grade_4_share": round(sum(1 for r in rows if r.get("who_grade")==4)/len(rows), 3),
        "tumor_types": counts,
        "race": (
            "not included in the public UCSF-PDGM release; performance by race is measured on the "
            "external TCGA cohort"
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
        training_population=_population(store),
        subgroups=_load_json(settings.artifacts_root/"metrics"/"subgroups_ucsf.json"),
        external_validation=_load_json(settings.artifacts_root/"metrics"/"external_tcga.json"),
        request_id=getattr(request.state, "request_id", None),
    )
