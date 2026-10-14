# VBX — From Image to Clinical Story

> Manipal Hackathon 2026 · Team **Void** · Problem Statement: "From Image to Clinical Story"
> Status: **Layer 0 (Foundation)** — API skeleton only. No ML, no auth, no upload pipeline yet.
> This README is a skeleton: every section below exists per the event rulebook's documentation
> requirements, filled in progressively as each build layer (see [CLAUDE.md](CLAUDE.md) §9) lands.

## 1. Project & team details
- **Team:** Void
- **Repository:** https://github.com/Manipal-Hackathon-2026/Void
- **Problem statement:** From Image to Clinical Story
- **Team members:** TODO (fill in before Judging R1)

## 2. Solution summary
A pre-operative "virtual molecular biopsy" for diffuse gliomas. From multi-sequence brain MRI,
a tumor segmentation mask, and patient age/sex, VBX predicts the tumor's molecular profile
(IDH mutation, 1p/19q co-deletion, MGMT promoter methylation, WHO grade) and — uniquely —
measures how *stable* each call is by checking agreement across a set of near-equally-accurate
models (predictive multiplicity), so the system can say "confirm with tissue" when imaging
genuinely cannot decide. Full product spec: [CLAUDE.md](CLAUDE.md) §2.

## 3. Architecture & stack
- **Backend:** Python 3.11, FastAPI, Pydantic v2, SQLAlchemy 2 + Alembic, PostgreSQL
- **ML:** pandas, numpy, scikit-learn, LightGBM, SHAP, pyradiomics, SimpleITK, nibabel, joblib, pandera
- **Frontend:** React + Vite + TypeScript + Tailwind, NiiVue (3D/2D MRI viewer) — not yet scaffolded
- **Ops:** Docker + docker compose, GitHub Actions CI, Nginx (later layer)
- **Quality/Security:** pytest, ruff (lint only — see §0.7 of CLAUDE.md for the house no-space style),
  mypy, bandit, gitleaks, pip-audit
- Full repository layout and the per-marker plugin contract: [CLAUDE.md](CLAUDE.md) §4.

## 4. Supported environments
- Local Docker (Windows/macOS/Linux with Docker Desktop or Docker Engine) — primary delivery method.
- Public URL deployment — TODO (added at Checkpoint 1, Layer 6).
- LAN backup — TODO.

## 5. Dependencies & third-party resources
No third-party data or pretrained models are integrated yet (Layer 0 is API-skeleton only).
Planned sources, to be added with full license/citation details in Layer 1:
- UCSF-PDGM clinical metadata (TCIA, CC BY 4.0)
- BraTS 2021 training set (NIfTI volumes + segmentations)
- BraTS↔TCIA ID crosswalk (TCIA)

Full provenance (URLs, licenses, download dates, checksums, join counts, exclusions):
[docs/DATA_PROVENANCE.md](docs/DATA_PROVENANCE.md).

Python/JS package licenses are all permissive OSS (MIT/BSD/Apache-2.0) — see `backend/requirements.txt`
and (once scaffolded) `frontend/package.json`.

## 6. Installation & run commands

### Docker (recommended)
```bash
cp .env.example .env
docker compose up --build
```
Then check:
```bash
curl http://localhost:8000/health
curl http://localhost:8000/ready
```

### Local (without Docker)
```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

## 7. Deployment & access details
TODO — public URL and access instructions will be added at Checkpoint 1 (Layer 6).

## 8. Environment variables
See [.env.example](.env.example) for the full list with placeholder values. Summary:

| Variable | Purpose |
|---|---|
| `APP_ENV` | `development` / `production` |
| `LOG_LEVEL` | structlog level, e.g. `INFO` |
| `CORS_ORIGINS` | comma-separated allowlist of frontend origins |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | local Postgres credentials (dev only — not production secrets) |
| `DATABASE_URL` | SQLAlchemy connection string |
| `JWT_SECRET_KEY` / `JWT_ACCESS_TOKEN_TTL_MINUTES` / `JWT_REFRESH_TOKEN_TTL_DAYS` | reserved for Layer 3 (auth) |

## 9. Database setup
`docker compose up` starts a PostgreSQL 16 container with a named volume (`db_data`); no manual setup
needed for local dev. Alembic migrations are introduced in Layer 3 once the ORM models exist.

## 10. Test instructions
```bash
cd backend
pip install -r requirements-dev.txt
pytest -v
```
Current coverage: `/health` and `/ready` smoke tests, request-ID echo, structured 404 error body
(`backend/tests/api/test_health.py`). No auth/ML/upload tests yet — those land with their own layers.

Standard (non-admin) test accounts for evaluators: TODO — added in Layer 3 once auth exists.

## 11. Known limitations
- No ML models, no database schema, no auth, no upload pipeline yet — this is the Layer 0 skeleton only.
- `/ready`'s database check is a plain `SELECT 1`; it does not yet verify model artifacts (there are none
  to check yet — see CLAUDE.md §7 for the full target).
- No frontend exists yet.

This section is updated every layer and is binding for Bug Bounty: anything listed here before the
freeze is excluded from valid bug reports against us (see CLAUDE.md §1.6).

## 12. AI tool disclosure
All AI-tool usage is logged in [AI_USAGE.md](AI_USAGE.md), per entry: tool, purpose, what was
generated, what was human-reviewed.

## 13. Synthetic data disclosure
None used yet. When demo/test accounts are introduced (Layer 3+), they will be clearly labelled
synthetic and disclosed here.

## 14. Dockerfiles & container commands
- [backend/Dockerfile](backend/Dockerfile) — non-root `python:3.11-slim` image running `uvicorn`.
- [docker-compose.yml](docker-compose.yml) — `api` (FastAPI) + `db` (PostgreSQL 16).

```bash
docker compose up --build      # start everything
docker compose down             # stop (add -v to also drop the db volume)
docker compose logs -f api      # tail API logs
```

## 15. Error code taxonomy
Every error response is `{error_code, message, request_id}`. Codes defined so far:

| Code | Meaning |
|---|---|
| `VALIDATION_ERROR` | Request body/params failed schema validation |
| `HTTP_ERROR` | Generic HTTP error (404, 405, etc.) |
| `INTERNAL_ERROR` | Unexpected server error (details are only in server-side logs, never in the response) |

More are added as upload/auth/ML layers land.
