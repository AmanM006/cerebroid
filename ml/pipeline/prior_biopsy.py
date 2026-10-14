"""prior_biopsy: whether the patient had a biopsy before the MRI.

Source: the UCSF-PDGM clinical CSV column "Biopsy prior to imaging", copied
unmodified per patient into artifacts/features/prior_biopsy_raw.csv. Encoding:
"Yes" -> 1.0, "No" -> 0.0, anything else (blank, unrecorded) -> NaN, so a
missing record is never mistaken for "no biopsy".

    backend/.venv/Scripts/python ml/pipeline/prior_biopsy.py           check the table
    backend/.venv/Scripts/python ml/pipeline/prior_biopsy.py --write   rewrite the column
"""
import argparse
import hashlib
from pathlib import Path

import numpy as np
import pandas as pd

REPO=Path(__file__).resolve().parents[2]
RAW=REPO/"artifacts"/"features"/"prior_biopsy_raw.csv"
TABLE=REPO/"artifacts"/"features"/"features.parquet"
ENCODING={"yes": 1.0, "no": 0.0}


def encode(raw: pd.Series) -> pd.Series:
    """Yes/No to 1.0/0.0; blank or any other value to NaN."""
    return raw.astype("string").str.strip().str.lower().map(ENCODING).astype(float)


def expected_column(table: pd.DataFrame, raw: pd.DataFrame) -> pd.Series:
    mapping=dict(zip(raw["patient_id"], encode(raw["raw_value"]), strict=True))
    return table["patient_id"].map(mapping).astype(float)


def mismatches(table: pd.DataFrame, raw: pd.DataFrame) -> list[str]:
    """Patients whose table value differs from the encoded raw value (NaN equals NaN)."""
    expected=expected_column(table, raw).to_numpy()
    actual=table["prior_biopsy"].astype(float).to_numpy()
    same=(expected==actual) | (np.isnan(expected) & np.isnan(actual))
    return table.loc[~same, "patient_id"].tolist()


def main() -> None:
    parser=argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="rewrite prior_biopsy in the feature table")
    args=parser.parse_args()
    raw=pd.read_csv(RAW, dtype=str, keep_default_na=False)
    table=pd.read_parquet(TABLE)
    missing=set(table["patient_id"])-set(raw["patient_id"])
    if missing:
        raise SystemExit(f"{len(missing)} patients have no raw prior_biopsy value")
    print("raw values:", raw["raw_value"].value_counts(dropna=False).to_dict())
    encoded=expected_column(table, raw)
    print("encoded:", {"yes (1.0)": int((encoded==1).sum()), "no (0.0)": int((encoded==0).sum()),
                       "unrecorded (NaN)": int(encoded.isna().sum())})
    if args.write:
        table["prior_biopsy"]=encoded
        table.to_parquet(TABLE, index=False)
        print("wrote", TABLE.name, "sha256", hashlib.sha256(TABLE.read_bytes()).hexdigest())
    else:
        bad=mismatches(table, raw)
        print("table matches the raw column" if not bad else f"{len(bad)} mismatches, e.g. {bad[:5]}")


if __name__=="__main__":
    main()
