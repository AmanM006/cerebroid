"""Artifact stress test: how much simulated scan problems move the features and the calls.

Uses the committed demo-patient volumes (artifacts/volumes, real UCSF-PDGM scans).
Each perturbation is applied to every patient, features are re-extracted with
ml/pipeline/extract.py, and compared with the clean extraction:

- feature agreement: Lin's concordance correlation coefficient (CCC) per feature across
  patients, clean vs perturbed. CCC penalizes shifts and scale changes as well as noise,
  which is what matters to a model trained on absolute values. Reported as the share of
  features with CCC >= 0.9, for the current extraction (v1) and the normalized one (v2).
- calls (v1 only, the deployed models): how many marker calls and verdicts change.

    backend/.venv/Scripts/python ml/pipeline/stress_test.py
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import SimpleITK as sitk
from scipy import ndimage

REPO=Path(__file__).resolve().parents[2]
sys.path[:0]=[str(REPO/"backend"), str(Path(__file__).parent)]

import extract  # noqa: E402
from app.core.logging import configure_logging  # noqa: E402
from app.domain.contracts import FeatureVector, Sex  # noqa: E402
from app.domain.profile import build_profile  # noqa: E402
from app.domain.registry import load_registry  # noqa: E402

FILES={"t1": "t1", "t1ce": "t1c", "t2": "t2", "flair": "flair"}
RNG_SEED=0


def _brain_sd(volume: np.ndarray) -> float:
    brain=volume[volume!=0]
    return float(brain.std()) if len(brain) else 1.0


def _bias_field(shape: tuple[int, ...], strength: float) -> np.ndarray:
    """Smooth multiplicative shading, like a coil sensitivity field: 1 +/- strength across the head."""
    z, y, x=(np.linspace(-1, 1, n) for n in shape)
    field=np.cos(np.pi/2*z)[:, None, None]*0.5+np.sin(np.pi/2*y)[None, :, None]*0.3+np.cos(np.pi/2*x)[None, None, :]*0.2
    field=(field-field.min())/(field.max()-field.min())
    return 1.0+strength*(2*field-1)


def perturb(arrays: dict[str, np.ndarray], seg: np.ndarray, kind: str, rng: np.random.Generator):
    out={}
    for seq, vol in arrays.items():
        brain=vol!=0
        v=vol.astype(float).copy()
        if kind.startswith("noise"):
            level=0.05 if kind=="noise_5pct" else 0.10
            v[brain]+=rng.normal(0, level*_brain_sd(vol), int(brain.sum()))
        elif kind=="bias_field_15pct":
            v=v*_bias_field(v.shape, 0.15)
        elif kind=="scanner_gain_x1.25":
            v=v*1.25
        elif kind=="gain_offset":
            v[brain]=v[brain]*0.8+0.1*float(vol[brain].mean())
        v[~brain]=0
        out[seq]=v
    new_seg=np.roll(seg, 1, axis=2) if kind=="outline_shift_1vox" else seg
    if kind=="outline_erode_1vox":
        new_seg=np.zeros_like(seg)
        for label in (1, 2, 4):
            new_seg[ndimage.binary_erosion(seg==label)]=label
    return out, new_seg


PERTURBATIONS=[
    "noise_5pct", "noise_10pct", "bias_field_15pct", "scanner_gain_x1.25", "gain_offset",
    "outline_shift_1vox", "outline_erode_1vox",
]


def _image(array: np.ndarray, like: sitk.Image) -> sitk.Image:
    img=sitk.GetImageFromArray(array)
    img.CopyInformation(like)
    return img


def ccc(a: np.ndarray, b: np.ndarray) -> float:
    ok=np.isfinite(a) & np.isfinite(b)
    a, b=a[ok], b[ok]
    if len(a)<3:
        return float("nan")
    va, vb=a.var(), b.var()
    if va==0 and vb==0:
        return 1.0 if np.allclose(a, b) else 0.0
    return float(2*np.cov(a, b, bias=True)[0, 1]/(va+vb+(a.mean()-b.mean())**2))


def family(column: str) -> str:
    if column.startswith(("shape__", "desc__")):
        return "shape & composition"
    return "texture (GLCM)" if "__glcm__" in column else "intensity (first-order)"


def main() -> None:
    configure_logging("WARNING")
    table=pd.read_parquet(REPO/"artifacts"/"features"/"features.parquet").set_index("patient_id")
    patients=sorted(p.name for p in (REPO/"artifacts"/"volumes").iterdir() if p.is_dir())
    registry=load_registry(REPO/"artifacts", REPO/"ml"/"configs"/"markers.yaml")
    rng=np.random.default_rng(RNG_SEED)

    clean: dict[str, dict]={"v1": {}, "v2": {}}
    perturbed: dict[str, dict]={k: {"v1": {}, "v2": {}} for k in PERTURBATIONS}
    for pid in patients:
        base=REPO/"artifacts"/"volumes"/pid
        images={k: sitk.ReadImage(str(base/f"{v}.nii.gz")) for k, v in FILES.items()}
        seg_img=sitk.ReadImage(str(base/"seg.nii.gz"))
        arrays={k: sitk.GetArrayFromImage(img) for k, img in images.items()}
        seg=sitk.GetArrayFromImage(seg_img)
        for mode in ("v1", "v2"):
            clean[mode][pid]=extract.extract(images, seg_img, mode)
        for kind in PERTURBATIONS:
            p_arrays, p_seg=perturb(arrays, seg, kind, rng)
            p_images={k: _image(a, images[k]) for k, a in p_arrays.items()}
            p_seg_img=_image(p_seg.astype(seg.dtype), seg_img)
            for mode in ("v1", "v2"):
                perturbed[kind][mode][pid]=extract.extract(p_images, p_seg_img, mode)
        print("extracted", pid, flush=True)

    def call_set(features: dict, pid: str) -> dict[str, tuple[str | None, str | None]]:
        row=table.loc[pid]
        vector=FeatureVector(
            study_id=pid, age=int(round(row["age"])), sex=Sex.MALE if int(row["sex"])==1 else Sex.FEMALE,
            prior_biopsy=None if pd.isna(row["prior_biopsy"]) else bool(row["prior_biopsy"]),
            features={k: (None if v is None or (isinstance(v, float) and np.isnan(v)) else float(v))
                      for k, v in features.items()},
        )
        return {
            r.marker.value: (r.call, None if r.prediction is None else r.prediction.verdict.value)
            for r in build_profile(registry, vector)
        }

    clean_calls={pid: call_set(clean["v1"][pid], pid) for pid in patients}
    results=[]
    for kind in PERTURBATIONS:
        entry: dict={"perturbation": kind}
        for mode in ("v1", "v2"):
            columns=sorted(set(clean[mode][patients[0]]))
            scores={c: ccc(np.array([clean[mode][p].get(c, np.nan) for p in patients], dtype=float),
                           np.array([perturbed[kind][mode][p].get(c, np.nan) for p in patients], dtype=float))
                    for c in columns}
            by_family: dict[str, list[float]]={}
            for c, s in scores.items():
                if np.isfinite(s):
                    by_family.setdefault(family(c), []).append(s)
            entry[mode]={f: round(float(np.mean(np.array(v)>=0.9)), 3) for f, v in sorted(by_family.items())}
        flips, verdicts, total=0, 0, 0
        per_marker: dict[str, int]={}
        for pid in patients:
            after=call_set(perturbed[kind]["v1"][pid], pid)
            for marker, (call, verdict) in clean_calls[pid].items():
                total+=1
                if after[marker][0]!=call:
                    flips+=1
                    per_marker[marker]=per_marker.get(marker, 0)+1
                if after[marker][1]!=verdict:
                    verdicts+=1
        entry["v1_calls"]={"compared": total, "calls_changed": flips, "verdicts_changed": verdicts,
                           "calls_changed_by_marker": per_marker}
        results.append(entry)
        print(json.dumps(entry), flush=True)

    out=REPO/"artifacts"/"metrics"/"robustness.json"
    out.write_text(json.dumps({
        "patients": patients, "seed": RNG_SEED,
        "metric": "share of features with Lin's CCC >= 0.9 (clean vs perturbed, across patients)",
        "results": results,
    }, indent=2)+"\n", encoding="utf-8", newline="\n")
    print("wrote", out)


if __name__=="__main__":
    main()
