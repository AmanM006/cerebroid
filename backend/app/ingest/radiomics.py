"""Radiomics-style feature extraction for one patient: the single implementation used by training
(through ml/pipeline/extract.py) and by uploads (app/ingest/worker.py).

Two modes, same feature names (so models can be retrained on either):

- "v1": what the committed feature table and the deployed models use. First-order statistics use
  raw scanner intensities; GLCM texture quantises each tumor region to 32 grey levels between that
  region's min and max.
- "v2": intensity-robust. Each sequence is z-scored over the patient's own brain (non-zero voxels of
  the skull-stripped volume); GLCM quantises between the region's 1st and 99th percentiles.

Shape features and tumor descriptors come from the segmentation only. Arrays are in SimpleITK order
(z, y, x) with spacing given as (x, y, z); the segmentation uses UCSF-PDGM/BraTS labels (1 necrotic
core, 2 edema, 4 enhancing tumor). Volumes are requested one sequence at a time through a loader, so
only one MRI volume is in memory at once.
"""
from collections.abc import Callable
from typing import Literal

import numpy as np
from scipy import stats
from skimage import measure
from skimage.feature import graycomatrix, graycoprops

Mode=Literal["v1", "v2"]
SEQUENCES=("t1", "t1ce", "t2", "flair")
REGION_LABELS={"et": 4, "ncr": 1, "ed": 2}
GLCM_LEVELS=32


def descriptors(seg: np.ndarray, spacing_xyz: tuple[float, float, float]) -> dict[str, float]:
    """Interpretable tumor composition from the segmentation; NaN when undefined, never 0."""
    voxel=float(spacing_xyz[0]*spacing_xyz[1]*spacing_xyz[2])
    n_et, n_ncr, n_ed=int((seg==4).sum()), int((seg==1).sum()), int((seg==2).sum())
    total=n_et+n_ncr+n_ed
    core=n_et+n_ncr
    return {
        "missing__et": float(n_et==0),
        "missing__ncr": float(n_ncr==0),
        "missing__ed": float(n_ed==0),
        "desc__total_volume_mm3": total*voxel if total else np.nan,
        "desc__enhancing_fraction": n_et/total if total else np.nan,
        "desc__necrosis_fraction": n_ncr/total if total else np.nan,
        "desc__edema_to_core_ratio": n_ed/core if core else np.nan,
    }


def first_order(voxels: np.ndarray) -> dict[str, float]:
    v=voxels.astype(float)
    if len(v)==0:
        return {}
    p10, p25, p75, p90=np.percentile(v, [10, 25, 75, 90])
    hist, _=np.histogram(v, bins=64)
    prob=hist/(hist.sum()+1e-10)
    return {
        "Mean": float(np.mean(v)),
        "Variance": float(np.var(v)),
        "Skewness": float(stats.skew(v)),
        "Kurtosis": float(stats.kurtosis(v)),
        "Minimum": float(np.min(v)),
        "Maximum": float(np.max(v)),
        "10Percentile": float(p10),
        "90Percentile": float(p90),
        "InterquartileRange": float(p75-p25),
        "Median": float(np.median(v)),
        "MeanAbsoluteDeviation": float(np.mean(np.abs(v-np.mean(v)))),
        "RootMeanSquared": float(np.sqrt(np.mean(v**2))),
        "Energy": float(np.sum(v**2)),
        "Entropy": float(-np.sum(prob*np.log2(prob+1e-10))),
        "Range": float(np.max(v)-np.min(v)),
    }


def glcm(volume: np.ndarray, mask: np.ndarray, mode: Mode) -> dict[str, float]:
    """GLCM texture averaged over axial slices with at least 16 masked voxels, 4 in-plane angles."""
    masked=volume[mask].astype(float)
    if len(masked)<16:
        return {}
    lo, hi=(masked.min(), masked.max()) if mode=="v1" else np.percentile(masked, [1, 99])
    if hi==lo:
        return {}
    props=("contrast", "correlation", "energy", "homogeneity", "dissimilarity")
    accum: dict[str, list[float]]={p: [] for p in props}
    for z in range(volume.shape[0]):
        slice_mask=mask[z]
        if slice_mask.sum()<16:
            continue
        img=((np.clip(volume[z], lo, hi)-lo)/(hi-lo)*(GLCM_LEVELS-1)).astype(np.uint8)
        img[slice_mask==0]=0
        matrix=graycomatrix(
            img, distances=[1], angles=[0, np.pi/4, np.pi/2, 3*np.pi/4], levels=GLCM_LEVELS,
            symmetric=True, normed=True,
        )
        for p in props:
            accum[p].append(float(graycoprops(matrix, p).mean()))
    if not accum["contrast"]:
        return {}
    return {p.capitalize(): float(np.mean(values)) for p, values in accum.items()}


def shape(mask: np.ndarray, spacing_xyz: tuple[float, float, float]) -> dict[str, float]:
    if mask.sum()<8:
        return {}
    sp=(spacing_xyz[2], spacing_xyz[1], spacing_xyz[0])
    volume=float(mask.sum())*sp[0]*sp[1]*sp[2]
    feats={"VoxelVolume": volume}
    verts, faces, _, _=measure.marching_cubes(mask.astype(float), level=0.5, spacing=sp)
    tris=verts[faces]
    area=float(0.5*np.linalg.norm(np.cross(tris[:, 1]-tris[:, 0], tris[:, 2]-tris[:, 0]), axis=1).sum())
    feats["MeshSurfaceArea"]=area
    if area>0:
        feats["Sphericity"]=float(np.pi**(1/3)*(6*volume)**(2/3)/area)
    props=measure.regionprops(mask.astype(np.uint8), spacing=sp)
    if props:
        p=props[0]
        feats["MajorAxisLength"]=float(p.axis_major_length)
        feats["MinorAxisLength"]=float(p.axis_minor_length)
        eigs=sorted(p.inertia_tensor_eigvals, reverse=True)
        if eigs[0]>0:
            feats["Elongation"]=float(np.sqrt(eigs[1]/eigs[0]))
            feats["Flatness"]=float(np.sqrt(eigs[2]/eigs[0]))
    return feats


def brain_zscore(volume: np.ndarray) -> np.ndarray:
    """Scale a skull-stripped volume by the mean and SD of its own brain (non-zero) voxels."""
    brain=volume[volume!=0].astype(float)
    if len(brain)<100 or brain.std()==0:
        return volume.astype(float)
    out=(volume.astype(float)-brain.mean())/brain.std()
    out[volume==0]=0.0
    return out


def extract_arrays(
    load: Callable[[str], np.ndarray | None],
    seg: np.ndarray,
    spacing_xyz: tuple[float, float, float],
    mode: Mode="v1",
) -> dict[str, float]:
    """All features for one patient, named per app/domain/contracts.py. load(seq) returns that
    sequence's (z, y, x) array, or None when the sequence is missing."""
    row=descriptors(seg, spacing_xyz)
    for region, label in REGION_LABELS.items():
        if row[f"missing__{region}"]:
            continue
        for name, value in shape(seg==label, spacing_xyz).items():
            row[f"shape__{region}__shape__{name}"]=float(value)
    for seq in SEQUENCES:
        loaded=load(seq)
        if loaded is None:
            continue
        volume=loaded.astype(float)
        del loaded
        if mode=="v2":
            volume=brain_zscore(volume)
        for region, label in REGION_LABELS.items():
            if row[f"missing__{region}"]:
                continue
            mask=seg==label
            voxels=volume[mask]
            if len(voxels)==0:
                continue
            for name, value in first_order(voxels).items():
                row[f"{seq}__{region}__firstorder__{name}"]=value
            for name, value in glcm(volume, mask, mode).items():
                row[f"{seq}__{region}__glcm__{name}"]=value
        del volume
    return row
