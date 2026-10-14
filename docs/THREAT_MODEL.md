# Threat Model (STRIDE, per endpoint)

Updated every build layer. Every mitigated attack listed here gets a regression test under
`backend/tests/security/` once the relevant code exists.

Legend: **S**poofing · **T**ampering · **R**epudiation · **I**nfo disclosure · **D**oS · **E**levation

## Endpoints

### `GET /health`
| STRIDE | Risk | Mitigation |
|---|---|---|
| D | Trivial to hammer; must stay cheap so it never becomes a self-inflicted DoS vector | No dependency calls — returns a static body only. |
| I | None — no data returned | N/A |

### `GET /ready`
| STRIDE | Risk | Mitigation |
|---|---|---|
| D | Repeated calls exhausting database connections | Uses the shared, bounded connection pool (5 + 10 overflow, 5 s checkout timeout) in `app/db/session.py`; no new pool per request. |
| I | DB connection errors could leak connection strings/host info if ever reflected to the client | Handler catches `SQLAlchemyError` and returns only a boolean per check — no exception text ever reaches the response (`backend/app/api/health.py`). |

### `POST /api/v1/auth/login`
| STRIDE | Risk | Mitigation | Test |
|---|---|---|---|
| S | Password guessing / credential stuffing | Account lockout after 5 failures for 15 min; argon2id hashing makes each guess expensive | `test_account_locks_after_repeated_failures` |
| I | Username enumeration via different errors or timing | Identical `AUTH_INVALID_CREDENTIALS` body for unknown user, wrong password, locked or inactive account; a full argon2 verify runs against a dummy hash for unknown users | `test_wrong_password_and_unknown_user_are_indistinguishable` |
| T | Mass assignment (e.g. sending `"role": "reviewer"`) | Strict request model with `extra="forbid"`; role is never read from the request | `test_login_rejects_unknown_fields` |
| D | Huge request bodies hashed by argon2 | Username ≤64 chars, password ≤256 chars, rejected before hashing | `test_login_rejects_oversized_password` |
| D | Attacker locks a known account | Accepted: lockout is temporary (15 min); disclosed in README Known Limitations | — |
| I | Passwords in logs | Logs carry only `user_id`, reason code and `request_id` | manual log scan |

### `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`
| STRIDE | Risk | Mitigation | Test |
|---|---|---|---|
| S | Stolen refresh token reused | Rotation on every use; replaying an already-rotated token revokes the whole token family | `test_reusing_a_rotated_refresh_token_revokes_the_whole_session` |
| I | Refresh token readable by page JavaScript (XSS) | HttpOnly cookie, never in a response body | `test_login_returns_access_token_and_httponly_refresh_cookie` |
| T | Cross-site request triggering refresh/logout (CSRF) | `SameSite=Strict`, cookie path limited to `/api/v1/auth`; the new access token is only in the response body, which a cross-origin page can't read (CORS allowlist) | — |
| I | Database leak exposes live sessions | Only SHA-256 hashes of refresh tokens are stored | — |
| R | Session survives logout | Logout revokes the whole family server-side | `test_logout_revokes_refresh_token` |

### Bearer-protected routes (`/api/v1/auth/me`, `/api/v1/cases*`)
| STRIDE | Risk | Mitigation | Test |
|---|---|---|---|
| S | Forged token (`alg: none`, other key, tampered claims) | Algorithm pinned to HS256, issuer and all claims required, signature verified | `test_alg_none_token_is_rejected`, `test_tampered_payload_is_rejected`, `test_token_signed_with_another_key_is_rejected` |
| S | Expired or non-access token | `exp` enforced; `type` must be `access` | `test_expired_token_is_rejected`, `test_tokens_with_wrong_claims_are_rejected` |
| E | Deleted or deactivated user keeps access | User re-loaded and `is_active` checked on every request | `test_token_for_deleted_user_is_rejected`, `test_token_for_deactivated_user_is_rejected` |
| E | IDOR: reading another user's case by ID | One shared `get_accessible_study` dependency; visibility = public demo or owned by caller | `test_other_users_upload_looks_exactly_like_a_missing_case`, `test_reviewer_cannot_open_a_clinicians_upload` |
| I | Probing which case IDs exist | Foreign and nonexistent cases return identical 404 bodies; IDs are random UUIDv4 | same as above |
| T | Injection / traversal via path parameter | Path parameter parsed as UUID; anything else is rejected before touching the database | `test_malformed_case_ids_are_rejected` |
| D | Unbounded list queries | `limit` 1–100, `offset` ≤10,000 | `test_pagination_bounds_are_enforced` |
| I | Patient values without provenance | Age/sex returned as `ProvenancedValue` | `test_case_values_carry_provenance` |

### Global (all routes)
| STRIDE | Risk | Mitigation |
|---|---|---|
| I | Unhandled exceptions leaking stack traces / SQL / paths | Global exception handler (`backend/app/core/errors.py`) returns only `{error_code, message, request_id}`; full exception is logged server-side only, via structlog, keyed by `request_id`. |
| R | No way to trace which request produced which log line / error, across process restarts or multiple replicas | Request-ID middleware (`backend/app/core/middleware.py`) generates/propagates `X-Request-Id`, bound into every structlog line for that request. |
| T | CORS misconfiguration allowing arbitrary origins to call authenticated routes | `CORS_ORIGINS` is an explicit env-driven allowlist (`app/core/config.py`), not `*`. |
| S | Forgeable tokens from a weak or default signing key | `JWT_SECRET_KEY` has no default; the app refuses to start if it's missing, shorter than 32 characters, or the `.env.example` placeholder (`test_config.py`). |

## Process
STRIDE review happens while each feature is built, and every mitigated attack gets a regression test in
`backend/tests/security/` (see [CLAUDE.md](../CLAUDE.md) §5).
