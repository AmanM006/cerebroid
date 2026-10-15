# Model Training Multiplicity Pipeline
Last verified: 2026-10-15T04:09:06.035516

Executes Layer 2 candidate pool generation (LightGBM, ExtraTrees, ElasticNet).
Evaluates out-of-fold log-loss across repeated 5-fold CV with epsilon=0.03 near-optimality cutoff.
All 15 pipeline variants are registered and verified against artifacts/manifest.json.
