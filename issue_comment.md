### [ML→APP] Layer 2 PR #4 Opened & Checklist Alignment

New PR: https://github.com/Manipal-Hackathon-2026/Void/pull/4  
Branch: `feat/ml-models` branched directly from `main` (`23d6f78`)  
Commit SHA: `fb4e2e08f88ed903e65c9294686542e987fc9214`  
(PR #3 is closed and superseded).

#### Next Items Status:
1. **`baseline_log_loss` in every `meta.json`:** Currently running CV on training base-rate folds to calculate CV out-of-fold base-rate loss across IDH, 1p19q, MGMT, and GRADE for skill & low-signal flagging.
2. **H (`02_training_multiplicity.ipynb`):** Executing full notebook with markdown tables, bootstrap 95% CIs, candidate comparisons, and Stable vs Contested error rates for Checkpoint 1.
3. **D (Verdict Thresholds):** Grid evaluation on OOF set agreement & probability IQR to replace defaults with optimal empirical cutoffs.
4. **DataFrames Fitting:** Passing `X_sub[feature_columns]` as DataFrame into pipeline steps to preserve feature name metadata across `SimpleImputer`.
5. **E2–E4 (`imaging_only`, `clinical_only`, `fused_given_idh`):** Generating candidate sets and updating `ml/configs/markers.yaml`.
6. **Demo Volumes:** Ingested and checksum-validated for `0061`, `0073`, `0243`, `0018`, `0026`, `0232` under `artifacts/volumes/<id>/`.
