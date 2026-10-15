"""Processes one uploaded study in its own short-lived process:

    python -m app.ingest.worker <study directory>

Input: <dir>/raw/{t1,t1c,t2,flair,seg} as uploaded (server-chosen names, never the client's).
Output: <dir>/features.json (model inputs, extracted exactly as for training, mode v1),
<dir>/volumes/<sequence>.nii.gz (re-saved from voxel data and geometry only, so no header text
from the upload survives), and <dir>/result.json ({"status": "ready"} or "failed" with an
error_code and message). The raw and decompressed files are deleted whatever the outcome.

Running in a separate process means a malformed file that crashes the image library cannot take
the API down; the parent enforces a timeout, and the CPU limit below stops a runaway parse.
Memory: only one MRI volume is loaded at a time, and only the slices containing tumor (plus one
on each side) are kept for extraction; every feature depends on those slices only.
"""
import json
import math
import shutil
import sys
from pathlib import Path

import numpy as np

from app.ingest.nifti_validate import (
    BORDER,
    MASK_LABELS,
    MAX_BORDER_FOREGROUND,
    MIN_TUMOR_VOXELS,
    UploadError,
    check_header,
    decompress_capped,
)

SEQUENCES=("t1", "t1c", "t2", "flair")
RADIOMICS_NAME={"t1": "t1", "t1c": "t1ce", "t2": "t2", "flair": "flair"}
GRID_TOLERANCE=1e-3
CPU_SECONDS=120


def _limit_resources() -> None:
    if sys.platform=="win32":
        return  # no rlimits on Windows (local development); the parent's timeout still applies
    import resource
    try:
        resource.setrlimit(resource.RLIMIT_CPU, (CPU_SECONDS, CPU_SECONDS))
    except (ValueError, OSError):
        pass


def _border_foreground(array: np.ndarray) -> float:
    """Share of non-background voxels in the outer BORDER-voxel shell of the volume."""
    b=BORDER
    shell=[array[:b], array[-b:], array[:, :b], array[:, -b:], array[:, :, :b], array[:, :, -b:]]
    total=sum(s.size for s in shell)
    return sum(int(np.count_nonzero(s)) for s in shell)/total


def _same_grid(a, b) -> bool:
    return (
        a.GetSize()==b.GetSize()
        and all(math.isclose(x, y, rel_tol=GRID_TOLERANCE, abs_tol=GRID_TOLERANCE)
                for x, y in zip(a.GetSpacing()+a.GetOrigin()+a.GetDirection(),
                                b.GetSpacing()+b.GetOrigin()+b.GetDirection()))
    )


def _write_clean(sitk, array: np.ndarray, like, path: Path) -> None:
    """Saves voxels with the geometry of `like` and nothing else from the uploaded header."""
    image=sitk.GetImageFromArray(array)
    image.SetSpacing(like.GetSpacing())
    image.SetOrigin(like.GetOrigin())
    image.SetDirection(like.GetDirection())
    sitk.WriteImage(image, str(path), True)


def process(study_dir: Path) -> dict:
    import SimpleITK as sitk

    from app.ingest.radiomics import extract_arrays

    raw, work, out=study_dir/"raw", study_dir/"work", study_dir/"volumes"
    work.mkdir(exist_ok=True)
    out.mkdir(exist_ok=True)
    names=(*SEQUENCES, "seg")
    for name in names:
        source=raw/name
        if not source.is_file():
            raise UploadError("MISSING_SEQUENCE", f"{name} is missing.")
        decompress_capped(source, work/f"{name}.nii")
        source.unlink()
        check_header(work/f"{name}.nii", name)

    reader=sitk.ImageFileReader()
    info={}
    for name in names:
        reader.SetFileName(str(work/f"{name}.nii"))
        try:
            reader.ReadImageInformation()
        except RuntimeError as exc:
            raise UploadError("NIFTI_INVALID", f"{name}: the image could not be read.") from exc
        info[name]=(reader.GetSize(), reader.GetSpacing(), reader.GetOrigin(), reader.GetDirection())
    seg_image=sitk.ReadImage(str(work/"seg.nii"))
    for name in SEQUENCES:
        reader.SetFileName(str(work/f"{name}.nii"))
        reader.ReadImageInformation()
        if not _same_grid(reader, seg_image):
            raise UploadError("NIFTI_SHAPE_MISMATCH",
                              f"{name} is not on the same voxel grid as the tumor mask.")

    seg_values=sitk.GetArrayViewFromImage(seg_image)
    labels=set(np.unique(seg_values).tolist())
    if not labels<=MASK_LABELS:
        raise UploadError("MASK_INVALID", "The tumor mask may only contain labels 0, 1, 2 and 4.")
    seg=np.asarray(seg_values, dtype=np.uint8)
    if np.count_nonzero(seg)<MIN_TUMOR_VOXELS:
        raise UploadError("MASK_INVALID", "The tumor mask contains too few tumor voxels.")
    tumor_slices=np.nonzero(seg.any(axis=(1, 2)))[0]
    z0, z1=max(0, int(tumor_slices[0])-1), min(seg.shape[0], int(tumor_slices[-1])+2)
    _write_clean(sitk, seg, seg_image, out/"seg.nii.gz")
    spacing=seg_image.GetSpacing()
    del seg_values

    def load(radiomics_name: str) -> np.ndarray:
        name=next(k for k, v in RADIOMICS_NAME.items() if v==radiomics_name)
        image=sitk.ReadImage(str(work/f"{name}.nii"))
        view=sitk.GetArrayViewFromImage(image)
        # Defence in depth: SimpleITK's NIfTI reader already replaces NaN and infinity on read.
        if not np.isfinite(view).all():
            raise UploadError("NIFTI_INVALID", f"{name} contains invalid voxel values (NaN or infinity).")
        if _border_foreground(view)>MAX_BORDER_FOREGROUND:
            raise UploadError(
                "NOT_SKULL_STRIPPED",
                f"{name} does not look skull-stripped: upload brain-extracted volumes only.",
            )
        _write_clean(sitk, np.asarray(view, dtype=np.float32), image, out/f"{name}.nii.gz")
        slab=np.array(view[z0:z1])
        del view, image
        (work/f"{name}.nii").unlink()
        return slab

    features=extract_arrays(load, seg[z0:z1], spacing, "v1")
    return {k: (None if not math.isfinite(float(v)) else float(v)) for k, v in features.items()}


def main(study_dir: Path) -> int:
    _limit_resources()
    result: dict
    try:
        features=process(study_dir)
        (study_dir/"features.json").write_text(json.dumps(features), encoding="utf-8")
        result={"status": "ready"}
    except UploadError as exc:
        result={"status": "failed", "error_code": exc.error_code, "message": exc.message}
    except Exception:  # noqa: BLE001 - any other failure is reported generically, never with details
        result={"status": "failed", "error_code": "EXTRACTION_FAILED",
                "message": "The volumes could not be processed."}
    finally:
        shutil.rmtree(study_dir/"raw", ignore_errors=True)
        shutil.rmtree(study_dir/"work", ignore_errors=True)
    (study_dir/"result.json").write_text(json.dumps(result), encoding="utf-8")
    return 0 if result["status"]=="ready" else 1


if __name__=="__main__":
    sys.exit(main(Path(sys.argv[1])))
