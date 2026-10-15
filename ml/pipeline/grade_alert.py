"""Grade 4 alert threshold, chosen on cross-validation instead of typed in.

The grade call uses a 0.5 cut-off. A grade 4 tumour called "grade 2-3" is the costly error, so the
app flags a grade 2-3 call whose P(grade 4) is still high enough to matter. This script picks
"high enough" from data:

1. Out-of-fold predictions for every training patient: 5-fold stratified CV (3 repeats) where each
   member of the deployed GRADE fused set is refitted on four folds and scores the fifth, so no
   patient is scored by a model that saw it. The set prediction is the median across members, as
   in the app.
2. The threshold is the highest probability at which TARGET_SENSITIVITY (all) of grade 4
   patients are at or above it (they are called grade 4 or flagged).
3. Reported with what it costs: the share of grade 2-3 patients that would be flagged, and how
   many grade 4 patients below the 0.5 call the flag catches.

Output: artifacts/metrics/grade_alert.json, tied to the deployed set's model_version; the API
serves it only while that version is deployed.

    backend/.venv/Scripts/python ml/pipeline/grade_alert.py
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import sklearn
from sklearn.model_selection import RepeatedStratifiedKFold

REPO=Path(__file__).resolve().parents[2]
sys.path[:0]=[str(REPO/"backend"), str(Path(__file__).parent)]

from app.core.logging import configure_logging  # noqa: E402
from app.domain.contracts import Marker  # noqa: E402
from app.domain.registry import load_registry  # noqa: E402

# Catch every grade 4 training patient (out of fold): a missed grade 4 is the costly error.
TARGET_SENSITIVITY=1.0
OUT=REPO/"artifacts"/"metrics"/"grade_alert.json"


def training_table() -> pd.DataFrame:
    """The same training patients the set was fitted on: UCSF train + TCGA train."""
    ucsf=pd.read_parquet(REPO/"artifacts"/"features"/"features.parquet")
    tcga=pd.read_parquet(REPO/"artifacts"/"features"/"external_tcga.parquet")
    table=pd.concat([ucsf[ucsf["split"]=="train"], tcga[tcga["split"]=="train"]], ignore_index=True)
    return table[table["who_grade"].notna()].reset_index(drop=True)


def main() -> None:
    configure_logging("WARNING")
    predictor=load_registry(REPO/"artifacts", REPO/"ml"/"configs"/"markers.yaml").get(Marker.GRADE)
    if predictor is None:
        sys.exit("GRADE fused set is not deployed")
    columns=predictor.meta.feature_columns
    table=training_table()
    X=table.reindex(columns=columns).astype(float)
    y=(table["who_grade"]==4).astype(int).to_numpy()

    cv=RepeatedStratifiedKFold(n_splits=5, n_repeats=3, random_state=0)
    total=np.zeros(len(y))
    counts=np.zeros(len(y))
    for train_idx, test_idx in cv.split(X, y):
        member_probs=[]
        for model in predictor.models:
            fitted=sklearn.base.clone(model).fit(X.iloc[train_idx], y[train_idx])
            member_probs.append(fitted.predict_proba(X.iloc[test_idx])[:, 1])
        total[test_idx]+=np.median(np.vstack(member_probs), axis=0)
        counts[test_idx]+=1
    oof=total/counts

    grade4=np.sort(oof[y==1])
    threshold=float(grade4[int(np.floor((1-TARGET_SENSITIVITY)*len(grade4)))])
    flagged=oof>=threshold
    below_call=(oof<0.5)
    report={
        "marker": "GRADE",
        "variant": predictor.variant,
        "model_version": predictor.model_version,
        "method": ("Highest P(grade 4) at which every grade 4 training patient is called grade 4 or flagged; "
                   "out-of-fold predictions from 5-fold stratified CV x3, set median as in the app."),
        "target_sensitivity": TARGET_SENSITIVITY,
        "threshold": round(threshold, 4),
        "patients": int(len(y)),
        "grade4_patients": int(y.sum()),
        "sensitivity_at_threshold": round(float(flagged[y==1].mean()), 4),
        "sensitivity_at_call": round(float((~below_call)[y==1].mean()), 4),
        "grade2_3_flagged_share": round(float(flagged[(y==0)].mean()), 4),
        "grade2_3_flag_only_share": round(float((flagged & below_call)[y==0].mean()), 4),
        "grade4_missed_by_call_caught": int((flagged & below_call)[y==1].sum()),
        "grade4_missed_by_call": int((below_call)[y==1].sum()),
    }
    # What lower thresholds would cost: grade 4 missed by the 0.5 call that the flag catches, and the
    # share of grade 2-3 patients flagged.
    report["tradeoff"]=[
        {"threshold": t,
         "grade4_missed_by_call_caught": int(((oof>=t) & below_call)[y==1].sum()),
         "grade2_3_flagged_share": round(float(((oof>=t) & below_call)[y==0].mean()), 4)}
        for t in (0.4, 0.3, 0.2, 0.15, 0.1, 0.05)
    ]
    OUT.write_text(json.dumps(report, indent=2)+"\n", encoding="utf-8", newline="\n")
    print(json.dumps(report, indent=2))


if __name__=="__main__":
    main()
