"""Loads each marker's trained model sets from artifacts/ and serves predictions.

Artifact layout (paths relative to artifacts/):

    manifest.json                 {"files": {path: sha256}, "library_versions": {...}}
    models/<dir>/meta.json        MarkerMeta below
    models/<dir>/models.joblib    list of fitted estimators with predict_proba,
                                  one per member of the near-optimal set

A marker can have several variants, each its own near-optimal set:
    fused                 imaging + age/sex (the default profile)
    imaging_only          no clinical inputs (context-blind counterfactual)
    clinical_only         age/sex only (image-blind counterfactual)
    fused_given_<m>[...]  fused plus lab results the clinician already knows

models.joblib is a pickle, and unpickling can execute code. So nothing is
unpickled unless its sha256 matches the committed manifest; the same check
guarantees the API serves exactly the artifacts in the repo.
"""
import hashlib
import math
import re
from dataclasses import dataclass
from pathlib import Path

import joblib
import pandas as pd
import structlog
import yaml
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.domain.contracts import (
    CLINICAL_COLUMNS,
    SEX_ENCODING,
    FeatureVector,
    Marker,
    SetPrediction,
    known_marker_of,
    validate_model_column,
)
from app.domain.multiplicity_engine import VerdictThresholds, compute_verdict

logger=structlog.get_logger("registry")

MANIFEST_FILE="manifest.json"
META_FILE="meta.json"
MODELS_FILE="models.joblib"

FUSED="fused"
IMAGING_ONLY="imaging_only"
CLINICAL_ONLY="clinical_only"

# A set whose best CV log-loss is less than 5% better than always predicting the training
# base rate has no usable signal: its models agree only because they all echo the prior.
MIN_SKILL=0.05
_VARIANT_RE=re.compile(r"^(fused|imaging_only|clinical_only|fused_given_[a-z0-9_]+)$")


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


def variant_label(marker: Marker, variant: str) -> str:
    """How a marker variant is named in /ready and logs, e.g. "1p19q" or "1p19q:imaging_only"."""
    return marker.value if variant==FUSED else f"{marker.value}:{variant}"


class MarkerMeta(_Strict):
    marker: Marker
    variant: str=FUSED
    given: list[Marker]=Field(default_factory=list)
    feature_columns: list[str]=Field(min_length=1)
    feature_medians: dict[str, float]
    decision_threshold: float=Field(gt=0.0, lt=1.0)
    verdict_thresholds: VerdictThresholds
    epsilon: float=Field(ge=0.0)
    models: list[ModelInfo]=Field(min_length=1)
    library_versions: dict[str, str]
    # CV log-loss of predicting the training base rate for everyone (no inputs at all).
    baseline_log_loss: float | None=Field(default=None, gt=0.0)

    @property
    def skill(self) -> float | None:
        """Relative log-loss improvement of the best set member over the base-rate baseline."""
        if self.baseline_log_loss is None:
            return None
        best=min(m.cv_log_loss for m in self.models)
        return 1.0-best/self.baseline_log_loss

    @field_validator("feature_columns")
    @classmethod
    def _columns_valid(cls, columns: list[str]) -> list[str]:
        if len(set(columns))!=len(columns):
            raise ValueError("feature_columns contains duplicates")
        for name in columns:
            validate_model_column(name)
        return columns

    @model_validator(mode="after")
    def _consistent(self) -> "MarkerMeta":
        if set(self.feature_medians)!=set(self.feature_columns):
            raise ValueError("feature_medians keys must match feature_columns exactly")
        if not _VARIANT_RE.match(self.variant):
            raise ValueError(f"unknown variant {self.variant!r}")
        if self.marker in self.given:
            raise ValueError("a marker cannot be given as input to its own prediction")

        known_inputs={m for c in self.feature_columns if (m:=known_marker_of(c)) is not None}
        if known_inputs!=set(self.given):
            raise ValueError("known__ input columns must match 'given' exactly")
        if bool(self.given)!=self.variant.startswith("fused_given_"):
            raise ValueError("only fused_given_* variants may use known lab results")

        clinical=[c for c in self.feature_columns if c in CLINICAL_COLUMNS]
        imaging=[c for c in self.feature_columns if c not in CLINICAL_COLUMNS and known_marker_of(c) is None]
        if self.variant==IMAGING_ONLY and clinical:
            raise ValueError(f"imaging_only variant uses clinical columns {clinical}")
        if self.variant==CLINICAL_ONLY and imaging:
            raise ValueError("clinical_only variant uses imaging columns")
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
    variant: str=FUSED
    artifact_dir: str


class MarkersConfig(_Strict):
    markers: list[_MarkerEntry]

    @field_validator("markers")
    @classmethod
    def _unique(cls, entries: list[_MarkerEntry]) -> list[_MarkerEntry]:
        keys=[(e.marker, e.variant) for e in entries]
        if len(set(keys))!=len(keys):
            raise ValueError("each marker variant may be configured only once")
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
    """Runs every model in one marker variant's near-optimal set on the same input."""

    def __init__(self, meta: MarkerMeta, models: list, models_sha256: str):
        self.meta=meta
        self.models=models
        self.model_version=f"sha256:{models_sha256}"

    @property
    def marker(self) -> Marker:
        return self.meta.marker

    @property
    def variant(self) -> str:
        return self.meta.variant

    @property
    def low_signal(self) -> bool:
        """True when the set barely beats guessing the base rate, so agreement means nothing."""
        skill=self.meta.skill
        return skill is not None and skill<MIN_SKILL

    def required_inputs(self) -> set[str]:
        return set(self.meta.feature_columns)

    def _frame(self, features: FeatureVector) -> pd.DataFrame:
        row: dict[str, float]={}
        for column in self.meta.feature_columns:
            if column=="age":
                row[column]=float(features.age)
            elif column=="sex":
                row[column]=SEX_ENCODING[features.sex]
            elif column=="prior_biopsy":
                row[column]=math.nan if features.prior_biopsy is None else float(features.prior_biopsy)
            elif (known:=known_marker_of(column)) is not None:
                if known not in features.known_markers:
                    label=variant_label(self.marker, self.variant)
                    raise ValueError(f"{label} needs a known {known.value} result")
                row[column]=float(features.known_markers[known])
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


def load_marker(artifacts_root: Path, entry: _MarkerEntry, manifest: Manifest) -> SetMarkerPredictor:
    meta_path, _=_verified(artifacts_root, f"{entry.artifact_dir}/{META_FILE}", manifest)
    meta=MarkerMeta.model_validate_json(meta_path.read_text(encoding="utf-8"))
    if (meta.marker, meta.variant)!=(entry.marker, entry.variant):
        raise ValueError(
            f"{META_FILE} describes {variant_label(meta.marker, meta.variant)}, "
            f"config expects {variant_label(entry.marker, entry.variant)}"
        )

    models_path, models_sha=_verified(artifacts_root, f"{entry.artifact_dir}/{MODELS_FILE}", manifest)
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
    predictors: dict[tuple[Marker, str], SetMarkerPredictor]
    status: dict[str, str]

    @property
    def all_loaded(self) -> bool:
        return bool(self.status) and all(s=="loaded" for s in self.status.values())

    def get(self, marker: Marker, variant: str=FUSED) -> SetMarkerPredictor | None:
        return self.predictors.get((marker, variant))

    def for_patient(self, marker: Marker, known: set[Marker]) -> SetMarkerPredictor | None:
        """The fused set that uses the most of what the clinician already knows.

        Falls back to the plain fused set when no conditional variant fits. A
        marker the clinician already knows is never predicted.
        """
        if marker in known:
            return None
        candidates=[
            p for (m, _), p in self.predictors.items()
            if m==marker and (p.variant==FUSED or p.variant.startswith("fused_given_"))
            and set(p.meta.given)<=known
        ]
        if not candidates:
            return None
        return max(candidates, key=lambda p: len(p.meta.given))


def load_registry(artifacts_root: Path, config_path: Path) -> MarkerRegistry:
    """Loads every configured marker variant. A variant that fails is reported, never fatal."""
    try:
        config=MarkersConfig.model_validate(yaml.safe_load(config_path.read_text(encoding="utf-8")))
    except (OSError, ValueError, yaml.YAMLError) as exc:
        # A broken config must not stop the API: /ready reports it and no marker is served.
        logger.error("markers_config_invalid", path=str(config_path), detail=str(exc)[:500])
        return MarkerRegistry(predictors={}, status={"markers_config": "invalid"})
    predictors: dict[tuple[Marker, str], SetMarkerPredictor]={}
    status: dict[str, str]={}

    manifest_path=artifacts_root/MANIFEST_FILE
    if not manifest_path.is_file():
        logger.warning("artifact_manifest_missing", path=str(manifest_path))
        missing={variant_label(e.marker, e.variant): "missing" for e in config.markers}
        return MarkerRegistry(predictors={}, status=missing)
    manifest=Manifest.model_validate_json(manifest_path.read_text(encoding="utf-8"))

    for entry in config.markers:
        label=variant_label(entry.marker, entry.variant)
        try:
            predictor=load_marker(artifacts_root, entry, manifest)
            predictors[(entry.marker, entry.variant)]=predictor
            status[label]="loaded"
            logger.info("marker_loaded", marker=label, model_version=predictor.model_version)
        except ArtifactMissingError as exc:
            status[label]="missing"
            logger.warning("marker_missing", marker=label, detail=str(exc))
        except ArtifactIntegrityError as exc:
            status[label]="integrity_error"
            logger.error("marker_integrity_error", marker=label, detail=str(exc))
        except Exception as exc:  # a broken artifact must not take the whole API down
            status[label]="invalid"
            logger.error("marker_invalid", marker=label, detail=str(exc), exc_info=exc)
    return MarkerRegistry(predictors=predictors, status=status)


