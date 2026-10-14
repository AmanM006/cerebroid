# VBX — From Image to Clinical Story

Manipal Hackathon 2026 · Team **Void** · Problem Statement: "From Image to Clinical Story"

## 1. Project & team details
- **Team:** Void
- **Team members:** Tanish Kuvar, Aman Mishra
- **Repository:** https://github.com/Manipal-Hackathon-2026/Void
- **Problem statement:** From Image to Clinical Story (Healthcare Track, PS 2)

## 2. Solution summary
A pre-operative "virtual molecular biopsy" for diffuse gliomas. From multi-sequence brain MRI,
a tumor segmentation mask, and patient age/sex, VBX predicts the tumor's molecular profile
(IDH mutation, 1p/19q co-deletion, MGMT promoter methylation, WHO grade) and measures how *stable*
each call is by checking agreement across a set of near-equally-accurate models (predictive
multiplicity). When imaging genuinely cannot decide, VBX says so and recommends confirming with tissue.

Research decision-support prototype. Not a diagnostic device.

## 3. Architecture & stack
- **Backend:** Python 3.11, FastAPI, Pydantic v2, SQLAlchemy 2 + Alembic, PostgreSQL
- **ML:** pandas, numpy, scikit-learn, LightGBM, SHAP, pyradiomics, SimpleITK, nibabel, joblib, pandera
- **Frontend:** React + Vite + TypeScript + Tailwind, NiiVue (3D/2D MRI viewer)
- **Ops:** Docker + docker compose, GitHub Actions CI, Nginx
- **Quality & security:** pytest, ruff, mypy, bandit, gitleaks, pip-audit

```
ml/         feature extraction + model training notebooks and pipeline
artifacts/  trained model artifacts + sha256 manifest
backend/    FastAPI service (core, api, domain, ingest, db) + tests
frontend/   React + NiiVue client
ops/        nginx, load tests, scripts
docs/       threat model, data provenance, model card, ADRs
```

## 4. Supported environments
- Docker (Windows / macOS / Linux with Docker Desktop or Docker Engine)
- Local Python 3.11+

## 5. Dependencies & third-party resources
| Resource | Use | License |
|---|---|---|
| UCSF-PDGM (TCIA) | Clinical metadata and molecular labels | CC BY 4.0 |
| BraTS 2021 training set | Co-registered MRI volumes + tumor segmentations | BraTS 2021 data terms |
| BraTS↔TCIA ID crosswalk (TCIA) | Joining imaging to clinical records | TCIA terms |
| Python packages (`backend/requirements.txt`) | Backend runtime | MIT / BSD / Apache-2.0 |

Full data provenance: [docs/DATA_PROVENANCE.md](docs/DATA_PROVENANCE.md).

## 6. Installation & run commands

### Docker
```bash
cp .env.example .env
docker compose up --build
```
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
- **Docker Compose:** `docker compose up --build`, API on `http://localhost:8000`.

## 8. Environment variables
See [.env.example](.env.example).

| Variable | Purpose |
|---|---|
| `APP_ENV` | `development` / `production` |
| `LOG_LEVEL` | Log level, e.g. `INFO` |
| `CORS_ORIGINS` | Comma-separated allowlist of frontend origins |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Postgres credentials |
| `DATABASE_URL` | SQLAlchemy connection string |
| `JWT_SECRET_KEY` / `JWT_ACCESS_TOKEN_TTL_MINUTES` / `JWT_REFRESH_TOKEN_TTL_DAYS` | Auth token settings |

## 9. Database setup
`docker compose up` starts PostgreSQL 16 with a persistent named volume (`db_data`). No manual setup is
required.

## 10. Test instructions
```bash
cd backend
pip install -r requirements-dev.txt
pytest -v
```
Lint and security checks (also run in CI):
```bash
ruff check .
mypy app
bandit -r app -q
pip-audit -r requirements.txt
```

## 11. Known limitations
- `/ready` verifies database connectivity only.

## 12. AI tool disclosure
See [AI_USAGE.md](AI_USAGE.md): each AI tool used, its purpose, what it generated, and what was human-reviewed.

## 13. Synthetic data disclosure
None.

## 14. Dockerfiles & container commands
- [backend/Dockerfile](backend/Dockerfile): `python:3.11-slim`, runs as a non-root user.
- [docker-compose.yml](docker-compose.yml): `api` (FastAPI) + `db` (PostgreSQL 16).

```bash
docker compose up --build       # start
docker compose down             # stop (add -v to drop the database volume)
docker compose logs -f api      # API logs
```

## 15. Error codes
Every error response has the shape `{error_code, message, request_id}`.

| Code | Meaning |
|---|---|
| `VALIDATION_ERROR` | Request failed schema validation |
| `HTTP_ERROR` | Generic HTTP error (404, 405, ...) |
| `INTERNAL_ERROR` | Unexpected server error (details only in server logs) |
