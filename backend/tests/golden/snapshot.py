"""Builds the golden snapshot: what the committed models output for 10 held-out patients.

Regenerate after an intentional model update (and commit the result with the models):
    cd backend && .venv/Scripts/python -m tests.golden.snapshot --write
"""
import argparse
import json
from pathlib import Path

from app.core.config import get_settings
from app.domain.contracts import Marker
from app.domain.explain import explain_set
from app.domain.feature_store import FeatureStore, load_feature_store
from app.domain.profile import build_profile
from app.domain.registry import MarkerRegistry, load_registry

EXPECTED=Path(__file__).with_name("expected.json")
N_PATIENTS=10


def load() -> tuple[MarkerRegistry, FeatureStore]:
    settings=get_settings()
    return (
        load_registry(settings.artifacts_root, settings.markers_config_path),
        load_feature_store(settings.feature_table_path),
    )


def _profile(
    registry: MarkerRegistry, store: FeatureStore, patient_id: str, known: dict[Marker, int],
) -> dict:
    row=store.rows[patient_id]
    biopsy=row.get("prior_biopsy")
    vector=store.vector_for(
        patient_id=patient_id, study_id=patient_id, age=int(round(row["age"])),
        sex="M" if int(row["sex"])==1 else "F",
        prior_biopsy=None if biopsy is None or biopsy!=biopsy else bool(biopsy),
        known_markers=known,
    )
    out={}
    for r in build_profile(registry, vector):
        p=r.prediction
        out[r.marker.value]={
            "status": r.status, "call": r.call, "variant": r.variant, "low_signal": r.low_signal,
            "verdict": None if p is None else p.verdict.value,
            "prob_median": None if p is None else round(p.prob_median, 6),
        }
    idh=registry.for_patient(Marker.IDH, set(known))
    if idh is not None and Marker.IDH not in known:
        items=explain_set(idh, vector).items
        out["IDH"]["top_evidence"]=items[0].group if items else None
    return out


def snapshot(registry: MarkerRegistry, store: FeatureStore) -> dict:
    test_ids=sorted(p for p, r in store.rows.items() if r.get("split")=="test")[:N_PATIENTS]
    return {
        "model_versions": {f"{m.value}:{v}": p.model_version for (m, v), p in sorted(
            registry.predictors.items(), key=lambda kv: (kv[0][0].value, kv[0][1]))},
        "feature_pipeline_version": store.version,
        "patients": {
            pid: {
                "profile": _profile(registry, store, pid, {}),
                "given_idh_mutant": _profile(registry, store, pid, {Marker.IDH: 1}),
            }
            for pid in test_ids
        },
    }


def main() -> None:
    parser=argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    args=parser.parse_args()
    data=snapshot(*load())
    if args.write:
        EXPECTED.write_text(json.dumps(data, indent=2, sort_keys=True)+"\n", encoding="utf-8", newline="\n")
        print(f"wrote {EXPECTED} for {len(data['patients'])} patients")
    else:
        print(json.dumps(data, indent=2, sort_keys=True)[:2000])


if __name__=="__main__":
    main()
