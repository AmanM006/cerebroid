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


class Sequence(StrEnum):
    T1="t1"
    T1C="t1c"
    T2="t2"
    FLAIR="flair"
    SEG="seg"


class VolumeStore:
    def __init__(self, root: Path):
        self.root=root.resolve()

    def path_for(self, patient_id: str | None, sequence: Sequence) -> Path | None:
        """The volume file, or None when this patient has no such volume."""
        if patient_id is None or not _PATIENT_ID_RE.match(patient_id):
            return None
        path=(self.root/patient_id/f"{sequence.value}.nii.gz").resolve()
        if not path.is_relative_to(self.root) or not path.is_file():
            return None
        return path

    def available(self, patient_id: str | None) -> list[Sequence]:
        return [s for s in Sequence if self.path_for(patient_id, s) is not None]
