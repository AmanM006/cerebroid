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
```
Set `JWT_SECRET_KEY` in `.env` to a random value of at least 32 characters (the API refuses to start
with the placeholder):
```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```
```bash
docker compose up --build
```
Database migrations run automatically when the API container starts.
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
alembic upgrade head
uvicorn app.main:app --reload
```
Needs a reachable Postgres (`docker compose up -d db` exposes one on `127.0.0.1:5432`).

### Creating an account
The password is prompted for (or read from `VBX_NEW_USER_PASSWORD`), never passed as an argument.
```bash
docker compose exec api python -m app.cli create-user --username <name> --role clinician
```
Roles: `clinician`, `reviewer`. Add `--synthetic` for demo/test accounts.

## 7. Deployment & access details
- **Docker Compose:** `docker compose up --build`, API on `http://localhost:8000`.
- **Interactive API docs:** `http://localhost:8000/docs`.

### API endpoints
| Method & path | Auth | Purpose |
|---|---|---|
| `GET /health` | none | Liveness |
| `GET /ready` | none | Readiness: database reachable and every marker's model set loaded, sha256-verified and warmed up; per-marker status included |
| `POST /api/v1/auth/login` | none | Username + password → access token (body) + refresh token (HttpOnly cookie) |
| `POST /api/v1/auth/refresh` | refresh cookie | Rotates the refresh token, returns a new access token |
| `POST /api/v1/auth/logout` | refresh cookie | Revokes the session |
| `GET /api/v1/auth/me` | Bearer | Current user |
| `GET /api/v1/cases` | Bearer | Cases visible to the user (public demo cases + own uploads), paginated |
| `GET /api/v1/cases/{id}` | Bearer | One case; another user's case returns 404 |

Example with curl:
```bash
curl -c cookies.txt -X POST http://localhost:8000/api/v1/auth/login -H "Content-Type: application/json" -d '{"username":"<name>","password":"<password>"}'
curl http://localhost:8000/api/v1/cases -H "Authorization: Bearer <access_token>"
curl -b cookies.txt -c cookies.txt -X POST http://localhost:8000/api/v1/auth/refresh
```

### Auth design
- Passwords hashed with argon2id.
- Access tokens: HS256 JWT, 15-minute lifetime, sent as `Authorization: Bearer`.
- Refresh tokens: random, stored only as SHA-256 hashes, delivered in an HttpOnly `SameSite=Strict` cookie
  scoped to `/api/v1/auth`, rotated on every use. Replaying an already-used refresh token revokes the whole
  session.
- 5 failed logins lock the account for 15 minutes. Login errors are identical for unknown users and wrong
  passwords.
- Roles: `clinician`, `reviewer`. Every case route goes through one shared access check; cases owned by
  other users are indistinguishable from nonexistent ones (404).

## 8. Environment variables
See [.env.example](.env.example).

| Variable | Purpose |
|---|---|
| `APP_ENV` | `development` / `production` |
| `LOG_LEVEL` | Log level, e.g. `INFO` |
| `CORS_ORIGINS` | Comma-separated allowlist of frontend origins |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Postgres credentials |
| `DATABASE_URL` | SQLAlchemy connection string |
| `JWT_SECRET_KEY` | **Required.** JWT signing key, ≥32 random characters |
| `JWT_ACCESS_TOKEN_TTL_MINUTES` | Access token lifetime (1–15, default 15) |
| `JWT_REFRESH_TOKEN_TTL_DAYS` | Refresh token lifetime (1–30, default 7) |

## 9. Database setup
`docker compose up` starts PostgreSQL 16 with a persistent named volume (`db_data`) and the API applies
Alembic migrations on startup. No manual setup is required.

Tables: `users`, `refresh_tokens`, `studies`. No direct identifiers are stored: usernames are pseudonymous,
studies hold only age and sex, and all IDs are random UUIDs.

## 10. Test instructions
Tests run against a separate `<db>_test` database that they create and migrate themselves, so start
Postgres first:
```bash
docker compose up -d db
cd backend
pip install -r requirements-dev.txt
pytest -v
```
Suites: `tests/api` (auth flow, health), `tests/security` (forged/expired tokens, IDOR on cases),
`tests/unit` (shared contracts, config validation, model registry and artifact integrity, stability verdicts).

## Model artifacts
Trained model sets live in `artifacts/models/<marker>/` and are listed with their sha256 in
`artifacts/manifest.json`. At startup the API loads each marker listed in `ml/configs/markers.yaml`, refuses any
file whose hash doesn't match the manifest (before unpickling it), validates its metadata, and runs a warm-up
prediction. `/ready` shows the result per marker: `loaded`, `missing`, `integrity_error` or `invalid`. The full
format is specified in [CLAUDE.md](CLAUDE.md) §4.5.
Lint and security checks (also run in CI):
```bash
ruff check .
mypy app
bandit -r app -q
pip-audit -r requirements.txt
```

## 11. Known limitations
- Brute-force protection is per-account lockout (5 failures → 15 minutes); there is no per-IP rate limiting.
  Anyone who knows a username can therefore lock that account for 15 minutes.
- The refresh cookie has the `Secure` flag only when `APP_ENV=production`.
- Refreshing the same session from two tabs at the same moment counts as token reuse and signs that session
  out; the user signs in again.

## 12. AI tool disclosure
See [AI_USAGE.md](AI_USAGE.md): each AI tool used, its purpose, what it generated, and what was human-reviewed.

## 13. Synthetic data disclosure
None.

## 14. Dockerfiles & container commands
- [backend/Dockerfile](backend/Dockerfile): `python:3.11-slim`, runs as a non-root user that cannot modify the
  application code or model files. Built from the repo root; [.dockerignore](.dockerignore) is an allowlist, so
  `.env`, `.git` and local environments never enter the image.
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
| `VALIDATION_ERROR` | Request failed schema validation (unknown fields, wrong types, out-of-range values) |
| `AUTH_REQUIRED` | No access token supplied |
| `AUTH_INVALID_CREDENTIALS` | Login failed (same response for unknown user, wrong password, locked account) |
| `AUTH_INVALID_TOKEN` | Access or refresh token invalid, expired, revoked or reused |
| `FORBIDDEN` | Authenticated but the role is not allowed |
| `NOT_FOUND` | Resource doesn't exist or isn't visible to this user |
| `HTTP_ERROR` | Generic HTTP error (404, 405, ...) |
| `INTERNAL_ERROR` | Unexpected server error (details only in server logs) |
