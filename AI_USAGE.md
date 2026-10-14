# AI Usage Disclosure

Per event rulebook §1: every AI tool used and its purpose, logged as we go. "Human-reviewed" means
a team member read the generated output before it was committed — nothing here was committed blind.

| Date | Layer | Tool | Purpose | What was generated | Human review |
|---|---|---|---|---|---|
| 2026-10-14 | L0 Foundation | Claude Code (Claude Sonnet 5) | Scaffold the repository: directory layout, FastAPI service (`/health`, `/ready`, structured logging, request-ID middleware, global error handler), Dockerfile, docker-compose, GitHub Actions CI, pre-commit/gitleaks config, and the initial docs (README, SECURITY.md, THREAT_MODEL.md v0, DATA_PROVENANCE.md v0, ADR-001) | All files listed in the Layer 0 commit | Tanish reviewed and approved before commit |
| 2026-10-14 | Shared contracts | Claude Code (Claude Opus 5.5) | Define the shared types between the ML and API tracks: provenance enum, markers, feature-column naming rules, `FeatureVector`, `SetPrediction`, `EvidenceItem`, `MarkerPredictor` protocol | `backend/app/domain/contracts.py`, `backend/tests/unit/test_contracts.py` | Tanish reviewed and approved before commit |
| 2026-10-14 | Database & auth | Claude Code (Claude Opus 5.5) | Database models and Alembic migration; argon2id login with lockout; JWT access tokens; rotating refresh tokens with reuse detection; shared authorization dependency for cases; account-creation CLI; auth, token-forgery and IDOR tests; threat model and README updates | `backend/app/db/`, `backend/app/core/security.py`, `backend/app/services/auth.py`, `backend/app/api/{auth,cases,deps,schemas}.py`, `backend/app/cli.py`, `backend/tests/` | Tanish reviewed and approved before commit |
