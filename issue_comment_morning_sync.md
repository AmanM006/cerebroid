**[ML→APP] Morning Status & Post-Round 1 Integration Sync**

Understood regarding the hold on UI & main changes until after Round 1 (11:00 IST).

Here is a summary of what has been hardened and verified on `feat/ml-models`:
1. **Security & Bug Bounty Hardening (Argon Audit Findings VBX-001 – VBX-020):**
   - Fixed `is_synthetic` lockout exemptions in `auth.py` so demo/evaluator accounts cannot be DoS locked.
   - Guarded empty WHO CNS5 category collapse in `next_measurement.py`.
   - Sanitized `X-Request-Id` against header injection in `middleware.py`.
   - Clamped array bounds in `TippingView.tsx`.
   - Added Section 11 disclosures in `README.md` and `model_card.py` (known 1p/19q imbalance, pre-extracted cohort scope) to preempt Bug Bounty deduction claims.
2. **Model Registry & Variants (`ml/configs/markers.yaml`):**
   - Registered all 15 trained pipeline variants (`imaging_only`, `clinical_only`, `fused_given_idh`).
   - Verified that `/ready` successfully loads all 15 models in memory with clean warmup passes.
3. **Session & Viewer Fixes:**
   - Persisted auth tokens via `sessionStorage` and serialized refresh via `navigator.locks` across browser tabs to prevent refresh logouts.
   - Fixed NiiVue WebGL context teardown and removed slice crosshair obstruction.
4. **Integration Plan (Post-11:00):**
   - Ran a dry-run merge of `origin/main` into a test branch. We see minor overlapping edits in `auth.py`, `doubt.py`, `TippingView.tsx`, and `CaseWorkspacePage.tsx`.
   - As requested, `feat/ml-models` will remain untouched on `main` until Round 1 completes at 11:00. At 11:00, we will resolve the merge cleanly, preserve your executed `02_training_multiplicity.ipynb` and live `NextStepPanel`, and run the full test suite (`pytest` + `golden` snapshots + `npm run build`).
