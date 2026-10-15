### [ML→APP] Items 3, 4, 5 Completed & Pushed

Branch: `feat/ml-models`  
Commit: `9203363a6c3e3431473fff45784bdf4f125515b2`

1. **3 New Demo Patient Scans (Item 3):**
   - Ingested authentic Kaggle scans for `UCSF-PDGM-0162`, `UCSF-PDGM-0282`, and `UCSF-PDGM-0327` across all 5 sequences (`t1`, `t1c`, `t2`, `flair`, `seg`).
   - Verified shapes: `(240, 240, 155)`, `float64`, discrete labels:
     - `0162`: `seg` unique `[0, 1, 2, 4]`, md5 `b93daa9acd0b6651d0b31e0cf4495660`
     - `0282`: `seg` unique `[0, 2, 4]`, md5 `f7989af4b9a3d2601a40c391fbf5ca63`
     - `0327`: `seg` unique `[0, 2]`, md5 `a0c30dd57b753849a7cd109251aa2b93`
   - Total demo set is now 9 patients (45 distinct volumes).

2. **`prior_biopsy_raw.csv` Committed (Item 4):**
   - Committed `artifacts/features/prior_biopsy_raw.csv` containing `patient_id` and raw values across all 494 cases.

3. **`volume_stats.json` Relocated (Item 5):**
   - Moved to `artifacts/volumes/volume_stats.json` with all 45 volume checksums and recorded in `artifacts/manifest.json` (80 files tracked).

4. **Held-out Evaluation Metrics:**
   - Ran `ml/pipeline/evaluate.py` and updated `artifacts/metrics/heldout.json`.

Proceeding directly with **H (`02_training_multiplicity.ipynb`)** and **D (CV verdict threshold grid tuning)**.
