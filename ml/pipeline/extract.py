"""Feature extraction for training and validation scripts: SimpleITK images in, features out.

The implementation lives in backend/app/ingest/radiomics.py so uploads and training compute
exactly the same features; this module adapts SimpleITK images to it and re-exports its names.
"""
import sys
from pathlib import Path

import SimpleITK as sitk

sys.path.insert(0, str(Path(__file__).resolve().parents[2]/"backend"))
from app.ingest.radiomics import (  # noqa: E402,F401
    GLCM_LEVELS,
    REGION_LABELS,
    SEQUENCES,
    Mode,
    brain_zscore,
    descriptors,
    extract_arrays,
    first_order,
    glcm,
    shape,
)


def extract(images: dict[str, sitk.Image], segmentation: sitk.Image, mode: Mode="v1") -> dict[str, float]:
    """All features for one patient; images keyed t1, t1ce, t2, flair (any may be missing)."""
    def load(seq: str):
        return sitk.GetArrayFromImage(images[seq]) if seq in images else None
    return extract_arrays(load, sitk.GetArrayFromImage(segmentation), segmentation.GetSpacing(), mode)
