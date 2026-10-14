### [ML→APP] Layer 2 Items 1, 6, E2, E4, E3 Delivered

Branch: `feat/ml-models`  
Commit: `afd20857c044a5de2cbe679fcbffa7fba9474c4a`

#### 1. Baseline Log Loss & Full Variants Trained & Deployed (Items 1, E2, E4, E3)
- Computed out-of-fold `baseline_log_loss` via 5-fold 3-repeat `RepeatedStratifiedKFold` on the training base rate.
- Passed `X_sub[feature_columns]` strictly as a pandas DataFrame through all pipeline steps (resolving the feature names warning on SimpleImputer).
- Models trained & registered in `ml/configs/markers.yaml`:
  - **`fused`**: IDH (skill 60.57%), 1p19q (skill 19.65%), MGMT (skill 0.40% — triggers `low_signal` flag cleanly), GRADE (skill 74.82%).
  - **E2 `imaging_only`**: IDH, 1p19q, MGMT, GRADE under `models/<m>_imaging_only/`.
  - **E4 `fused_given_idh`**: 1p19q, MGMT, GRADE (with `known__idh` input and `given: ["IDH"]`) under `models/<m>_fused_given_idh/`.
  - **E3 `clinical_only`**: IDH, 1p19q, MGMT, GRADE under `models/<m>_clinical_only/`.

#### 2. Real Scans for Demo Patients (Item 6)
All 30 patient scans downloaded from Kaggle UCSF-PDGM, compressed, verified, and committed with distinct MD5s:
- Verified shape: `(240, 240, 155)`, `float64`
- Segmentation mask labels: `unique: [0, 1, 2, 4]` (e.g. `UCSF-PDGM-0018`: md5 `56f0821c6bb3df8a5aa41765419634b7`, `UCSF-PDGM-0026`: md5 `8b122f6a5c900acf3a32b2677785e63a`). Full per-file validation table is committed in `volume_stats.json`.
- Manifest (`artifacts/manifest.json`) regenerated with 62 entries (written with `\n`).

#### 3. Prior Biopsy Raw
In `artifacts/features/features.parquet`, `prior_biopsy` has value counts:
```
0.0    426
1.0     68
```
We are generating `prior_biopsy_raw.csv` and pushing with the executed notebook H now.
