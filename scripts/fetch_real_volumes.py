import os
import sys
import gzip
import shutil
import hashlib
import subprocess
from pathlib import Path
import nibabel as nib
import numpy as np

PATIENTS = ["0018", "0026", "0061", "0073", "0232", "0243"]
SEQ_MAP = {
    "T1": "t1.nii.gz",
    "T1c": "t1c.nii.gz",
    "T2": "t2.nii.gz",
    "FLAIR": "flair.nii.gz",
    "tumor_segmentation": "seg.nii.gz",
}

ROOT = Path(r"c:\Users\aman\Documents\mhash\Void")
VOLUMES_DIR = ROOT / "artifacts" / "volumes"
VOLUMES_DIR.mkdir(parents=True, exist_ok=True)

stats = []

for pid in PATIENTS:
    p_full = f"UCSF-PDGM-{pid}"
    out_dir = VOLUMES_DIR / p_full
    out_dir.mkdir(parents=True, exist_ok=True)
    
    for seq_key, out_name in SEQ_MAP.items():
        dest_gz = out_dir / out_name
        if dest_gz.exists() and dest_gz.stat().st_size > 1000:
            print(f"Already exists: {dest_gz}")
        else:
            file_pattern = f"ucsf/{p_full}_nifti/{p_full}_{seq_key}.nii/{p_full}_{seq_key}.nii"
            print(f"Downloading {file_pattern}...")
            cmd = f'kaggle datasets download rukiyeaydn/ucsf-pdgm-filtered -f "{file_pattern}" --unzip'
            res = subprocess.run(cmd, cwd=str(ROOT), shell=True, capture_output=True, text=True)
            if res.returncode != 0:
                print(f"Error downloading {file_pattern}: {res.stderr}")
                sys.exit(1)
            raw_nii = ROOT / f"{p_full}_{seq_key}.nii"
            if not raw_nii.exists():
                print(f"Expected unzipped file not found: {raw_nii}")
                sys.exit(1)
                
            # Compress to .nii.gz
            print(f"Compressing {raw_nii} -> {dest_gz}")
            with open(raw_nii, "rb") as f_in, gzip.open(dest_gz, "wb", compresslevel=6) as f_out:
                shutil.copyfileobj(f_in, f_out)
            raw_nii.unlink()
            
        # Inspect and record stats
        img = nib.load(str(dest_gz))
        data = img.get_fdata()
        md5 = hashlib.md5(dest_gz.read_bytes()).hexdigest()
        
        entry = {
            "patient": p_full,
            "seq": out_name,
            "shape": str(data.shape),
            "dtype": str(data.dtype),
            "min": round(float(np.min(data)), 2),
            "max": round(float(np.max(data)), 2),
            "md5": md5,
        }
        if out_name == "seg.nii.gz":
            entry["unique"] = [int(x) for x in np.unique(data)]
        stats.append(entry)
        print(f"Processed: {p_full}/{out_name} - {entry}")

import json
(ROOT / "volume_stats.json").write_text(json.dumps(stats, indent=2))
print("All 30 volumes downloaded, compressed, and validated!")
