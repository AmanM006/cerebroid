"""Locates the committed MRI volumes of demo cases.

Layout: artifacts/volumes/<source patient id>/<sequence>.nii.gz, where the
sequences are the skull-stripped UCSF-PDGM volumes and "seg" is the tumor
segmentation. Paths are built only from the server-side patient id and a fixed
sequence list, never from request text, so a request can't name a file.
"""
import re
from enum import StrEnum
from pathlib import Path

_PATIENT_ID_RE=re.compile(r"^UCSF-PDGM-\d{3,4}$")
_UPLOAD_ID_RE=re.compile(r"^upload-[0-9a-f]{12}$")


class Sequence(StrEnum):
    T1="t1"
    T1C="t1c"
    T2="t2"
    FLAIR="flair"
    SEG="seg"


class VolumeStore:
    """Demo volumes under root/<patient id>/; uploads under uploads_root/<upload id>/volumes/
    (written by app/ingest/worker.py from voxel data only)."""

    def __init__(self, root: Path, uploads_root: Path | None=None):
        self.root=root.resolve()
        self.uploads_root=uploads_root.resolve() if uploads_root else None

    def path_for(self, patient_id: str | None, sequence: Sequence) -> Path | None:
        """The volume file, or None when this patient has no such volume."""
        if patient_id is None:
            return None
        if _PATIENT_ID_RE.match(patient_id):
            base=self.root
            path=(base/patient_id/f"{sequence.value}.nii.gz").resolve()
        elif _UPLOAD_ID_RE.match(patient_id) and self.uploads_root is not None:
            base=self.uploads_root
            path=(base/patient_id/"volumes"/f"{sequence.value}.nii.gz").resolve()
        else:
            return None
        if not path.is_relative_to(base) or not path.is_file():
            return None
        return path

    def available(self, patient_id: str | None) -> list[Sequence]:
        return [s for s in Sequence if self.path_for(patient_id, s) is not None]
