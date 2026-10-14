# AI Usage Disclosure

Per event rulebook §1: every AI tool used and its purpose, logged as we go. "Human-reviewed" means
a team member read the generated output before it was committed — nothing here was committed blind.

| Date | Layer | Tool | Purpose | What was generated | Human review |
|---|---|---|---|---|---|
| 2026-10-14 | L0 Foundation | Claude Code (Claude Sonnet 5) | Scaffold the repository: directory layout, FastAPI service (`/health`, `/ready`, structured logging, request-ID middleware, global error handler), Dockerfile, docker-compose, GitHub Actions CI, pre-commit/gitleaks config, and the initial docs (README, SECURITY.md, THREAT_MODEL.md v0, DATA_PROVENANCE.md v0, ADR-001) | All files listed in the Layer 0 commit | Tanish reviewed and approved before commit |
| 2026-10-14 | L1 Data | Claude Code (Claude Sonnet 4.6 Thinking) | Generate Layer 1 feature extraction code: `ml/notebooks/01_feature_extraction.ipynb` (complete Kaggle/Colab notebook: UCSF-PDGM load, follow-up dedup, label encoding, crosswalk join, BraTS volume helpers, pyradiomics extraction loop with caching, interpretable descriptors, patient-level splits, pandera validation, exclusion table, hero case selection, parquet export), `ml/configs/radiomics.yaml` (extraction parameters with rationale), `ml/pipeline/features.py` (pandera schema module with leakage checks), updated `docs/DATA_PROVENANCE.md` | All files listed above | Aman reviewed all generated code before commit |
