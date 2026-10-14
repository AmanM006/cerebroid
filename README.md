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
- **ML:** pandas, numpy, scikit-learn, LightGBM, SHAP, SimpleITK, scipy, scikit-image (radiomics-style feature extraction), nibabel, joblib, pandera

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
| UCSF-PDGM (TCIA) | Clinical metadata, molecular labels, skull-stripped MRI volumes and tumor segmentations | CC BY 4.0 |
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
Database migrations run automatically when the API container starts. Open the app at
`http://localhost:8080` (nginx serves the frontend and proxies the API on the same origin).
```bash
curl http://localhost:8080/health
curl http://localhost:8080/ready
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

Register a public-dataset patient from the feature table as a demo case (age, sex and biopsy history are copied from its row):
```bash
docker compose exec api python -m app.cli add-demo-case --patient-id UCSF-PDGM-0004
```

To reproduce the deployed demo on a fresh stack, register the nine held-out test patients:
```bash
for p in 0061 0073 0243 0018 0026 0232 0162 0282 0327; do
  docker compose exec api python -m app.cli add-demo-case --patient-id UCSF-PDGM-$p
done
```

## 7. Deployment & access details
- **Public deployment (Render, free tier):** one Docker web service built from
  [ops/render/Dockerfile](ops/render/Dockerfile) (the API also serves the built frontend, so the app is one origin)
  plus a free Postgres, both defined in [render.yaml](render.yaml). To recreate it: Render dashboard → New →
  Blueprint → this repository; enter the two test-account passwords below when asked. Migrations, the nine demo
  cases and the test accounts are created automatically at start-up (`python -m app.cli seed`, idempotent).
  The free tier sleeps after 15 idle minutes; [keepalive.yml](.github/workflows/keepalive.yml) pings `/health`
  every 10 minutes once the repository variable `VBX_PUBLIC_URL` is set.
- **Docker Compose:** `docker compose up --build`, app on `http://localhost:8080` (set `WEB_PORT` to change it),
  API also reachable directly on `http://localhost:8000`.
- **Interactive API docs:** `http://localhost:8000/docs`.

### Test account
A synthetic, non-admin clinician account for evaluators. It sees the public demo cases and its own uploads only.

| Username | Password | Role |
|---|---|---|
| `evaluator` | `vbx-eval-fcd664d1` | clinician |
| `reviewer` | `vbx-review-718d0a59` | reviewer (can also run the audit-log check) |

On a fresh local stack, create it with the command below and enter the password from the table when prompted:
```bash
docker compose exec api python -m app.cli create-user --username evaluator --role clinician --synthetic
```

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
| `GET /api/v1/studies/{id}/profile` | Bearer | Molecular profile: per marker the call, probability range across the model set, stability verdict, model version and provenance. Optional `known=IDH:1` (repeatable) for lab results already known, and `view=imaging_only` / `view=clinical_only` to re-score with the MRI-only or patient-info-only model sets (a marker without that set is reported unavailable, never filled from another set). |
| `GET /api/v1/studies/{id}/reveal` | Bearer | Demo cases only: the dataset's true lab results (`provenance: measured`), for checking predictions. Never used by `/profile`. |
| `GET /api/v1/studies/{id}/evidence?marker=IDH` | Bearer | Which input groups drove that marker's call (grouped perturbation against the training-cohort median), whether each supports or contradicts the call, and how much the models agree on why. Accepts the same `known=` values as `/profile`. |
| `GET /api/v1/studies/{id}/doubt?marker=IDH` | Bearer | Why that marker's call is uncertain, split into model disagreement, closeness to the decision boundary, distance from the training patients, missing inputs and weak imaging signal; each rated low/medium/high with the action it calls for. Accepts `known=`. |
| `GET /api/v1/studies/{id}/tipping?marker=IDH` | Bearer | For each clinician-verifiable input (age, tumor volume, enhancing and necrotic share, edema-to-core ratio): the nearest plausible value that flips the majority call, and the call across the whole plausible range. Model sensitivity, not cause. Accepts `known=`. |
| `GET /api/v1/studies/{id}/falsification?marker=IDH` | Bearer | The case for and against the call (strongest input groups each way), the competing call with its model votes, what change to a verifiable input would overturn it, and the lab test that settles it. Every sentence is a fixed template over computed results and lists its evidence IDs. Accepts `known=`. |
| `GET /api/v1/studies/{id}/next-measurements` | Bearer | Decision-support heuristic: the WHO CNS5 adult diffuse-glioma categories still consistent with the settled markers (lab results, or Stable calls with real signal) and the lab tests ranked by how far they would narrow them. MGMT is listed as treatment-relevant only. Accepts `known=`. |
| `GET /api/v1/model-card` | Bearer | Intended use, data source and cohort counts, limitations, and per deployed model set: size, families, CV loss, skill, verdict thresholds, library versions and held-out test metrics (AUC with 95% CI, error rate per verdict). Metrics are shown only for the exact model file they were computed on. |
| `GET /api/v1/audit/verify` | Bearer (reviewer) | Recomputes the hash-chained audit log; returns whether it is intact, the entry count and the first tampered entry. Every profile, evidence, doubt, tipping, falsification, reveal and volume read is recorded with IDs only. |
| `GET /api/v1/studies/{id}/volumes` | Bearer | MRI sequences stored for the study (`t1`, `t1c`, `t2`, `flair`, `seg`) |
| `GET /api/v1/studies/{id}/volume/{sequence}` | Bearer | One compressed NIfTI volume for the viewer; same access rule as the case itself |

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
| `WEB_PORT` | Host port of the web container (default 8080) |
| `FRONTEND_DIST` | Built frontend directory for the API to serve itself (single-service hosting; unset in compose) |
| `VBX_SEED_DEMO_CASES` | Comma-separated patient IDs registered as demo cases at start-up |
| `VBX_EVALUATOR_PASSWORD` / `VBX_REVIEWER_PASSWORD` | Create the synthetic `evaluator` / `reviewer` accounts at start-up |
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
`tests/unit` (shared contracts, config validation, model registry and artifact integrity, stability verdicts),
`tests/contracts` (the committed feature table and model artifacts: naming convention, leakage columns, one
pre-operative scan per patient, split/fold rules, models load in the API environment, predictions vary across
held-out patients; skipped while those files are absent).

## Model artifacts
[ml/notebooks/03_inference_demo.ipynb](ml/notebooks/03_inference_demo.ipynb) is the committed, executed demonstration of the trained
models: the deployed sets, inference on held-out patients (every model's vote, verdict and call next to the true result), a
known lab result re-scoring the other markers, evidence, tipping points, doubt, held-out metrics and "resolved by
combining". Every number in it is computed when it runs. To re-run: `pip install -r backend/requirements-dev.txt`, then
`jupyter nbconvert --to notebook --execute --inplace ml/notebooks/03_inference_demo.ipynb` (or run it cell by cell).

Golden regression set: `backend/tests/golden/expected.json` freezes the profile (call, verdict, median probability,
variant, low-signal flag, top IDH evidence group) for 10 held-out patients, with and without a known IDH result. CI fails
if predictions drift. After an intended model update, regenerate it in the same commit:
```bash
cd backend && .venv/Scripts/python -m tests.golden.snapshot --write
```
Held-out metrics are computed by [ml/pipeline/evaluate.py](ml/pipeline/evaluate.py) on the 99 test-split patients and written to
`artifacts/metrics/heldout.json` (rerun it after every model update; the model card hides metrics whose model file changed):
```bash
backend/.venv/Scripts/python ml/pipeline/evaluate.py   # Linux/macOS: backend/.venv/bin/python
```
Trained model sets live in `artifacts/models/<marker>/` and are listed with their sha256 in
`artifacts/manifest.json`. At startup the API loads each marker listed in `ml/configs/markers.yaml`, refuses any
file whose hash doesn't match the manifest (before unpickling it), validates its metadata, and runs a warm-up
prediction. `/ready` shows the result per marker: `loaded`, `missing`, `integrity_error` or `invalid`. The full
format is specified in [CLAUDE.md](CLAUDE.md) §4.5.

Agreement among models is only meaningful when the models have learned something. Each set's `meta.json` records
`baseline_log_loss`, the cross-validated loss of always predicting the base rate. The profile reports
`skill` (relative improvement of the best model over that baseline) and `low_signal` when skill is below 5%; the UI
then shows "No reliable signal" instead of a stability verdict and recommends tissue testing.
Lint and security checks (also run in CI):
```bash
ruff check .
mypy app
bandit -r app -q
pip-audit -r requirements.txt
```

## 11. Known limitations
- **Scanner intensity.** The deployed features are extracted in mode `v1` ([ml/pipeline/extract.py](ml/pipeline/extract.py)):
  texture uses 32 grey levels normalized within each tumor region and shape/composition features don't depend on
  intensity, but first-order intensity statistics use raw scanner values. All patients come from one institution with
  the same preprocessing, so this holds within the cohort but would not transfer to another scanner. The stress test
  ([ml/pipeline/stress_test.py](ml/pipeline/stress_test.py), results in `artifacts/metrics/robustness.json`, 9 demo
  patients) measured: simulated noise (5-10%) and bias-field shading (15%) changed 0 of 36 calls; a scanner gain change
  left only 33% of first-order features in agreement (Lin's CCC >= 0.9) under `v1` versus 100% under the brain-normalized
  `v2` mode. Retraining on `v2` features is the planned fix.
- **Tumor outline errors.** Features are measured inside the segmentation; shifting or shrinking it by one voxel
  changed 1-2 of 36 calls and several verdicts (most became Contested). There is no automatic segmentation or mask QC yet.
- Brute-force protection is per-account lockout (5 failures → 15 minutes); there is no per-IP rate limiting.
  Anyone who knows a username can therefore lock that account for 15 minutes.
- The refresh cookie has the `Secure` flag only when `APP_ENV=production`.
- Refreshing the same session from two tabs at the same moment counts as token reuse and signs that session
  out; the user signs in again.

## 12. AI tool disclosure
See [AI_USAGE.md](AI_USAGE.md): each AI tool used, its purpose, what it generated, and what was human-reviewed.

## 13. Synthetic data disclosure
No synthetic data is used by any model. The `evaluator` test account is a synthetic user and is flagged as such
in the database (`is_synthetic`).

## 14. Dockerfiles & container commands
- [backend/Dockerfile](backend/Dockerfile): `python:3.11-slim`, runs as a non-root user that cannot modify the
  application code or model files. Built from the repo root; [.dockerignore](.dockerignore) is an allowlist, so
  `.env`, `.git` and local environments never enter the image.
- [ops/nginx/Dockerfile](ops/nginx/Dockerfile): builds the frontend with Node 22, then serves it from
  `nginx-unprivileged` (non-root, port 8080). [nginx.conf](ops/nginx/nginx.conf) proxies `/api`, `/health` and
  `/ready` to the API and adds the security headers in [security_headers.inc](ops/nginx/security_headers.inc)
  (CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, HSTS).
- [docker-compose.yml](docker-compose.yml): `web` (nginx + frontend) + `api` (FastAPI) + `db` (PostgreSQL 16).

```bash
docker compose up --build       # start
docker compose down             # stop (add -v to drop the database volume)
docker compose logs -f api      # API logs
docker compose logs -f web      # nginx access log
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
| `INVALID_KNOWN_MARKER` | A `known` value isn't `<IDH\|1p19q\|MGMT\|GRADE>:<0\|1>`, or repeats a marker |
| `FEATURES_NOT_READY` | No extracted imaging features exist for this study yet |
| `NO_GROUND_TRUTH` | No lab results exist for this study (uploads, or no dataset row) |
| `MARKER_ALREADY_KNOWN` | Evidence was requested for a marker given as a known lab result |
| `MODEL_NOT_AVAILABLE` | No model set is deployed for the requested marker |
| `VOLUME_NOT_AVAILABLE` | The study has no stored volume for that sequence |
| `HTTP_ERROR` | Generic HTTP error (404, 405, ...) |
| `INTERNAL_ERROR` | Unexpected server error (details only in server logs) |
