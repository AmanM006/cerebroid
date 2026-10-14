# ADR-001: Initial architecture, repo layout, and branch strategy

**Status:** Accepted
**Date:** 2026-10-14
**Layer:** L0 Foundation

## Context
Manipal Hackathon 2026, problem statement "From Image to Clinical Story". The event issued a GitHub
repository (`Manipal-Hackathon-2026/Void`) pre-seeded with a `main` branch (README = event rulebook,
preserved at [docs/REPO_GUIDELINES.md](../REPO_GUIDELINES.md)), a `bugbounty` placeholder branch, and
a branch literally named `fix`. We need a stack and layout that:
- one person (Tanish) can complete solo in the first ~1-2 hours (Layer 0),
- splits cleanly into two parallel tracks afterwards (ML vs APP, per CLAUDE.md §9A),
- supports a swappable per-marker ML plugin contract,
- treats security/privacy/debuggability as first-class from the start, not bolted on later,
- satisfies the event's documentation and checkpoint requirements without rework.

## Decision
- **Stack:** Python 3.11 + FastAPI + Pydantic v2 + SQLAlchemy 2/Alembic + PostgreSQL for the backend;
  React + Vite + TS + Tailwind + NiiVue for the frontend; Docker Compose for local
  dev and the primary delivery method. Full rationale already fixed in CLAUDE.md §4 — this ADR records
  that we're building to that spec, not re-deciding it.
- **Repo layout:** exactly the tree in CLAUDE.md §4.2 (`ml/`, `backend/`, `frontend/`, `artifacts/`,
  `ops/`, `docs/`), created in full at Layer 0 (with `.gitkeep` placeholders for directories whose real
  content lands in later layers) so the structure is visible and navigable from day one.
- **Branch strategy — deviates from CLAUDE.md §1.2 in one respect:** CLAUDE.md's layer table lists
  `fixing` as a Layer-0 deliverable alongside `main`/`bugbounty`. The organizer's own rulebook
  (authoritative — see CLAUDE.md §11) says `fixing` must be created **directly from `bugbounty` at the
  start of the Fixing Phase (02:00–03:30 on 16 Oct)**, not before. We follow the organizer rule: `main`
  and `bugbounty` are set up now; `fixing` is deferred to Phase P8.
- **Stray `fix` branch:** left untouched. Not an official branch per the rulebook; we do not build on
  it, merge it, or delete it.
- **Error/logging contract fixed now, reused everywhere later:** every error response is
  `{error_code, message, request_id}` (`backend/app/core/errors.py`); every log line is structlog JSON
  carrying the same `request_id` (`backend/app/core/middleware.py`). This is deliberately decided at L0
  because every later layer (auth errors, upload errors, ML errors) builds on it — changing it later
  would mean touching every route.
- **Lint, not format:** ruff runs in `check`-only mode with E225/E251/E226/E231/E252 disabled, per the
  team's no-space-around-operators house style (CLAUDE.md §0.7). No `ruff format`, no `black`.

## Consequences
- `bugbounty` needs an explicit sync-with-`main` step after every layer (merge commit, never
  force-push) until the 00:00 freeze — this is manual discipline, not automated yet; could add a CI
  job to flag drift in a later layer if time allows.
- Because `fixing` doesn't exist yet, anyone reading the repo before 16 Oct 02:00 will see only two of
  the three branches the rulebook names — expected and intentional, documented here and in CLAUDE.md §11
  so it isn't mistaken for an oversight.
- `/ready`'s database check is real (a `SELECT 1` via SQLAlchemy against the compose `db` service) but
  intentionally doesn't yet check model artifacts, since none exist until Layer 2.

## Alternatives considered
- Creating `fixing` immediately for symmetry with CLAUDE.md's layer table — rejected: the organizer
  rulebook takes precedence, and an early `fixing` branch risks confusion about which branch fixes
  should land on during normal development.
- SQLite for local dev instead of Postgres-in-compose from day one — rejected: CLAUDE.md §4.1 allows
  SQLite only as a fallback; starting with real Postgres now means `/ready`'s DB check and Alembic
  (Layer 3) are never working against a different engine than production.
