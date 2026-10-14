"""ml/pipeline/features.py — pandera schema for the Layer 1 feature table.

WHY a schema here:
  The feature table is the boundary between ML Track (extraction) and
  the backend (inference). Catching type/range/leakage errors at this
  boundary is far cheaper than debugging them inside the multiplicity
  engine or the API.

Column naming convention (Layer 2 and grouped-SHAP depend on this):
  {sequence}__{region}__{featureclass}__{feature}
      e.g. t1ce__et__glcm__Contrast
           flair__ed__firstorder__Mean
  shape__{region}__shape__{feature}
      e.g. shape__et__shape__MeshVolume
  desc__{name}
      e.g. desc__total_volume_mm3
  Clinical: age, sex
  Targets : idh, codeletion_1p19q, mgmt, who_grade
  Admin   : patient_id, split, fold
  Flags   : missing__{region}  (e.g. missing__ncr)
"""

from __future__ import annotations

import pandera as pa
from pandera import Column, DataFrameSchema, Check


# ---------------------------------------------------------------------------
# Allowed prefixes — anything else is a leakage candidate
# ---------------------------------------------------------------------------
_ALLOWED_PREFIXES = (
    "t1__",
    "t1ce__",
    "t2__",
    "flair__",
    "shape__",
    "desc__",
    "missing__",
    "age",
    "sex",
    "patient_id",
    "split",
    "fold",
    "idh",
    "codeletion_1p19q",
    "mgmt",
    "who_grade",
)

_KNOWN_LEAKAGE = (
    "resection",
    "treatment",
    "survival",
    "vital",
    "mgmt_index",
    "post_op",
    "diagnosis",
)


def _no_leakage_columns(df):
    """Return True if no column name contains a known leakage keyword."""
    for col in df.columns:
        col_lower = col.lower()
        for leak in _KNOWN_LEAKAGE:
            if leak in col_lower:
                return False
    return True


def _only_allowed_prefixes(df):
    """Return True if every column starts with an allowed prefix."""
    for col in df.columns:
        if not any(col.startswith(p) for p in _ALLOWED_PREFIXES):
            return False
    return True


def _patient_in_one_split_only(df):
    """Each patient_id appears exactly once (one row per patient)."""
    return df["patient_id"].is_unique


# ---------------------------------------------------------------------------
# Core (always-present) columns
# ---------------------------------------------------------------------------
CORE_SCHEMA = DataFrameSchema(
    columns={
        "patient_id": Column(
            str,
            checks=[
                Check(lambda s: s.str.len() > 0, error="patient_id must be non-empty"),
            ],
            nullable=False,
            unique=True,
            description="De-identified patient identifier from UCSF-PDGM crosswalk",
        ),
        "split": Column(
            str,
            checks=[Check.isin(["train", "test"])],
            nullable=False,
            description="train or test (patient-level, stratified on IDH)",
        ),
        "fold": Column(
            pa.Int64,
            checks=[Check.greater_than_or_equal_to(-1)],
            nullable=False,
            description=(
                "CV fold index for train rows (0-based); -1 for test rows"
            ),
        ),
        "age": Column(
            pa.Float64,
            checks=[
                Check.greater_than_or_equal_to(18),
                Check.less_than_or_equal_to(100),
            ],
            nullable=False,
            description="Patient age at scan (years); input feature",
        ),
        "sex": Column(
            pa.Int64,
            checks=[Check.isin([0, 1])],
            nullable=False,
            description="Biological sex encoded as 0=F, 1=M; input feature",
        ),
        # --- targets (nullable: missing labels are allowed) ---
        "idh": Column(
            pa.Float64,
            checks=[Check.isin([0.0, 1.0])],
            nullable=True,
            description="IDH status: 1=mutant, 0=wildtype, NaN=unknown",
        ),
        "codeletion_1p19q": Column(
            pa.Float64,
            checks=[Check.isin([0.0, 1.0])],
            nullable=True,
            description=(
                "1p/19q co-deletion: 1=co-deleted, "
                "0=non-co-deleted, NaN=unknown"
            ),
        ),

        "mgmt": Column(
            pa.Float64,
            checks=[Check.isin([0.0, 1.0])],
            nullable=True,
            description=(
                "MGMT promoter methylation: 1=methylated, "
                "0=unmethylated, NaN=unknown"
            ),
        ),
        "who_grade": Column(
            pa.Float64,
            checks=[Check.isin([2.0, 3.0, 4.0])],
            nullable=True,
            description="WHO grade (2/3/4); optional output, not an input",
        ),
        # --- interpretable descriptors ---
        # (present for every patient; NaN when the sub-region mask is empty)

        "desc__total_volume_mm3": Column(
            pa.Float64,
            checks=[Check.greater_than_or_equal_to(0)],
            nullable=True,
            description="Total tumor volume in mm³ (enhancing + necrotic + edema)",
        ),
        "desc__enhancing_fraction": Column(
            pa.Float64,
            checks=[
                Check.greater_than_or_equal_to(0),
                Check.less_than_or_equal_to(1),
            ],
            nullable=True,
            description="Fraction of tumor that is enhancing tumor (ET / total)",
        ),
        "desc__necrosis_fraction": Column(
            pa.Float64,
            checks=[
                Check.greater_than_or_equal_to(0),
                Check.less_than_or_equal_to(1),
            ],
            nullable=True,
            description="Fraction of tumor that is necrotic core (NCR / total)",
        ),
        "desc__edema_to_core_ratio": Column(
            pa.Float64,
            checks=[Check.greater_than_or_equal_to(0)],
            nullable=True,
            description=(
                "Edema voxel count / core (ET+NCR) voxel count. "
                "NaN when core is empty; see missing__ncr / missing__et flags."
            ),
        ),
    },
    checks=[
        Check(_no_leakage_columns, error="Leakage column detected"),
        Check(_only_allowed_prefixes, error="Column with disallowed prefix detected"),
        Check(_patient_in_one_split_only, error="Duplicate patient_id rows"),
    ],
    # Radiomics and flag columns are validated by prefix checks above;
    # we do not enumerate them statically because their count depends on
    # which sequences and regions are present for a given cohort run.
    strict=False,
    name="VBX_FeatureTable_v1",
)


def validate(df):
    """Validate *df* against the feature table schema.

    Raises pandera.errors.SchemaError if validation fails.
    Returns the validated (and coerced) DataFrame on success.
    """
    return CORE_SCHEMA.validate(df, lazy=True)
