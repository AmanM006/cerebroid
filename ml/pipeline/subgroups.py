"""Held-out performance by patient subgroup (UCSF-PDGM test split), for the deployed fused sets.

Reports accuracy, AUC (when both classes are present) and Stable-call accuracy by sex,
age band and tumor type, so any gap between groups is measured rather than hidden.
UCSF-PDGM's public release has no race field; race is evaluated on the external TCGA cohort
(ml/pipeline/external_validation.py). Small subgroups are reported with their size.

    backend/.venv/Scripts/python ml/pipeline/subgroups.py
"""
import json
from pathlib import Path

import pandas as pd

import evaluate
from external_validation import metrics

REPO=Path(__file__).resolve().parents[2]


def tumor_type(row: pd.Series) -> str:
    if row["idh"]==0:
        return "IDH-wildtype"
    if row["codeletion_1p19q"]==1:
        return "IDH-mutant, codeleted"
    return "IDH-mutant, not codeleted"


def main() -> None:
    table=pd.read_parquet(REPO/"artifacts"/"features"/"features.parquet")
    test=table[table["split"]=="test"].set_index("patient_id")
    groups=pd.DataFrame({
        "sex": test["sex"].map({1: "male", 0: "female"}),
        "age_band": pd.cut(test["age"], [0, 45, 65, 200], right=False, labels=["under 45", "45-64", "65+"]).astype(str),
        "tumor_type": test.apply(tumor_type, axis=1),
    })
    report: dict={"cohort": "UCSF-PDGM held-out test split", "patients": int(len(test)), "markers": {}}
    for marker, directory in (("IDH", "idh"), ("1p19q", "1p19q"), ("MGMT", "mgmt"), ("GRADE", "grade")):
        _, per_patient=evaluate.evaluate_set(marker, REPO/"artifacts"/"models"/directory, test.reset_index())
        rows=per_patient.join(groups)
        entry={"overall": metrics(rows)}
        for group in ("sex", "age_band", "tumor_type"):
            entry[f"by_{group}"]={g: metrics(r) for g, r in rows.groupby(group)}
        report["markers"][marker]=entry
        print(marker, {g: (m["n"], m.get("auc"), m.get("accuracy")) for g, m in entry["by_sex"].items()},
              {g: (m["n"], m.get("auc"), m.get("accuracy")) for g, m in entry["by_age_band"].items()})
    out=REPO/"artifacts"/"metrics"/"subgroups_ucsf.json"
    out.write_text(json.dumps(report, indent=2)+"\n", encoding="utf-8", newline="\n")
    print("wrote", out)


if __name__=="__main__":
    main()
