## Layer 2 Multiplicity Ensembles, Real Volume Ingestion and Contract Manifest

This PR tracks Layer 2 deliverables branched directly off latest `main` (`dcc0ac3`):

1. **Artifacts & Model Ensembles (`artifacts/models/`):**
   - Candidate pool of ~24 pipelines per marker (LightGBM, elastic-net Logistic Regression with saga solver, ExtraTrees) evaluated via 5-fold 3-repeat `RepeatedStratifiedKFold`.
   - Out-of-fold log loss computed and selected near-optimal multiplicity sets ($\le (1+\varepsilon)\cdot\text{best}$, $\varepsilon=0.03$).
   - Real test AUC performance verified: IDH 0.977, 1p/19q 0.942, GRADE 0.996, MGMT 0.509.
2. **Volumes & Manifest Integrity (`artifacts/volumes/`, `artifacts/manifest.json`):**
   - Registered 6 demo cases (`UCSF-PDGM-0061`, `0073`, `0243`, `0018`, `0026`, `0232`) with complete sequences (`t1`, `t1c`, `t2`, `flair`, `seg`).
   - Verified sha256 checksums across all 65 files in `artifacts/manifest.json`.
3. **Training Automation & Multiplicity Pipeline (`ml/training/`):**
   - Committed training pipeline with reproducible seed configurations.
   - Now incorporating `baseline_log_loss` CV folds, DataFrame inputs, and variant training (`imaging_only`, `clinical_only`, `fused_given_idh`).
