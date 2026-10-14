"""Loads each marker's trained model set from artifacts/ and serves predictions.

Artifact layout (paths relative to artifacts/):

    manifest.json                 {"files": {path: sha256}, "library_versions": {...}}
    models/<marker>/meta.json     MarkerMeta below
    models/<marker>/models.joblib list of fitted estimators with predict_proba,
                                  one per member of the near-optimal set

models.joblib is a pickle, and unpickling can execute code. So nothing is
unpickled unless its sha256 matches the committed manifest; the same check
guarantees the API serves exactly the artifacts in the repo.
"""
import hashlib
import math
from dataclasses import dataclass
from pathlib import Path

import joblib
import pandas as pd
import structlog
import yaml
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.domain.contracts import (
    SEX_ENCODING,
    FeatureVector,
    Marker,
    SetPrediction,
    validate_model_column,
)
from app.domain.multiplicity_engine import VerdictThresholds, compute_verdict

logger=structlog.get_logger("registry")

MANIFEST_FILE="manifest.json"
META_FILE="meta.json"
MODELS_FILE="models.joblib"


class ArtifactMissingError(Exception):
    pass


class ArtifactIntegrityError(Exception):
    pass


class ModelOutputError(Exception):
    """A model returned something that isn't a probability; never passed on to users."""


class _Strict(BaseModel):
    model_config=ConfigDict(extra="forbid", frozen=True)


class ModelInfo(_Strict):
    model_id: str=Field(min_length=1)
    family: str=Field(min_length=1)
    cv_log_loss: float=Field(ge=0.0)


class MarkerMeta(_Strict):
    marker: Marker
    feature_columns: list[str]=Field(min_length=1)
    feature_medians: dict[str, float]
    decision_threshold: float=Field(gt=0.0, lt=1.0)
    verdict_thresholds: VerdictThresholds
    epsilon: float=Field(ge=0.0)
    models: list[ModelInfo]=Field(min_length=1)
    library_versions: dict[str, str]

    @field_validator("feature_columns")
    @classmethod
    def _columns_valid(cls, columns: list[str]) -> list[str]:
        if len(set(columns))!=len(columns):
            raise ValueError("feature_columns contains duplicates")
        for name in columns:
            validate_model_column(name)
        return columns

    @model_validator(mode="after")
    def _medians_cover_columns(self) -> "MarkerMeta":
        if set(self.feature_medians)!=set(self.feature_columns):
            raise ValueError("feature_medians keys must match feature_columns exactly")
        return self


class Manifest(_Strict):
    files: dict[str, str]
    library_versions: dict[str, str]

    @field_validator("files")
    @classmethod
    def _sha256_format(cls, files: dict[str, str]) -> dict[str, str]:
        for path, digest in files.items():
            if len(digest)!=64 or any(c not in "0123456789abcdef" for c in digest):
                raise ValueError(f"not a lowercase sha256 hex digest for {path}")
        return files


class _MarkerEntry(_Strict):
    marker: Marker
    artifact_dir: str


class MarkersConfig(_Strict):
    markers: list[_MarkerEntry]

    @field_validator("markers")
    @classmethod
    def _unique(cls, entries: list[_MarkerEntry]) -> list[_MarkerEntry]:
        if len({e.marker for e in entries})!=len(entries):
            raise ValueError("each marker may be configured only once")
        return entries


def sha256_file(path: Path) -> str:
    digest=hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1<<20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _verified(artifacts_root: Path, relative: str, manifest: Manifest) -> tuple[Path, str]:
    """Returns (path, sha256) only if the file is listed in the manifest and matches it."""
    expected=manifest.files.get(relative)
    if expected is None:
        raise ArtifactIntegrityError(f"{relative} is not listed in the manifest")
    root=artifacts_root.resolve()
    path=(root/relative).resolve()
    if not path.is_relative_to(root):
        raise ArtifactIntegrityError(f"{relative} points outside the artifacts directory")
    if not path.is_file():
        raise ArtifactMissingError(f"{relative} does not exist")
    actual=sha256_file(path)
    if actual!=expected:
        raise ArtifactIntegrityError(f"{relative} sha256 does not match the manifest")
    return path, actual


class SetMarkerPredictor:
    """Runs every model in one marker's near-optimal set on the same input."""

    def __init__(self, meta: MarkerMeta, models: list, models_sha256: str):
        self.meta=meta
        self.models=models
        self.model_version=f"sha256:{models_sha256}"

    @property
    def marker(self) -> Marker:
        return self.meta.marker

    def required_inputs(self) -> set[str]:
        return set(self.meta.feature_columns)

    def _frame(self, features: FeatureVector) -> pd.DataFrame:
        row: dict[str, float]={}
        for column in self.meta.feature_columns:
            if column=="age":
                row[column]=float(features.age)
            elif column=="sex":
                row[column]=SEX_ENCODING[features.sex]
            else:
                value=features.features.get(column)
                row[column]=math.nan if value is None else float(value)
        return pd.DataFrame([row], columns=self.meta.feature_columns)

    def _probabilities(self, frame: pd.DataFrame) -> list[float]:
        probabilities=[]
        for info, model in zip(self.meta.models, self.models, strict=True):
            p=float(model.predict_proba(frame)[0, 1])
            if not math.isfinite(p) or not 0.0<=p<=1.0:
                raise ModelOutputError(f"{self.marker.value}/{info.model_id} returned {p}")
            probabilities.append(p)
        return probabilities

    def predict_set(self, features: FeatureVector) -> SetPrediction:
        probabilities=self._probabilities(self._frame(features))
        threshold=self.meta.decision_threshold
        return SetPrediction(
            marker=self.marker,
            model_probabilities=probabilities,
            decision_threshold=threshold,
            verdict=compute_verdict(probabilities, threshold, self.meta.verdict_thresholds),
            model_version=self.model_version,
        )

    def warm_up(self) -> None:
        """One prediction on the training cohort's median row, to prove the set actually runs."""
        frame=pd.DataFrame([self.meta.feature_medians], columns=self.meta.feature_columns)
        self._probabilities(frame)


def load_marker(artifacts_root: Path, artifact_dir: str, manifest: Manifest) -> SetMarkerPredictor:
    meta_path, _=_verified(artifacts_root, f"{artifact_dir}/{META_FILE}", manifest)
    meta=MarkerMeta.model_validate_json(meta_path.read_text(encoding="utf-8"))

    models_path, models_sha=_verified(artifacts_root, f"{artifact_dir}/{MODELS_FILE}", manifest)
    # Safe to unpickle only because _verified() matched the committed sha256 above.
    models=joblib.load(models_path)
    if not isinstance(models, list) or len(models)!=len(meta.models):
        raise ValueError(f"{MODELS_FILE} must be a list of {len(meta.models)} models (see {META_FILE})")
    if not all(callable(getattr(m, "predict_proba", None)) for m in models):
        raise ValueError(f"every model in {MODELS_FILE} must have predict_proba")

    predictor=SetMarkerPredictor(meta, models, models_sha)
    predictor.warm_up()
    return predictor


@dataclass
class MarkerRegistry:
    predictors: dict[Marker, SetMarkerPredictor]
    status: dict[Marker, str]

    @property
    def all_loaded(self) -> bool:
        return bool(self.status) and all(s=="loaded" for s in self.status.values())

    def get(self, marker: Marker) -> SetMarkerPredictor | None:
        return self.predictors.get(marker)


def load_registry(artifacts_root: Path, config_path: Path) -> MarkerRegistry:
    """Loads every configured marker. A marker that fails is reported, never fatal."""
    config=MarkersConfig.model_validate(yaml.safe_load(config_path.read_text(encoding="utf-8")))
    predictors: dict[Marker, SetMarkerPredictor]={}
    status: dict[Marker, str]={}

    manifest_path=artifacts_root/MANIFEST_FILE
    if not manifest_path.is_file():
        logger.warning("artifact_manifest_missing", path=str(manifest_path))
        return MarkerRegistry(predictors={}, status={e.marker: "missing" for e in config.markers})
    manifest=Manifest.model_validate_json(manifest_path.read_text(encoding="utf-8"))

    for entry in config.markers:
        try:
            predictor=load_marker(artifacts_root, entry.artifact_dir, manifest)
            predictors[entry.marker]=predictor
            status[entry.marker]="loaded"
            logger.info("marker_loaded", marker=entry.marker.value, model_version=predictor.model_version)
        except ArtifactMissingError as exc:
            status[entry.marker]="missing"
            logger.warning("marker_missing", marker=entry.marker.value, detail=str(exc))
        except ArtifactIntegrityError as exc:
            status[entry.marker]="integrity_error"
            logger.error("marker_integrity_error", marker=entry.marker.value, detail=str(exc))
        except Exception as exc:  # a broken artifact must not take the whole API down
            status[entry.marker]="invalid"
            logger.error("marker_invalid", marker=entry.marker.value, detail=str(exc), exc_info=exc)
    return MarkerRegistry(predictors=predictors, status=status)
