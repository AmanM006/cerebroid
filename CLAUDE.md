# CLAUDE.md — Master Brief for Claude Code
# Manipal Hackathon 2026 · Problem Statement: "From Image to Clinical Story"
# Codename: VBX (name not decided yet, we will decide later — keep package names in sync)

> Claude Code: this file lives at the repo root and is your standing brief for EVERY session.
> Read it fully before acting. You will build this project LAYER BY LAYER.
> **Execute ONLY the layer I explicitly name in my message. When that layer's Definition of Done is met,
> STOP, report, and wait for my approval. Never jump ahead, never build the whole project in one go.**

---

## 0. HOW YOU MUST WORK (non-negotiable)

1. **One layer at a time.** Each layer ends with: tests passing, a meaningful commit, a short report (what was built, how to verify it, risks, open questions). Then STOP.
2. **Explain as you build.** Every file you create must be something a student team can explain, modify and debug in front of judges (rulebook §1). Prefer clear code over clever code. Add concise docstrings stating *why*, not just *what*.
3. **Never fabricate.** No hardcoded predictions, no fake metrics, no placeholder numbers presented as results, no mocked model outputs in production paths (Checkpoint 2 explicitly checks this). If something is unknown, say so.
4. **Ask before irreversible or ambiguous decisions.** Anything touching git history, data licensing, or architecture changes → ask first.
5. **Security, privacy and debuggability are first-class requirements in every layer**, not a final pass.
6. **Keep `AI_USAGE.md` updated** each layer (tool, purpose, what was generated, what was human-reviewed) — rulebook §1 requires AI disclosure.
7. **House code style (team preference, mandatory):** no spaces before/after `=`, `==`, `<`, `>` (e.g. `x=1`, `if a==b:`, `while i<n:`, `def f(a, b=2)`); normal spacing after commas and around `and`/`or`/`&&`, `+`, `-` etc. is fine. Therefore **do NOT run black / `ruff format` / prettier auto-formatting** (they would undo this). Use `ruff check` for linting only, with rules that conflict with this style disabled (e.g. E225, E251 if enabled). Same rule for TypeScript (disable prettier formatting; use eslint without spacing rules).

---

## 1. THE RULEBOOK — HARD CONSTRAINTS (MUST MUST MUST)

Violating any of these can cost points or disqualify us. Treat them as acceptance criteria.

### 1.1 Development (§1)
- All project-specific work is created after the official start (14 Oct, 10:00 AM). No pre-event code, designs, schemas, prompts, integrations.
- Public frameworks, libraries, APIs, pretrained models, cloud services are allowed **with licensing + attribution**. Cite every material third-party resource (source + license) in the README.
- Generative AI is allowed: **disclose every AI tool and its purpose in the README** (link `AI_USAGE.md`).
- Outside individuals must not write code or perform our Bug Bounty testing.
- Code similarity/originality checks may happen → write original code, attribute anything adapted.

### 1.2 GitHub workflow (§2, §5.1)
- Use ONLY the official repository issued at the start.
- Branches: **`main`** (core development), **`bugbounty`** (deployment + peer testing; frozen read-only at 16 Oct 00:00), **`fixing`** (all fixes during 02:00–03:30 fixing phase, branched off `bugbounty`). Feature branches allowed but merge into `main` before every evaluation deadline.
- **At least one meaningful commit every 120 minutes of development.** Empty, cosmetic or artificially split commits do NOT count. Use Conventional Commits (`feat:`, `fix:`, `sec:`, `test:`, `docs:`, `ml:`, `ops:`).
- **Never force-push, delete shared history, alter timestamps, or squash away event history.** No `git push --force`, no `git rebase` on shared branches, no squash merges. Use normal merge commits.
- Evaluation uses the latest eligible commit on `main` before each deadline.
- **No API keys, passwords, tokens in source control.** Provide `.env.example` with safe placeholders. gitleaks must run pre-commit and in CI.
- After the fixing phase: merge `fixing` → `main` after validation; update `bugbounty` only after organizers announce evaluation is complete. **Bypassing the freeze = immediate disqualification.**

### 1.3 Data & conduct (§3)
- Only licensed public / organizer-provided / anonymized / clearly-labelled synthetic data.
- Never collect or expose real confidential or sensitive personal data. Protect credentials, validate inputs, report accidental exposure.

### 1.4 Deployment & documentation (§4)
- At least one valid delivery method; we provide **two**: public URL **and** reproducible `docker compose` build (LAN as backup). Keep services functional until the hackathon ends.
- **README must contain:** project & team details, solution summary, architecture & stack, supported environments, dependencies, installation & run commands, deployment/access details, environment variables, database setup, test instructions, known limitations, AI tool disclosure, material third-party resources (with licenses), synthetic data disclosure (state "none" if none), Dockerfiles + container commands.
- **Standard test accounts** (non-admin) documented in README so evaluators test independently. No admin/infra credentials needed. Evaluators must never need to pay for anything (we own any quota).
- **Objectives Documentation (§4.2):** a separate objectives document before Judging Round 1 and before Judging Round 2 (format announced at event). Keep `docs/objectives/` drafts ready; objectives must be clear, specific, achievable, and later demonstrably completed.

### 1.5 Deployment checkpoints (§4.3)
- **Checkpoint 1 — 15 Oct 13:00:** working deployment via a valid delivery method; primary app + backend reachable; **≥1 working end-to-end flow**; **a working Jupyter notebook (.ipynb) demonstrating the trained model and its inference on sample inputs**; deployment/access details submitted.
- **Checkpoint 2 — 15 Oct 21:30:** substantially functional solution; **≥5 major APIs working**; DB/ML/auth all functional; **trained model artifacts (.pkl/.onnx etc.) committed in the repo and the deployed API wired to those exact artifacts**; system demonstrably processes real inputs (no hardcoded/static results); evaluators can test core functionality without our help.

### 1.6 Bug Bounty (§5)
- Peer teams attack our frozen `bugbounty` deployment (16 Oct 00:00–02:00). Valid reports deduct our points; severity by demonstrated impact.
- **Missing setup documentation disqualifies us from Bug Bounty.**
- Previously disclosed limitations are excluded from reports → maintain an honest, complete "Known Limitations" section.
- When we attack others: only assigned projects/accounts, no DoS/destructive testing/phishing/malware; reports need component, environment, prerequisites, repro steps, expected vs actual, impact, evidence, severity. Max 10 bugs total, max 4 per target team.

### 1.7 Judging timeline (§6)
- Judging R1: 15 Oct 08:30–11:00 · Judging R2: 15 Oct 18:30–20:30 · Judging R3 + Bug Bounty eval: 16 Oct 08:30–10:00 · Finals: 16 Oct 10:30–13:00.

---

## 2. THE PRODUCT

### 2.1 One-liner
**A pre-operative "virtual molecular biopsy" for diffuse gliomas that knows when you still need a real one.**
From multi-sequence brain MRI + tumor segmentation + patient context (age, sex), VBX predicts the tumor's molecular profile (IDH mutation, 1p/19q co-deletion, MGMT promoter methylation; WHO grade as a predicted output) — and, uniquely, **measures how stable each molecular call is** by interrogating a set of near-equally-accurate models (predictive multiplicity).

### 2.2 Why it matters (pitch logic)
- WHO CNS 2021 classification makes glioma diagnosis depend on molecular markers that today require surgery/biopsy.
- MRI + age carry real but partial signal. Existing AI gives one confident number and hides arbitrariness: many equally accurate models can give the same patient opposite answers.
- VBX outputs, per marker: the call, its **stability verdict**, the evidence behind it, what the call hinges on, and whether to **confirm with tissue**.
- Honesty as intelligence: MGMT from imaging is known to be hard. VBX is expected to *show* that MGMT calls are mostly unstable → "imaging can't decide this; get tissue", while IDH calls are often stable. We report this truthfully whatever the data says.

### 2.3 Mapping to the problem statement (must remain demonstrable)
| PS requirement | VBX feature |
|---|---|
| Combine images with patient information | Radiomics from 4 MRI sequences × 3 tumor sub-regions + age/sex (clinical context) |
| Identify relationships between sources | Fused vs imaging-only vs clinical-only comparison per patient; evidence-group interactions |
| Highlight contributing findings | Grouped SHAP (sequence × region × feature-class, plus clinical), with cross-model agreement on the explanation |
| Strong evidence vs uncertainty/missing | Stability verdicts, doubt decomposition, missing-sequence handling, OOD/data-sparsity flags |
| Combining reveals what isolated analysis misses | **Context-blind toggle** (imaging-only) and **image-blind toggle** (clinical-only) live in the UI + ablation table in the notebook |

### 2.4 Core innovations (all must be real, computed, and explainable)
1. **Multiplicity engine** — per marker, train a candidate pool (varied seeds, feature-subset bagging, hyperparameters, model families: LightGBM, elastic-net logistic regression, ExtraTrees). Score each by repeated stratified patient-level CV out-of-fold log-loss. The **near-optimal set** = all models with loss ≤ (1+ε)·best (default ε=0.03; report sensitivity for ε ∈ {0.01, 0.03, 0.05}). Calibrate each model (Platt/isotonic on OOF).
2. **Per-patient stability verdict** — ambiguity (fraction of set disagreeing with the set majority), probability spread (IQR / range across set). Verdicts: **STABLE** (≥90% agree and small spread), **CONTESTED**, **ARBITRARY** (near 50/50). Thresholds chosen on CV data and documented.
3. **Contested reasoning** — even when models agree on the call, measure whether they agree on *why* (rank correlation of grouped SHAP across set members).
4. **Tipping evidence** — for clinician-verifiable inputs only (age; interpretable tumor descriptors such as enhancing fraction, necrosis fraction, edema-to-core ratio, tumor volume), find the smallest plausible change that flips the set majority. Present as *model sensitivity*, never as causation.
5. **Doubt decomposition** — attribute uncertainty to: (a) model multiplicity, (b) intrinsic ambiguity (calibrated probabilities consistently near 0.5 across models), (c) data sparsity / out-of-distribution (distance to training data, e.g. Mahalanobis or kNN density in feature space), (d) missing inputs (missing sequence/mask). Each maps to an action: get tissue / refer / don't trust AI here / supply missing input.
6. **Context-blind & image-blind counterfactuals** — same patient re-scored by imaging-only and clinical-only sets; UI shows the difference.
7. **Key validation result (notebook headline):** error rate on STABLE cases vs CONTESTED/ARBITRARY cases. If stability is meaningful, stable cases are markedly more accurate. Report honestly with CIs.
8. **Provenance on every claim.** Every value shown or returned carries a `provenance` status from a fixed enum: `clinical_input` (age/sex supplied), `measured` (ground-truth label from the dataset — shown only in evaluation views / held-out "reveal" mode), `model_inferred`, `reference_cohort` (statistics from the training cohort), `missing`, `synthetic` (demo accounts only). UI renders persistent badges; nothing is ever displayed without one.
9. **Falsification panel per molecular call.** For each marker: supporting evidence, contradicting evidence (features pushing the other way, from grouped SHAP), the strongest competing call, and "what would overturn this" (the tipping evidence + the confirmatory assay). Generated from structured results by deterministic templates — no free-form LLM text, no claim without a linked evidence item.
10. **"What does the average hide?" — intra-tumor heterogeneity.** In addition to whole-tumor models, train small near-optimal sets restricted to each sub-region's features (enhancing tumor, necrotic core, peritumoral edema; each + clinical). Per patient, show whether sub-regions agree with the whole-tumor call or tell a different story (e.g. "enhancing rim suggests IDH-wildtype; edema features are uninformative"). Report region-model performance honestly; regions with no signal are labelled as such.
11. **Next-measurement planning (heuristic, labelled as heuristic).** For CONTESTED/ARBITRARY markers, rank the real confirmatory tests (IDH mutation testing, 1p/19q co-deletion testing, MGMT promoter methylation assay) by (a) current instability of that marker and (b) how many candidate integrated diagnoses it disambiguates. Show the candidate WHO CNS5 adult diffuse-glioma categories consistent with the current marker calls (e.g. IDH status gates whether 1p/19q status is diagnostically decisive) and which single test would collapse them. Do NOT present this as expected information gain or as clinical guidance; label it "decision-support heuristic".

### 2.5 Users & usability
Neuro-radiologist / neuro-oncologist. Flow: open case (or upload 4 NIfTI sequences + mask + age/sex) → one-screen **Molecular Profile Card**: per marker → call, calibrated probability range, stability verdict, top evidence, tipping evidence, "confirm with tissue?" flag. 3D MRI viewer with tumor overlay. Decision support only — never presented as a diagnosis.

---

## 3. DATA (exact plan — do not deviate without asking)

- **Labels / clinical:** UCSF-PDGM clinical CSV + metadata glossary (TCIA, CC BY 4.0). Fields used as INPUTS: age, sex only. Fields used as TARGETS: IDH status, 1p/19q status, MGMT status, WHO grade (optional output), overall survival (stretch).
- **Images:** UCSF-PDGM's own skull-stripped, co-registered NIfTI volumes (T1, T1c, T2, FLAIR) and its tumor segmentation (enhancing tumor / necrotic core / edema), same patients and same CC BY 4.0 license as the labels. No cross-dataset join. Verify segmentation label values and file names on one case before the full extraction run. (Decision 2026-10-14, replacing the BraTS 2021 + crosswalk plan; see [docs/ADR/002-data-source.md](docs/ADR/002-data-source.md).)
- **Bulk data never enters the repo or our laptops.** Feature extraction runs in a cloud notebook (Kaggle/Colab). The notebook itself IS committed (`ml/notebooks/`). Only derived artifacts are committed: the radiomics feature table (CSV/Parquet, MBs), trained model artifacts, and 5–8 small hero-case volumes for the demo (compressed NIfTI, each well under GitHub's 100 MB limit; verify license permits redistribution with attribution — ask me if unsure).
- **Leakage rules (critical — judges may probe this):**
  - NEVER use as inputs: WHO grade, pathology diagnosis, extent of resection, treatment, survival, vital status, MGMT index, any post-operative variable.
  - **UCSF-PDGM contains follow-up duplicate scans of the same patient (v3 renamed e.g. `..._FU007d`). Deduplicate to one scan per patient** and split strictly by patient.
  - Feature scaling / selection inside CV folds only (sklearn Pipelines).
  - Baselines to beat and report: majority class, **age-only** (IDH is strongly age-associated), imaging-only, clinical-only, fused.
- **Synthetic data:** none in the model. Demo test-account users are synthetic; label accordingly.
- **Provenance:** `docs/DATA_PROVENANCE.md` records every source, URL, license, citation, download date, checksum, join counts, exclusions and why.

---

## 4. ARCHITECTURE

### 4.1 Stack
- Python 3.11 · FastAPI · Pydantic v2 (strict) · SQLAlchemy 2 + Alembic · PostgreSQL (SQLite allowed for local dev only)
- ML: pandas, numpy, scikit-learn, LightGBM, SHAP, pyradiomics, SimpleITK, nibabel, joblib (artifacts), pandera (data contracts)
- Async (later layer): Redis + RQ worker for feature extraction; S3-compatible object storage (MinIO) for volumes
- Frontend: React + Vite + TypeScript + Tailwind; **NiiVue** for WebGL 3D/2D MRI rendering with segmentation overlay
- Ops: Docker + docker compose, Nginx reverse proxy, GitHub Actions CI
- Quality/Security: pytest, hypothesis, Playwright (smoke), ruff (lint only), mypy, gitleaks, pip-audit, npm audit, bandit
- Observability: structlog (JSON logs), request-ID middleware

### 4.2 Repository layout (modular — each stage swappable)
```
vbx/
  CLAUDE.md  README.md  AI_USAGE.md  SECURITY.md  .env.example  docker-compose.yml
  docs/            THREAT_MODEL.md  DATA_PROVENANCE.md  MODEL_CARD.md  ADR/  objectives/  BUGBOUNTY_SELFTEST.md
  ml/
    notebooks/     01_feature_extraction.ipynb  02_training_multiplicity.ipynb  03_inference_demo.ipynb
    pipeline/      dataset.py  splits.py  features.py  train.py  multiplicity.py  calibrate.py  evaluate.py
    configs/       radiomics.yaml  markers.yaml  multiplicity.yaml
  artifacts/       models/<marker>/  features/  manifest.json (sha256 + versions)
  backend/
    app/
      core/        config.py  security.py  logging.py  errors.py  ratelimit.py
      api/         routers: auth, cases, studies, markers, evidence, counterfactual, audit, model_card, health
      domain/      plugins/  (one MarkerPredictor plugin per marker), multiplicity_engine.py, explain.py, doubt.py, tipping.py
      ingest/      nifti_validate.py  deid.py  sandbox.py
      db/          models.py  session.py  migrations/
    tests/         unit/ api/ security/ golden/ property/
  frontend/        src/ (pages, components, viewer, api client)
  ops/             nginx/  locust/  scripts/
```

### 4.3 Plugin contract (modularity)
```python
class MarkerPredictor(Protocol):
    marker: str                      # "IDH" | "1p19q" | "MGMT" | "GRADE"
    def required_inputs(self) -> set[str]: ...
    def predict_set(self, features: FeatureVector) -> SetPrediction: ...   # all near-optimal models
    def explain(self, features: FeatureVector) -> list[EvidenceItem]: ...
```
Markers are registered via `ml/configs/markers.yaml`. Adding a marker = one plugin + one config entry.

### 4.4 API surface (target ≥10; ≥5 required by Checkpoint 2)
| Method & path | Purpose |
|---|---|
| `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout` | JWT access (short-lived) + rotating refresh |
| `GET /api/v1/cases` / `GET /api/v1/cases/{id}` | Demo/held-out cases the user may access |
| `POST /api/v1/studies` | Upload 4 sequences + mask + age/sex (validated, sanitized, de-identified) |
| `GET /api/v1/studies/{id}/status` | Async processing status |
| `GET /api/v1/studies/{id}/profile` | Molecular Profile Card: per-marker call, prob range, stability verdict |
| `GET /api/v1/studies/{id}/evidence?marker=` | Grouped SHAP + cross-model explanation agreement |
| `GET /api/v1/studies/{id}/doubt?marker=` | Doubt decomposition + recommended action |
| `POST /api/v1/studies/{id}/counterfactual` | Context-blind / image-blind / tipping-evidence what-ifs |
| `GET /api/v1/studies/{id}/falsification?marker=` | Supporting vs contradicting evidence, competing call, what would overturn it |
| `GET /api/v1/studies/{id}/heterogeneity?marker=` | Whole-tumor vs per-sub-region calls and their agreement |
| `GET /api/v1/studies/{id}/next-measurements` | Heuristic ranking of confirmatory tests + candidate WHO CNS5 categories |
| `GET /api/v1/studies/{id}/volume/{sequence}` | Stream volume to viewer (authz-checked) |
| `GET /api/v1/audit/verify` | Verify hash-chained audit log (reviewer role) |
| `GET /api/v1/model-card` | Data, metrics, limitations, licenses, artifact hashes |
| `GET /health`, `GET /ready` | Liveness; readiness (artifacts loaded + warm-up inference + DB) |
Every inference response includes `model_version` (artifact sha256), `feature_pipeline_version`, `input_hash`, `request_id`, `latency_ms`.
Every evidence/claim object in any response includes `provenance` (enum from §2.4 item 8) and `evidence_ids` linking to the items that support it. Pydantic response models must make these fields required so a claim without provenance cannot be serialized.

### 4.5 Model artifact format (contract between Track ML and Track APP)
Enforced by `backend/app/domain/registry.py`; a marker whose artifacts don't match is reported by `/ready` and never served.
```
artifacts/manifest.json              {"files": {"<path relative to artifacts/>": "<sha256 hex>"}, "library_versions": {...}}
artifacts/models/<idh|1p19q|mgmt|grade>/
  models.joblib                      list of fitted estimators, one per near-optimal set member, each with
                                     predict_proba(DataFrame) -> [:, 1] = P(positive class). Imputation, scaling and
                                     calibration live inside each estimator (e.g. an sklearn Pipeline).
  meta.json                          {marker, feature_columns, feature_medians, decision_threshold,
                                      verdict_thresholds: {stable_min_agreement, stable_max_iqr, arbitrary_max_agreement},
                                      epsilon, models: [{model_id, family, cv_log_loss}], library_versions}
```
- `feature_columns`: ordered model inputs; `age`, `sex` (M=1.0, F=0.0) and convention-named features only (`contracts.py`). Missing values arrive as NaN.
- `feature_medians`: training-cohort median per column (exactly the same keys); used for the startup warm-up prediction.
- `models` in `meta.json` lists the set members in the same order as `models.joblib`.
- Positive class per marker: IDH mutant, 1p/19q codeleted, MGMT methylated, GRADE grade 4 (vs 2–3).
- Verdict: ARBITRARY if agreement ≤ `arbitrary_max_agreement`; STABLE if agreement ≥ `stable_min_agreement` and IQR of set probabilities ≤ `stable_max_iqr`; otherwise CONTESTED. Thresholds are chosen on CV data.
- **Train with exactly the versions pinned in `backend/requirements.txt`** (numpy, pandas, scikit-learn, scipy, joblib, lightgbm); pickles are version-sensitive.
- Every file under `artifacts/models/` must appear in `manifest.json` with its sha256; anything unlisted or mismatched is never unpickled.

---

## 5. SECURITY (massive focus — design for peer attack)

Maintain `docs/THREAT_MODEL.md` (STRIDE per endpoint) from Layer 0 and update every layer. Every mitigated attack gets a regression test in `backend/tests/security/`.

- **AuthN/AuthZ:** argon2id password hashing; JWT access ≤15 min, rotating refresh tokens with reuse detection, server-side revocation on logout; roles `clinician`, `reviewer`. **Every object route enforces ownership/role in one shared dependency** (anti-IDOR). UUIDv4 identifiers. Generic auth errors (no user enumeration). Login lockout/backoff.
- **Input validation:** Pydantic strict models, `extra="forbid"`, explicit ranges (age 18–100, enums for sex), size limits on every body.
- **Upload hardening (NIfTI is an attack surface):** extension + magic-byte checks; decompressed-size cap (gzip-bomb defense, stream-decompress with a hard limit); max dimensions/voxel count; allowed dtypes; header sanity (finite affine, positive pixdims, 3D only); all 4 sequences + mask must share shape/affine within tolerance; parsing in an isolated subprocess with CPU-time and memory limits and a timeout; server-generated storage keys only (no user-controlled paths → no path traversal); never execute or render uploaded content as anything but voxel data.
- **Rate limiting:** per-IP and per-user on auth, upload and inference endpoints (generous enough not to block evaluators; documented).
- **Transport & headers:** HTTPS on public URL; HSTS, strict CSP (allow only what NiiVue needs, e.g. `blob:` / WebGL), X-Content-Type-Options, Referrer-Policy, frame-ancestors none; CORS allowlist from env.
- **Errors:** global handler returns `{error_code, message, request_id}` — never stack traces, SQL, paths, or library versions.
- **Secrets & supply chain:** `.env` only (never committed), `.env.example` with placeholders; gitleaks pre-commit + CI; pinned dependencies; pip-audit / npm audit / bandit in CI; containers run as non-root, minimal images, read-only FS where possible.
- **Tamper-evident audit log:** every assessment/access appends `{ts, actor, action, object, model_version, prev_hash, hash}`; `GET /audit/verify` recomputes the chain.
- **Model-side robustness:** out-of-distribution guard (feature-space distance) → refuse to give a confident profile for volumes unlike training data; never crash on extreme feature values.
- **Bug Bounty readiness:** `docs/BUGBOUNTY_SELFTEST.md` checklist (IDOR, authz bypass, token reuse, upload attacks, injection, rate-limit, header/CORS, error leakage, path traversal, mass assignment). Run it before freeze.

## 6. PRIVACY

- **3D head MRI can enable facial reconstruction.** Accept only brain-extracted (skull-stripped) volumes; implement a documented heuristic check (e.g. non-zero voxel distribution near volume boundaries) and reject likely non-stripped uploads. State limitations of the heuristic.
- Strip/ignore all NIfTI header text fields (descrip, aux_file, intent_name, db_name) on ingest; re-save sanitized volumes.
- No direct identifiers in any schema. Pseudonymous study IDs only. Age stored as integer, never DOB.
- Logs never contain voxel data, uploaded filenames, or clinical fields — only hashes, IDs, timings, error codes.
- Retention: uploaded studies auto-purged after a configurable TTL (background job), documented.
- Least privilege: clinician sees only own uploads + public demo cases; reviewer sees audit.
- UI + MODEL_CARD: "Research decision-support prototype. Not a diagnostic device. Trained on public de-identified data."

## 7. DEBUGGING & OBSERVABILITY (first-class)

- Request-ID middleware: ID generated per request, returned in header + error body, propagated into every log line and shown in frontend error toasts.
- structlog JSON logs with levels, event names, durations; no sensitive payloads.
- `/ready` performs real checks (artifacts present + sha256 match manifest, warm-up inference, DB write/read).
- Determinism: fixed seeds; artifact manifest with sha256, library versions, radiomics params hash; responses carry versions so any output is reproducible.
- **Golden regression set:** 10 held-out cases with frozen expected outputs (within tolerance); CI fails if predictions drift unintentionally.
- Data contracts: pandera schema for the feature table (types, ranges, no NaN where forbidden); checked at load time.
- Property-based tests (hypothesis) fuzzing request schemas and the NIfTI validator.
- Reviewer-only `?debug=true` trace: per-model probabilities in the near-optimal set, per-stage timings.
- Error taxonomy: stable `error_code`s (e.g. `UPLOAD_TOO_LARGE`, `NIFTI_SHAPE_MISMATCH`, `OOD_INPUT`) documented in README.

---

## 8. DESIGN DIRECTION (frontend)

- Dark, calm clinical workspace. Three regions: **3D/2D MRI viewer (NiiVue)** with tumor sub-region overlays · **Molecular Profile Card** · **Evidence & Doubt panel**.
- Each marker shown as a card: call, probability range bar (spread across the model set — not a single fake-precise number), stability badge (STABLE / CONTESTED / ARBITRARY using icon + text + colour, never colour alone), "Confirm with tissue" flag, tipping-evidence sentence.
- Provenance badges (clinical input / model-inferred / measured / reference cohort / missing) on every value, always icon + text.
- Per-marker tabs: **Evidence · Falsification · Heterogeneity**. Heterogeneity highlights the corresponding sub-region in the NiiVue overlay when selected.
- A **"Next measurement"** strip under the Profile Card: candidate WHO CNS5 categories still in play and the single test that would collapse them, labelled "heuristic".
- Held-out demo cases have a **"Reveal measured result"** button that shows the dataset's true labels next to the predictions (provenance: measured), proving outputs are real.
- Signature visual: the set of models rendered as small "votes" per marker; toggles **Context-blind / Image-blind** visibly re-score; a slider for tipping evidence (e.g. age) shows a call crossing its boundary.
- Demo must be immaculate: preloaded hero cases, cached volumes, no navigation needed, graceful loading states, zero console errors.
- Accessibility: keyboard navigable, sufficient contrast, responsive down to laptop widths.

---

## 9. LAYER PLAN (build strictly in order; STOP after each)

Team: 2 members. **Only Tanish works for roughly the first hour → Layer 0 must be completable by one person.** From Layer 1 on, work runs in two parallel tracks (see §9A). The layer table below is the overall sequence; §9A says who does what in each phase.

| Layer | Target window (IST) | Scope | Definition of Done |
|---|---|---|---|
| **L0 Foundation** | 14 Oct now → ~12:00 | Repo skeleton (layout above), branches `main`/`bugbounty`/`fixing`, `.gitignore` (data, .env, artifacts caches), `.env.example`, gitleaks pre-commit, CI (lint, tests, gitleaks, pip-audit), FastAPI app with `/health` + `/ready` stub, request-ID + structlog + error handler, Dockerfile (non-root) + compose (api + postgres), README skeleton with ALL §4.1 headings, `AI_USAGE.md`, `SECURITY.md`, `THREAT_MODEL.md` v0, `DATA_PROVENANCE.md` v0, ADR-001 (architecture) | `docker compose up` → `/health` 200; CI green; gitleaks clean; first meaningful commit pushed |
| **L1 Data** | → ~16:00 | `01_feature_extraction.ipynb`: download clinical CSV + crosswalk, join, dedupe follow-ups, patient-level splits, pyradiomics over 4 sequences × 3 regions + interpretable descriptors, pandera contract, export feature table | Feature table committed; provenance doc filled with counts/exclusions |
| **L2 Models** | → ~21:00 | Baselines (majority, age-only, imaging-only, clinical-only, fused), candidate pools, near-optimal set selection, calibration, metrics with bootstrap CIs, stability-vs-error analysis, small per-sub-region sets (enhancing / core / edema, each + clinical; keep pools small to save time), artifacts + manifest; `03_inference_demo.ipynb` | Notebook runs top-to-bottom; artifacts + sha256 manifest committed (Checkpoint 1 notebook requirement met) |
| **L3 Core API** | → ~01:00 | DB models + Alembic, auth (argon2, JWT, refresh rotation, roles), cases/studies routes with central authz, plugin registry loading real artifacts, `/profile` end-to-end | ≥1 E2E flow via API; security tests for auth + IDOR pass |
| **L4 Evidence engine** | → ~05:00 | Grouped SHAP + explanation agreement, doubt decomposition, tipping evidence, context-/image-blind counterfactuals, provenance enum enforced in all response models, falsification panel (deterministic templates), heterogeneity endpoint, next-measurement heuristic, OOD guard, audit hash chain | All evidence endpoints return real computed data with provenance; golden tests added |
| **L5 Frontend MVP** | → ~08:00 | NiiVue viewer with sub-region highlighting, Profile Card, Evidence · Falsification · Heterogeneity tabs, Doubt panel, Next-measurement strip, provenance badges, toggles, "Reveal measured result", login with test account; draft Objectives Doc #1 | Judging R1 demo-ready on hero cases |
| **L6 Deploy** | 15 Oct ~11:00 → 13:00 | Public URL + compose build, test accounts, README run/deploy sections complete | **Checkpoint 1 (13:00)** satisfied |
| **L7 Upload & hardening** | → ~18:00 | Upload pipeline (validation, sandbox, de-id, skull-strip check), Redis/RQ async extraction, MinIO, rate limits, headers/CSP, retention job, property tests, Locust p95 numbers; Objectives Doc #2 | Security self-test passes; load numbers in README |
| **L8 Verification** | 20:30 → 21:30 | ≥5 APIs verified live, artifacts wired (no hardcoding), evaluator-independent test run from a clean machine | **Checkpoint 2 (21:30)** satisfied |
| **L9 Red-team & freeze** | → 23:45 | Run `BUGBOUNTY_SELFTEST.md`, fix, finalize Known Limitations, merge to `bugbounty` | `bugbounty` deployed and stable before **00:00 freeze** |
| Fixing phase | 16 Oct 02:00–03:30 | Branch `fixing` off `bugbounty`, fix reported bugs, merge to `main` after validation | No commits to `bugbounty` until organizers allow |

**Feasibility cut line (if behind schedule, cut from the bottom up):** must-have = multiplicity engine, stability verdicts, profile card, provenance badges, context-/image-blind toggles, security/privacy core · should-have = falsification panel, doubt decomposition, tipping evidence, next-measurement heuristic · could-have = per-sub-region heterogeneity, async queue + MinIO, Locust numbers.

Stretch (only if all DoD met): MONAI pretrained BraTS segmentation for uploads without masks; survival risk (Cox, C-index) as an extra plugin; ε-sensitivity explorer in UI.

---

## 9A. TEAM & WORK SPLIT (2 members)

**Tracks** (fill in names once decided):
- **Track ML — owner: ____** · data, feature extraction, model sets, calibration, evaluation, notebooks, and the pure-Python evidence library (`backend/app/domain/`: multiplicity, explain, doubt, tipping, falsification, heterogeneity, next-measurement logic).
- **Track APP — owner: ____** · backend API, DB, auth/authz, upload pipeline, security/privacy hardening, frontend + NiiVue, Docker/deploy, CI.
- **Tanish** is the integration owner: owns `backend/app/domain/contracts.py` (shared Pydantic types: `FeatureVector`, `SetPrediction`, `EvidenceItem`, provenance enum) and rejects incompatible schema changes.

**Session rule for Claude Code:** every session starts with "I am on Track ML" or "I am on Track APP". Stay inside that track's folders unless told otherwise. Contract changes require the integration owner's approval.

| Phase | Window (IST) | Track ML | Track APP |
|---|---|---|---|
| P0 | 14 Oct now → ~12:00 | — | *Tanish solo:* Layer 0 (whole foundation) + `contracts.py` v0 |
| P1 | ~12:00 → ~21:00 | L1 data (Kaggle notebook, features, provenance doc) → L2 model sets, baselines, per-region sets, artifacts + manifest, inference notebook | L3 prep: DB + Alembic, auth (argon2, JWT, refresh rotation, roles), central authz dependency, plugin registry coded against `contracts.py`; frontend scaffold with NiiVue rendering one hero volume; security tests for auth/IDOR |
| P2 | ~21:00 → ~05:00 | L4 evidence library: grouped SHAP + agreement, doubt decomposition, tipping evidence, context-/image-blind, OOD guard (pure functions + unit/golden tests) | Wire registry to the real artifacts from L2; `/profile`, evidence, counterfactual endpoints; provenance enforced in response models; audit hash chain; Profile Card UI |
| P3 | ~05:00 → 08:30 | Help integrate + verify numbers shown in UI match notebook outputs | L5 demo polish (must-haves only), test account |
| Both | before 08:30 | Objectives Doc #1 (shared) | |
| — | 08:30–11:00 | **Judging Round 1** | |
| P4 | 11:00 → 13:00 | Re-run inference notebook clean; README ML sections | L6 deploy: public URL + compose, README run/deploy sections → **Checkpoint 1** |
| P5 | 13:00 → 18:00 | Should-haves logic: falsification templates, next-measurement heuristic, heterogeneity; could-have region overlays data | L7: upload pipeline (validation, sandbox, de-id, skull-strip check), rate limits, headers/CSP, retention job, property tests; UI tabs for should-haves; queue/MinIO/Locust only if time |
| Both | before 18:30 | Objectives Doc #2 (shared) | |
| — | 18:30–20:30 | **Judging Round 2** | |
| P6 | 20:30 → 21:30 | Verify artifact ↔ API wiring, no hardcoded outputs | Verify ≥5 APIs live from a clean machine → **Checkpoint 2** |
| P7 | 21:30 → 23:45 | **Cross red-team:** ML member attacks the APP surface using `BUGBOUNTY_SELFTEST.md` | APP member reviews ML for leakage, input-dependence, failure modes; both fix; Known Limitations finalized; merge to `bugbounty` |
| — | 16 Oct 00:00 | **Freeze `bugbounty`** | |
| P8 | 02:00 → 03:30 | Fixing phase on `fixing` branch, split by which track owns each reported bug | |

**Branch & merge protocol:** feature branches `feat/ml-*` and `feat/app-*` off `main`; each member pushes a meaningful commit at least every 120 minutes; merge to `main` with normal merge commits (no squash, no force-push) at every phase boundary and before every deadline; whoever merges runs the test suite first.

**Sleep:** stagger ~3-hour sleep windows (one member awake at all times, e.g. ML sleeps ~01:00–04:00, APP ~04:30–07:30) so a commit lands every 120 minutes and nothing stalls before Judging R1.

---

## 10. REPORTING FORMAT AFTER EACH LAYER

1. What was built (files, endpoints, models) 2. How to verify (exact commands) 3. Tests added + results 4. Security/privacy/debugging items addressed 5. Rulebook items now satisfied 6. Risks, known limitations, open questions 7. Suggested commit message(s) — then **STOP and wait**.

---

## 11. OFFICIAL REPOSITORY NOTE (read before touching branches)

- Official repo: `https://github.com/Manipal-Hackathon-2026/Void` — team name **Void**. Organizers pre-created it with an `main` branch (README = event repo guidelines, preserved verbatim at [docs/REPO_GUIDELINES.md](docs/REPO_GUIDELINES.md)), a `bugbounty` placeholder branch, and a branch literally named `fix` (not `fixing`).
- The organizer rulebook pasted into this repo's original README is **authoritative over this file** wherever the two disagree. It says: *create `fixing` directly from `bugbounty` at the start of the Fixing Phase, not before.* So Claude Code must **not** pre-create a `fixing` branch during L0 — create it only at the start of the 02:00 Fixing Phase (P8), off the latest `bugbounty`.
- The stray `fix` branch on the remote is not an official branch per the rulebook; leave it untouched (do not delete, do not build on it) unless the user says otherwise.
- `bugbounty` must be kept in sync with `main` throughout development (merge commits, never force-push) until the Attack Phase freeze at 16 Oct 00:00.
