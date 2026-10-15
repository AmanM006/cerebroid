"""TCGA gliomas: second training site and held-out test, with performance by race, sex and age.

UCSF-PDGM comes from one hospital and its public release has no race field. The TCGA-GBM and
TCGA-LGG cohorts come from many US hospitals and record race. A fixed patient-level split
(tcga_split: 70% train, 30% test, stratified by IDH and race) adds the training part to the
model sets (ml/training/train_all_variants.py); the deployed models are scored here on the
30% they never saw:

- Images and expert tumor outlines: the BraTS 2020 training release (pre-operative TCGA
  scans, skull-stripped and co-registered; same four sequences and same segmentation labels
  1 necrotic core, 2 edema, 4 enhancing). Its name_mapping.csv links each BraTS subject to a
  TCGA patient ID.
- Lab results: cBioPortal study lgggbm_tcga_pub (Ceccarelli et al., Cell 2016): IDH status,
  IDH/1p19q subtype, MGMT promoter status, grade, age, sex.
- Race and ethnicity: the GDC (TCGA) demographic record.

Features are extracted with ml/pipeline/extract.py in mode v1, exactly as for UCSF.
Outputs: artifacts/features/external_tcga.parquet (derived features and labels, no images)
and artifacts/metrics/external_tcga.json.

    backend/.venv/Scripts/python ml/pipeline/external_validation.py E:/Hackathons/data   # extract + score
    backend/.venv/Scripts/python ml/pipeline/external_validation.py --score             # score only
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

LABEL_COLUMN={
    Marker.IDH: "idh", Marker.CODEL_1P19Q: "codeletion_1p19q", Marker.MGMT: "mgmt", Marker.GRADE: "who_grade",
}
POSITIVE={
    Marker.IDH: "mutant", Marker.CODEL_1P19Q: "codeleted", Marker.MGMT: "methylated", Marker.GRADE: "grade 4",
}
RACE_GROUPS={"white": "White", "black or african american": "Black or African American", "asian": "Asian"}


def clinical(data: Path) -> pd.DataFrame:
    clin=pd.read_csv(data/"tcga"/"tcga_clinical_merged.csv", index_col=0)
    out=pd.DataFrame(index=clin.index)
    out["age"]=pd.to_numeric(clin["AGE"], errors="coerce")
    out["sex"]=clin["SEX"].map({"Male": 1.0, "Female": 0.0})
    out["race"]=clin["race"].map(lambda r: RACE_GROUPS.get(str(r).lower(), "Other or not reported"))
    out["idh"]=clin["IDH_STATUS"].map({"Mutant": 1.0, "WT": 0.0})
    # Co-deletion is only defined for IDH-mutant tumors; IDH-wildtype tumors count as not codeleted.
    out["codeletion_1p19q"]=clin["IDH_CODEL_SUBTYPE"].map(
        {"IDHmut-codel": 1.0, "IDHmut-non-codel": 0.0, "IDHwt": 0.0}
    )
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


FEATURES=REPO/"artifacts"/"features"/"external_tcga.parquet"
TEST_FRACTION=0.3


def tcga_split(table: pd.DataFrame, seed: int=0) -> pd.Series:
    """Patient-level 70/30 train/test split of the TCGA cohort, stratified by IDH status and race
    (White / other), so minority patients and both IDH groups appear in both parts. Deterministic."""
    white=(table["race"]=="White").map({True: "w", False: "o"})
    key=table["idh"].fillna(-1).astype(int).astype(str)+"_"+white
    rng=np.random.default_rng(seed)
    split=pd.Series("train", index=table.index)
    for _, idx in table.groupby(key).groups.items():
        idx=list(idx)
        rng.shuffle(idx)
        split.loc[idx[:round(TEST_FRACTION*len(idx))]]="test"
    return split
METRICS=REPO/"artifacts"/"metrics"/"external_tcga.json"


def build_table(data: Path) -> pd.DataFrame:
    """Features and labels for every BraTS scan with TCGA lab results (needs the raw scans)."""
    clin=clinical(data)
    rows=[]
    for _, s in subjects(data).iterrows():
        pid=s["TCGA_TCIA_subject_ID"]
        if pid not in clin.index:
            continue
        try:
            feats=features_for(s["folder"])
        except (StopIteration, RuntimeError) as exc:
            print("skip", pid, exc)
            continue
        rows.append({"patient_id": pid, **clin.loc[pid].to_dict(), **feats})
    return pd.DataFrame(rows).drop_duplicates("patient_id")


def predict(table: pd.DataFrame) -> pd.DataFrame:
    """One row per patient and marker: label, deployed-model probability, call and verdict."""
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
    return pd.DataFrame(preds)


def report(table: pd.DataFrame, preds: pd.DataFrame) -> dict:
    out: dict={"cohort": "TCGA-GBM + TCGA-LGG held-out test split (BraTS 2020 pre-operative scans)",
               "feature_mode": "v1", "patients": int(table["patient_id"].nunique()),
               "race_counts": table["race"].value_counts().to_dict(), "markers": {}}
    for marker, rows_m in preds.groupby("marker"):
        entry={"overall": metrics(rows_m)}
        for group in ("race", "sex", "age_band"):
            entry[f"by_{group}"]={g: metrics(r) for g, r in rows_m.groupby(group)}
        out["markers"][marker]=entry
    return out


def score() -> None:
    """Scores the deployed models on the held-out TCGA test split and writes the report."""
    configure_logging("WARNING")
    table=pd.read_parquet(FEATURES)
    test=table[table["split"]=="test"]
    result=report(test, predict(test))
    result["training_patients_tcga"]=int(len(table)-len(test))
    result["features_sha256"]=hashlib.sha256(FEATURES.read_bytes()).hexdigest()
    METRICS.write_text(json.dumps(result, indent=2)+"\n", encoding="utf-8", newline="\n")
    print("held-out TCGA patients:", len(test), "| race:", test["race"].value_counts().to_dict())
    for marker, entry in result["markers"].items():
        print(marker, entry["overall"], {g: m.get("auc") for g, m in entry["by_race"].items()})


def main(data: Path) -> None:
    configure_logging("WARNING")
    table=build_table(data)
    table["split"]=tcga_split(table)
    table.to_parquet(FEATURES, index=False)
    print("patients with scans + labels:", len(table), "| race:", table["race"].value_counts().to_dict())
    score()


if __name__=="__main__":
    if sys.argv[1:]==["--score"]:
        score()
    else:
        main(Path(sys.argv[1] if len(sys.argv)>1 else "E:/Hackathons/data"))
