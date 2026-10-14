"""Checks the committed feature table against the shared contract.

Skipped until artifacts/features/features.parquet exists. Once it does, any
push or pull request that breaks naming, leaks a clinical field, or violates
the cohort rules fails CI with the exact offending columns or rows.
"""
import math

import pandas as pd
import pytest

from app.core.config import get_settings
from app.domain.contracts import parse_feature_name

FEATURE_TABLE=get_settings().artifacts_root/"features"/"features.parquet"

ADMIN_COLUMNS={"patient_id", "split", "fold"}
CLINICAL_COLUMNS={"age", "sex"}
OPTIONAL_CLINICAL_COLUMNS={"prior_biopsy"}
TARGET_COLUMNS={"idh", "codeletion_1p19q", "mgmt", "who_grade"}
LEAKAGE_WORDS=(
    "resection", "treatment", "survival", "vital", "index", "post_op", "postop", "diagnosis", "pathology",
)

pytestmark=pytest.mark.skipif(not FEATURE_TABLE.is_file(), reason="feature table not committed")


@pytest.fixture(scope="module")
def table() -> pd.DataFrame:
    return pd.read_parquet(FEATURE_TABLE)


def _feature_columns(table: pd.DataFrame) -> list[str]:
    non_features=ADMIN_COLUMNS|CLINICAL_COLUMNS|OPTIONAL_CLINICAL_COLUMNS|TARGET_COLUMNS
    return [c for c in table.columns if c not in non_features]


def test_required_columns_present(table):
    missing=(ADMIN_COLUMNS|CLINICAL_COLUMNS|TARGET_COLUMNS)-set(table.columns)
    assert not missing, f"missing columns: {sorted(missing)}"


def test_every_feature_column_follows_naming_convention(table):
    bad=[]
    for column in _feature_columns(table):
        try:
            parse_feature_name(column)
        except ValueError:
            bad.append(column)
    assert not bad, f"columns outside the naming convention: {bad[:20]}"


def test_no_leakage_columns(table):
    leaked=[c for c in table.columns if any(w in c.lower() for w in LEAKAGE_WORDS)]
    assert not leaked, f"possible leakage columns: {leaked}"


def test_feature_columns_are_numeric(table):
    non_numeric=[c for c in _feature_columns(table) if not pd.api.types.is_numeric_dtype(table[c])]
    assert not non_numeric, f"non-numeric feature columns: {non_numeric[:20]}"


def test_no_infinite_feature_values(table):
    features=table[_feature_columns(table)].astype(float)
    infinite=[c for c in features.columns if features[c].map(math.isinf).any()]
    assert not infinite, f"columns with inf values: {infinite[:20]}"


def test_one_row_per_patient_and_no_follow_up_scans(table):
    assert table["patient_id"].is_unique, "duplicate patient_id rows"
    follow_ups=table.loc[table["patient_id"].str.contains("_FU", na=False), "patient_id"].tolist()
    assert not follow_ups, f"follow-up scans in the table: {follow_ups[:10]}"


def test_splits_and_folds(table):
    assert set(table["split"])<={"train", "test"}
    assert (table.loc[table["split"]=="test", "fold"]==-1).all(), "test rows must have fold -1"
    assert (table.loc[table["split"]=="train", "fold"]>=0).all(), "train rows must have a fold"
    assert (table["split"]=="test").any() and (table["split"]=="train").any()


def test_clinical_inputs_in_range(table):
    assert table["age"].between(18, 100).all(), "age outside 18-100"
    assert set(table["sex"].dropna().astype(int))<={0, 1}, "sex must be 0 (F) / 1 (M)"
    assert table[["age", "sex"]].notna().all().all(), "age/sex may not be missing"
    if "prior_biopsy" in table:
        assert set(table["prior_biopsy"].dropna())<={0, 1}, "prior_biopsy must be 0/1, NaN when unrecorded"


def test_target_encodings(table):
    for column in ("idh", "codeletion_1p19q", "mgmt"):
        assert set(table[column].dropna())<={0, 1}, f"{column} must be 0/1/NaN"
    assert set(table["who_grade"].dropna())<={2, 3, 4}, "who_grade must be 2/3/4/NaN"


def test_descriptor_fractions_in_unit_interval(table):
    for column in ("desc__enhancing_fraction", "desc__necrosis_fraction"):
        if column in table:
            assert table[column].dropna().between(0, 1).all(), f"{column} outside [0, 1]"
