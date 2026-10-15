"""External validation on TCGA gliomas, with performance by race, sex and age.

UCSF-PDGM (our training data) comes from one hospital and records no race. The TCGA-GBM
and TCGA-LGG cohorts come from many US hospitals and record race, so we run the deployed
models, unchanged, on them:

- Images and expert tumor outlines: the BraTS 2020 training release (pre-operative TCGA
  scans, skull-stripped and co-registered; same four sequences and same segmentation labels
  1 necrotic core, 2 edema, 4 enhancing). Its name_mapping.csv links each BraTS subject to a
  TCGA patient ID.
- Lab results: cBioPortal study lgggbm_tcga_pub (Ceccarelli et al., Cell 2016): IDH status,
  IDH/1p19q subtype, MGMT promoter status, grade, age, sex.
- Race and ethnicity: the GDC (TCGA) demographic record.

Features are extracted with ml/pipeline/extract.py in mode v1, exactly as for training.
Nothing is refitted: this measures how the deployed models transfer to new hospitals and
scanners. Outputs: artifacts/features/external_tcga.parquet (derived features and labels,
no images) and artifacts/metrics/external_tcga.json.

    backend/.venv/Scripts/python ml/pipeline/external_validation.py E:/Hackathons/data
"""
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import SimpleITK as sitk
from sklearn.metrics import accuracy_score, balanced_accuracy_score, roc_auc_score

REPO=Path(__file__).resolve().parents[2]
sys.path[:0]=[str(REPO/"backend"), str(Path(__file__).parent)]

import extract  # noqa: E402
from app.core.logging import configure_logging  # noqa: E402
from app.domain.contracts import FeatureVector, Marker, Sex  # noqa: E402
from app.domain.profile import build_profile  # noqa: E402
from app.domain.registry import load_registry  # noqa: E402

LABEL_COLUMN={Marker.IDH: "idh", Marker.CODEL_1P19Q: "codeletion_1p19q", Marker.MGMT: "mgmt", Marker.GRADE: "who_grade"}
POSITIVE={Marker.IDH: "mutant", Marker.CODEL_1P19Q: "codeleted", Marker.MGMT: "methylated", Marker.GRADE: "grade 4"}
RACE_GROUPS={"white": "White", "black or african american": "Black or African American", "asian": "Asian"}


def clinical(data: Path) -> pd.DataFrame:
    clin=pd.read_csv(data/"tcga"/"tcga_clinical_merged.csv", index_col=0)
    out=pd.DataFrame(index=clin.index)
    out["age"]=pd.to_numeric(clin["AGE"], errors="coerce")
    out["sex"]=clin["SEX"].map({"Male": 1.0, "Female": 0.0})
    out["race"]=clin["race"].map(lambda r: RACE_GROUPS.get(str(r).lower(), "Other or not reported"))
    out["idh"]=clin["IDH_STATUS"].map({"Mutant": 1.0, "WT": 0.0})
    # Co-deletion is only defined for IDH-mutant tumors; IDH-wildtype tumors count as not codeleted.
    out["codeletion_1p19q"]=clin["IDH_CODEL_SUBTYPE"].map({"IDHmut-codel": 1.0, "IDHmut-non-codel": 0.0, "IDHwt": 0.0})
    out["mgmt"]=clin["MGMT_PROMOTER_STATUS"].map({"Methylated": 1.0, "Unmethylated": 0.0})
    out["who_grade"]=clin["GRADE"].map({"G2": 2.0, "G3": 3.0, "G4": 4.0})
    return out


def subjects(data: Path) -> pd.DataFrame:
    """BraTS subject folders that map to a TCGA patient."""
    mapping=next(data.glob("brats2020/**/name_mapping.csv"))
    names=pd.read_csv(mapping)
    names=names[names["TCGA_TCIA_subject_ID"].astype(str).str.startswith("TCGA-")]
    root=mapping.parent
    names["folder"]=names["BraTS_2020_subject_ID"].map(lambda s: root/s)
    return names[names["folder"].map(Path.is_dir)]


def features_for(folder: Path) -> dict:
    files={p.name.lower(): p for p in folder.glob("*.nii*")}
    def find(suffix: str) -> Path:
        return next(p for n, p in files.items() if n.split(".")[0].endswith(suffix))
    images={k: sitk.ReadImage(str(find(f"_{k}"))) for k in ("t1", "t1ce", "t2", "flair")}
    seg=sitk.ReadImage(str(next(p for n, p in files.items() if "seg" in n)))
    return extract.extract(images, seg, "v1")


def metrics(rows: pd.DataFrame) -> dict:
    y, p, call=rows["label"].to_numpy(), rows["prob"].to_numpy(), rows["call"].to_numpy()
    out={"n": int(len(rows)), "positives": int(y.sum())}
    if len(rows)>=1:
        out["accuracy"]=round(float(accuracy_score(y, call)), 4)
    if len(np.unique(y))==2:
        out["auc"]=round(float(roc_auc_score(y, p)), 4)
        out["balanced_accuracy"]=round(float(balanced_accuracy_score(y, call)), 4)
    stable=rows["verdict"]=="STABLE"
    if stable.any():
        out["stable_n"]=int(stable.sum())
        out["stable_accuracy"]=round(float((call[stable]==y[stable]).mean()), 4)
    return out


def main(data: Path) -> None:
    configure_logging("WARNING")
    clin=clinical(data)
    subs=subjects(data)
    rows=[]
    for _, s in subs.iterrows():
        pid=s["TCGA_TCIA_subject_ID"]
        if pid not in clin.index:
            continue
        try:
            feats=features_for(s["folder"])
        except (StopIteration, RuntimeError) as exc:
            print("skip", pid, exc)
            continue
        rows.append({"patient_id": pid, **clin.loc[pid].to_dict(), **feats})
    table=pd.DataFrame(rows).drop_duplicates("patient_id")
    out=REPO/"artifacts"/"features"/"external_tcga.parquet"
    table.to_parquet(out, index=False)
    print("patients with scans + labels:", len(table), "| race:", table["race"].value_counts().to_dict())

    registry=load_registry(REPO/"artifacts", REPO/"ml"/"configs"/"markers.yaml")
    preds=[]
    for _, r in table.iterrows():
        if pd.isna(r["age"]) or pd.isna(r["sex"]):
            continue
        feats={k: (None if pd.isna(v) else float(v)) for k, v in r.items()
               if "__" in k and isinstance(v, (int, float, np.floating))}
        vector=FeatureVector(
            study_id=r["patient_id"], age=int(np.clip(round(r["age"]), 18, 100)),
            sex=Sex.MALE if r["sex"]==1 else Sex.FEMALE, prior_biopsy=None, features=feats,
        )
        for result in build_profile(registry, vector):
            label=r[LABEL_COLUMN[result.marker]]
            if result.prediction is None or pd.isna(label):
                continue
            positive=float(label==4) if result.marker==Marker.GRADE else float(label)
            preds.append({
                "patient_id": r["patient_id"], "marker": result.marker.value, "race": r["race"],
                "sex": "male" if r["sex"]==1 else "female",
                "age_band": "under 45" if r["age"]<45 else "45-64" if r["age"]<65 else "65+",
                "label": positive, "prob": result.prediction.prob_median,
                "call": float(result.call==POSITIVE[result.marker]),
                "verdict": "LOW_SIGNAL" if result.low_signal else result.prediction.verdict.value,
            })
    preds=pd.DataFrame(preds)
    report: dict={"cohort": "TCGA-GBM + TCGA-LGG (BraTS 2020 pre-operative scans)", "feature_mode": "v1",
                  "patients": int(table["patient_id"].nunique()),
                  "race_counts": table["race"].value_counts().to_dict(), "markers": {}}
    for marker, rows_m in preds.groupby("marker"):
        entry={"overall": metrics(rows_m)}
        for group in ("race", "sex", "age_band"):
            entry[f"by_{group}"]={g: metrics(r) for g, r in rows_m.groupby(group)}
        report["markers"][marker]=entry
    report["features_sha256"]=hashlib.sha256(out.read_bytes()).hexdigest()
    metrics_path=REPO/"artifacts"/"metrics"/"external_tcga.json"
    metrics_path.write_text(json.dumps(report, indent=2)+"\n", encoding="utf-8", newline="\n")
    for marker, entry in report["markers"].items():
        print(marker, entry["overall"], {g: m.get("auc") for g, m in entry["by_race"].items()})


if __name__=="__main__":
    main(Path(sys.argv[1] if len(sys.argv)>1 else "E:/Hackathons/data"))
