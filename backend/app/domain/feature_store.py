"""Read-only access to the committed feature table (artifacts/features/features.parquet).

Demo cases are patients from the public dataset; their extracted features live
in this table. Building a FeatureVector takes only feature columns (those that
follow the naming convention) plus age, sex and biopsy history. The lab-result
columns in the same table (idh, mgmt, ...) are never read here, so they cannot
reach a model.
"""
import hashlib
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal, cast

import pandas as pd
import structlog

from app.domain.contracts import FeatureVector, Marker, Sex, parse_feature_name
from app.domain.doubt import CohortReference

logger=structlog.get_logger("feature_store")


def _is_feature_column(name: str) -> bool:
    try:
        parse_feature_name(name)
        return True
    except ValueError:
        return False


@dataclass
class FeatureStore:
    rows: dict[str, dict]=field(default_factory=dict)
    # sha256 of the feature table file: identifies the exact features behind a prediction.
    version: str | None=None
    # Training-split patients, for "is this tumor unlike the training data?" (doubt.py).
    reference: CohortReference | None=None

    def has(self, patient_id: str | None) -> bool:
        return patient_id is not None and patient_id in self.rows

    def vector_for(
        self,
        patient_id: str,
        study_id: str,
        age: int,
        sex: str,
        prior_biopsy: bool | None,
        known_markers: dict[Marker, int],
    ) -> FeatureVector:
        """Age, sex and biopsy history come from the study record (clinical input), not the table."""
        row=self.rows[patient_id]
        features={
            name: None if value is None or (isinstance(value, float) and math.isnan(value)) else float(value)
            for name, value in row.items()
            if _is_feature_column(name)
        }
        return FeatureVector(
            study_id=study_id,
            age=age,
            sex=Sex(sex),
            prior_biopsy=prior_biopsy,
            features=features,
            known_markers=cast(dict[Marker, Literal[0, 1]], known_markers),
        )


def load_feature_store(path: Path) -> FeatureStore:
    if not path.is_file():
        logger.warning("feature_table_missing", path=str(path))
        return FeatureStore()
    table=pd.read_parquet(path)
    if "patient_id" not in table or not table["patient_id"].is_unique:
        raise ValueError("feature table needs a unique patient_id column")
    version="sha256:"+hashlib.sha256(path.read_bytes()).hexdigest()
    rows={str(r["patient_id"]): r for r in table.to_dict(orient="records")}
    train={p: r for p, r in rows.items() if r.get("split")=="train"}
    reference=CohortReference(train) if len(train)>5 else None
    logger.info("feature_table_loaded", patients=len(rows), train=len(train), version=version)
    return FeatureStore(rows=rows, version=version, reference=reference)
