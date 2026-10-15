"""Headline metrics on patients the models never saw, for the "Training data & fairness" card.

Two held-out sets, scored by the deployed model sets exactly as the app scores a case:
- UCSF-PDGM test split (99 patients, same hospital as most training data)
- TCGA test split (51 patients from other US hospitals)

Per marker: patients with a lab result, accuracy, sensitivity (recall: share of positive patients
called positive), specificity (share of negative patients called negative), and AUC. Markers whose
sets are flagged low-signal are reported as such, without metrics.

    backend/.venv/Scripts/python ml/pipeline/unseen_metrics.py
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score

REPO=Path(__file__).resolve().parents[2]
sys.path[:0]=[str(REPO/"backend"), str(Path(__file__).parent)]

import external_validation as ev  # noqa: E402
from app.core.logging import configure_logging  # noqa: E402
from app.domain.registry import load_registry  # noqa: E402

OUT=REPO/"artifacts"/"metrics"/"unseen.json"
MARKERS=("IDH", "1p19q", "GRADE", "MGMT")


def summarise(preds: pd.DataFrame) -> dict:
    out={}
    for marker in MARKERS:
        rows=preds[preds["marker"]==marker]
        if rows.empty:
            continue
        if (rows["verdict"]=="LOW_SIGNAL").all():
            out[marker]={"low_signal": True, "n": int(len(rows))}
            continue
        y, call, prob=rows["label"].to_numpy(), rows["call"].to_numpy(), rows["prob"].to_numpy()
        pos, neg=y==1, y==0
        out[marker]={
            "low_signal": False,
            "n": int(len(rows)),
            "positives": int(pos.sum()),
            "accuracy": round(float((call==y).mean()), 4),
            "sensitivity": round(float((call[pos]==1).mean()), 4) if pos.any() else None,
            "specificity": round(float((call[neg]==0).mean()), 4) if neg.any() else None,
            "auc": round(float(roc_auc_score(y, prob)), 4) if len(np.unique(y))==2 else None,
        }
    return out


def main() -> None:
    configure_logging("WARNING")
    ucsf=pd.read_parquet(REPO/"artifacts"/"features"/"features.parquet")
    ucsf=ucsf[ucsf["split"]=="test"].assign(race="not recorded")
    tcga=pd.read_parquet(ev.FEATURES)
    tcga=tcga[tcga["split"]=="test"]
    registry=load_registry(REPO/"artifacts", REPO/"ml"/"configs"/"markers.yaml")
    report={
        "model_versions": {
            m.value: p.model_version for (m, v), p in registry.predictors.items() if v=="fused"
        },
        "cohorts": [
            {"name": "UCSF held-out (same hospital)", "patients": int(len(ucsf)),
             "markers": summarise(ev.predict(ucsf))},
            {"name": "TCGA held-out (other hospitals)", "patients": int(len(tcga)),
             "markers": summarise(ev.predict(tcga))},
        ],
    }
    OUT.write_text(json.dumps(report, indent=2)+"\n", encoding="utf-8", newline="\n")
    print(json.dumps(report["cohorts"], indent=1))


if __name__=="__main__":
    main()
