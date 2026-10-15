"""Held-out evaluation of every deployed model set, written to artifacts/metrics/heldout.json.

Scores each set listed in ml/configs/markers.yaml on the test split of the
committed feature table (patients never used in training), using the same
stability rule as the API. Reports, per set:
- AUC and balanced accuracy of the set's median probability, with bootstrap
  95% confidence intervals (1000 resamples, seed 0)
- how many test patients got each verdict, and the error rate within each
  verdict: the check that "Stable" calls really are more often right
And per marker, "resolved by combining": test patients
whose imaging-only set is not Stable but whose fused set is Stable, with the
fused call's accuracy on them, plus the reverse direction.

Run from the repo root with the backend environment:
    backend/.venv/Scripts/python ml/pipeline/evaluate.py      (Windows)
    backend/.venv/bin/python ml/pipeline/evaluate.py           (Linux/macOS)
"""
import hashlib
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import yaml
from sklearn.metrics import balanced_accuracy_score, roc_auc_score

REPO=Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO/"backend"))

from app.domain.multiplicity_engine import VerdictThresholds, compute_verdict  # noqa: E402

TARGETS={"IDH": "idh", "1p19q": "codeletion_1p19q", "MGMT": "mgmt", "GRADE": "who_grade"}
N_BOOT=1000


def _labels(marker: str, values: pd.Series) -> np.ndarray:
    if marker=="GRADE":
        return (values==4).astype(int).to_numpy()
    return values.astype(int).to_numpy()


def _feature_frame(table: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    frame=table.reindex(columns=columns).astype(float)
    return frame


def _bootstrap(y: np.ndarray, score: np.ndarray, call: np.ndarray) -> dict:
    rng=np.random.default_rng(0)
    aucs, baccs=[], []
    for _ in range(N_BOOT):
        idx=rng.integers(0, len(y), len(y))
        if len(np.unique(y[idx]))<2:
            continue
        aucs.append(roc_auc_score(y[idx], score[idx]))
        baccs.append(balanced_accuracy_score(y[idx], call[idx]))
    def ci(values: list[float]) -> list[float] | None:
        return None if not values else [round(float(np.percentile(values, 2.5)), 4),
                                         round(float(np.percentile(values, 97.5)), 4)]
    return {"auc_ci95": ci(aucs), "balanced_accuracy_ci95": ci(baccs)}


def evaluate_set(marker: str, artifact_dir: Path, test: pd.DataFrame) -> tuple[dict, pd.DataFrame]:
    meta=json.loads((artifact_dir/"meta.json").read_text(encoding="utf-8"))
    models=joblib.load(artifact_dir/"models.joblib")
    rows=test[test[TARGETS[marker]].notna()]
    y=_labels(marker, rows[TARGETS[marker]])
    frame=_feature_frame(rows, meta["feature_columns"])
    if "known__idh" in meta["feature_columns"]:
        frame["known__idh"]=rows["idh"].astype(float).to_numpy()
    probs=np.vstack([m.predict_proba(frame)[:, 1] for m in models])
    threshold=meta["decision_threshold"]
    median=np.median(probs, axis=0)
    call=((probs>=threshold).mean(axis=0)>=0.5).astype(int)
    thresholds=VerdictThresholds(**meta["verdict_thresholds"])
    verdicts=[compute_verdict(list(probs[:, i]), threshold, thresholds).value for i in range(probs.shape[1])]

    by_verdict={}
    for verdict in ("STABLE", "CONTESTED", "ARBITRARY"):
        mask=np.array([v==verdict for v in verdicts])
        by_verdict[verdict]={
            "n": int(mask.sum()),
            "error_rate": None if not mask.any() else round(float((call[mask]!=y[mask]).mean()), 4),
        }
    result={
        "marker": marker,
        "variant": meta.get("variant", "fused"),
        "n_test": int(len(y)),
        "n_positive": int(y.sum()),
        "n_models": len(models),
        # Ties these numbers to the exact model file; the API hides them once the file changes.
        "model_version": "sha256:"+hashlib.sha256((artifact_dir/"models.joblib").read_bytes()).hexdigest(),
        "auc": round(float(roc_auc_score(y, median)), 4) if len(np.unique(y))>1 else None,
        "balanced_accuracy": round(float(balanced_accuracy_score(y, call)), 4),
        "by_verdict": by_verdict,
    }
    result.update(_bootstrap(y, median, call) if len(np.unique(y))>1 else {})
    per_patient=pd.DataFrame(
        {"call": call, "label": y, "verdict": verdicts, "prob": median}, index=rows["patient_id"].to_numpy(),
    )
    return result, per_patient


def resolved_by_combining(fused: pd.DataFrame, imaging: pd.DataFrame) -> dict:
    both=fused.join(imaging, lsuffix="_fused", rsuffix="_imaging", how="inner")
    resolved=both[(both["verdict_imaging"]!="STABLE") & (both["verdict_fused"]=="STABLE")]
    lost=both[(both["verdict_imaging"]=="STABLE") & (both["verdict_fused"]!="STABLE")]
    def accuracy(frame: pd.DataFrame) -> float | None:
        return None if frame.empty else round(float((frame["call_fused"]==frame["label_fused"]).mean()), 4)
    return {
        "n_test": int(len(both)),
        "imaging_only_not_stable": int((both["verdict_imaging"]!="STABLE").sum()),
        "resolved_by_combining": int(len(resolved)),
        "fused_accuracy_on_resolved": accuracy(resolved),
        "stable_only_without_context": int(len(lost)),
    }


def main() -> None:
    table=pd.read_parquet(REPO/"artifacts"/"features"/"features.parquet")
    test=table[table["split"]=="test"]
    config=yaml.safe_load((REPO/"ml"/"configs"/"markers.yaml").read_text(encoding="utf-8"))
    results=[]
    per_patient: dict[tuple[str, str], pd.DataFrame]={}
    for entry in config["markers"]:
        directory=REPO/"artifacts"/entry["artifact_dir"]
        if (directory/"meta.json").is_file():
            result, patients=evaluate_set(entry["marker"], directory, test)
            results.append(result)
            per_patient[(result["marker"], result["variant"])]=patients
    combining={
        marker: resolved_by_combining(per_patient[(marker, "fused")], per_patient[(marker, "imaging_only")])
        for marker in TARGETS if (marker, "fused") in per_patient and (marker, "imaging_only") in per_patient
    }
    out=REPO/"artifacts"/"metrics"/"heldout.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    payload={
        "split": "test", "n_patients": int(len(test)), "bootstrap_resamples": N_BOOT, "sets": results,
        "resolved_by_combining": combining,
    }
    out.write_text(json.dumps(payload, indent=2)+"\n", encoding="utf-8", newline="\n")
    for r in results:
        print(r["marker"], r["variant"], "AUC", r["auc"], r.get("auc_ci95"), "by verdict", r["by_verdict"])
    for marker, counts in combining.items():
        print(marker, "resolved by combining:", counts)


if __name__=="__main__":
    main()
