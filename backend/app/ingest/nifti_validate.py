"""Checks on uploaded NIfTI files. NIfTI is an attack surface, so nothing is handed to an image
library until these pass:

- size: each upload is capped; gzip is decompressed in chunks with a hard cap (gzip-bomb defence)
- header: NIfTI-1 magic, 3D only, positive dimensions within limits, an allowed data type, finite
  positive voxel spacing, and a file long enough for the data it declares
- consistency (worker): every sequence shares the mask's grid (size, spacing, origin, direction)
- mask: labels only 0/1/2/4 (UCSF-PDGM/BraTS) with enough tumor voxels
- skull stripping (worker): a heuristic that rejects heads with the face and skull still present, as
  3D head MRI can be used to reconstruct a face. It checks that the outer border of the volume is
  background. Limitation: a tightly cropped non-stripped scan could pass; a stripped scan whose brain
  touches the volume edge could be rejected.
"""
import gzip
import math
import struct
from pathlib import Path

GZIP_MAGIC=b"\x1f\x8b"
MAX_FILE_BYTES=40_000_000          # one uploaded file, as sent
MAX_UNCOMPRESSED_BYTES=160_000_000  # one volume after decompression
MAX_DIM=512
MAX_VOXELS=40_000_000
# NIfTI-1 datatype code -> bytes per voxel (integers and floats only; no complex or RGB)
DATATYPES={2: 1, 4: 2, 8: 4, 16: 4, 64: 8, 256: 1, 512: 2, 768: 4}
MASK_LABELS={0, 1, 2, 4}
MIN_TUMOR_VOXELS=100
BORDER=3
MAX_BORDER_FOREGROUND=0.02


class UploadError(Exception):
    """A rejected upload: error_code is stable and shown to the user with a plain message."""

    def __init__(self, error_code: str, message: str):
        super().__init__(message)
        self.error_code=error_code
        self.message=message


def decompress_capped(src: Path, dst: Path) -> None:
    """Writes the uncompressed NIfTI to dst, gunzipping in chunks and stopping at the size cap."""
    with src.open("rb") as f:
        gzipped=f.read(2)==GZIP_MAGIC
    if not gzipped:
        dst.write_bytes(src.read_bytes())
        return
    written=0
    try:
        with gzip.open(src, "rb") as zin, dst.open("wb") as out:
            while chunk:=zin.read(1<<20):
                written+=len(chunk)
                if written>MAX_UNCOMPRESSED_BYTES:
                    raise UploadError("UPLOAD_TOO_LARGE", "A volume is too large once decompressed.")
                out.write(chunk)
    except (OSError, EOFError) as exc:
        raise UploadError("NIFTI_INVALID", "A file is not a valid gzip-compressed NIfTI volume.") from exc


def check_header(path: Path, name: str) -> tuple[int, int, int]:
    """Validates the NIfTI-1 header of an uncompressed file and returns its (x, y, z) size."""
    data=path.read_bytes()[:352]
    if len(data)<348:
        raise UploadError("NIFTI_INVALID", f"{name}: not a NIfTI file.")
    for endian in ("<", ">"):
        if struct.unpack(endian+"i", data[:4])[0]==348:
            break
    else:
        raise UploadError("NIFTI_INVALID", f"{name}: not a NIfTI-1 file.")
    if data[344:348] not in (b"n+1\x00", b"ni1\x00"):
        raise UploadError("NIFTI_INVALID", f"{name}: not a NIfTI-1 file.")
    if data[344:348]!=b"n+1\x00":
        raise UploadError("NIFTI_INVALID", f"{name}: header and image must be in one .nii file.")
    dim=struct.unpack(endian+"8h", data[40:56])
    ndim, size=dim[0], dim[1:4]
    if not (ndim==3 or (ndim==4 and dim[4]==1)):
        raise UploadError("NIFTI_INVALID", f"{name}: expected a 3D volume.")
    if any(d<1 or d>MAX_DIM for d in size) or size[0]*size[1]*size[2]>MAX_VOXELS:
        raise UploadError("NIFTI_INVALID", f"{name}: volume dimensions are out of range.")
    datatype=struct.unpack(endian+"h", data[70:72])[0]
    if datatype not in DATATYPES:
        raise UploadError("NIFTI_INVALID", f"{name}: unsupported voxel data type.")
    pixdim=struct.unpack(endian+"8f", data[76:108])
    if any(not math.isfinite(p) or p<=0 or p>20 for p in pixdim[1:4]):
        raise UploadError("NIFTI_INVALID", f"{name}: voxel spacing must be positive.")
    vox_offset=struct.unpack(endian+"f", data[108:112])[0]
    if not math.isfinite(vox_offset) or vox_offset<348:
        raise UploadError("NIFTI_INVALID", f"{name}: invalid data offset.")
    needed=int(vox_offset)+size[0]*size[1]*size[2]*DATATYPES[datatype]
    if path.stat().st_size<needed:
        raise UploadError("NIFTI_INVALID", f"{name}: file is shorter than its header declares.")
    return size[0], size[1], size[2]
