# Threat Model (STRIDE, per endpoint)

Updated every build layer. Every mitigated attack listed here gets a regression test under
`backend/tests/security/` once the relevant code exists.

Legend: **S**poofing · **T**ampering · **R**epudiation · **I**nfo disclosure · **D**oS · **E**levation

## Endpoints

### `GET /health`
| STRIDE | Risk | Mitigation |
|---|---|---|
| D | Trivial to hammer; must stay cheap so it never becomes a self-inflicted DoS vector | No dependency calls — returns a static body only. Rate limiting deferred to Layer 7 (acceptable at L0: no sensitive work happens here). |
| I | None — no data returned | N/A |

### `GET /ready`
| STRIDE | Risk | Mitigation |
|---|---|---|
| D | Each call opens a DB connection; could be used to exhaust connection pool | `pool_pre_ping` + short-lived connection per call. Will move to a cached/periodic check + rate limiting in Layer 7 if this proves to be a real load concern. |
| I | DB connection errors could leak connection strings/host info if ever reflected to the client | Handler catches `SQLAlchemyError` and returns only a boolean per check — no exception text ever reaches the response (`backend/app/api/health.py`). |

### Global (all routes)
| STRIDE | Risk | Mitigation |
|---|---|---|
| I | Unhandled exceptions leaking stack traces / SQL / paths | Global exception handler (`backend/app/core/errors.py`) returns only `{error_code, message, request_id}`; full exception is logged server-side only, via structlog, keyed by `request_id`. |
| R | No way to trace which request produced which log line / error, across process restarts or multiple replicas | Request-ID middleware (`backend/app/core/middleware.py`) generates/propagates `X-Request-Id`, bound into every structlog line for that request. |
| T | CORS misconfiguration allowing arbitrary origins to call authenticated routes once auth exists | `CORS_ORIGINS` is an explicit env-driven allowlist (`app/core/config.py`), not `*`. |

## Planned controls (added with the corresponding features)
- **Auth (Layer 3):** credential stuffing, token replay, IDOR on `/cases`, `/studies/*` — argon2id,
  short-lived JWT + rotating refresh with reuse detection, per-route ownership/role dependency.
- **Upload pipeline (Layer 7):** gzip bombs, oversized/malformed NIfTI, path traversal via filenames,
  non-skull-stripped volumes (privacy, §6 of CLAUDE.md) — magic-byte + size-cap validation, isolated
  parsing subprocess, server-generated storage keys, skull-strip heuristic.
- **Rate limiting (Layer 7):** brute force on auth, upload-spam, inference-spam.
- **Audit log (Layer 4):** tampering with access history — hash-chained log + `/audit/verify`.
- **Model robustness (Layer 4):** adversarial/out-of-distribution inputs forcing a confident-looking
  but meaningless prediction — OOD guard based on feature-space distance to training data.

## Process
- STRIDE review happens *while building* each layer, not after — this file is part of each layer's
  Definition of Done per [CLAUDE.md](../CLAUDE.md) §5.
- `docs/BUGBOUNTY_SELFTEST.md` (added by Layer 9) turns this into a concrete pre-freeze checklist.
