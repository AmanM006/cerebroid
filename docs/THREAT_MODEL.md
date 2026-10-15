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
| S | Password guessing across accounts, or on the lockout-exempt test accounts | Per-client-IP limit, 30 attempts per 5 min (last `X-Forwarded-For` hop, which the client cannot forge) | `test_login_attempts_are_limited_per_client_ip` |
| T/D | Control characters (NUL) in the username reaching Postgres (500) | Username pattern rejects control characters with 422 | `test_control_characters_in_username_are_a_validation_error_not_a_crash` |
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

### `GET /api/v1/studies/{id}/profile`
| STRIDE | Risk | Mitigation | Test |
|---|---|---|---|
| E | Reading another user's study profile (IDOR) | Same `get_accessible_study` dependency as cases; foreign = 404 | `test_other_users_study_profile_is_not_found` |
| T | Label leakage: lab-result columns in the feature table reaching a model | Feature vectors are built only from convention-named feature columns plus the study's age, sex and biopsy history | `test_lab_labels_in_the_feature_table_never_reach_the_models` |
| T | Malformed or contradictory `known` parameters | Strict `<marker>:<0\|1>` pattern, at most 4, no repeats; a known marker is shown, never predicted | `test_invalid_known_values_are_rejected`, `test_duplicate_known_marker_is_rejected` |
| R | A prediction that can't be traced or reproduced | Response carries model sha256 per marker, feature-table sha256, input hash and request ID | `test_profile_is_reproducible` |
| I | A guessed value presented as a prediction | Markers without a deployed set, or whose output fails validation, are `unavailable` with `provenance: missing` | `test_profile_predicts_deployed_markers_and_reports_the_rest_unavailable` |

### `GET /api/v1/studies/{id}/volumes`, `GET /api/v1/studies/{id}/volume/{sequence}`
- **Spoofing / Elevation:** bearer token required; the study is resolved through `get_accessible_study`, so another user's upload returns 404 (`test_foreign_upload_volume_is_hidden`).
- **Tampering / path traversal:** `sequence` must be one of a fixed enum; the directory comes from the server-side `source_patient_id`, which must match `UCSF-PDGM-NNNN`, and the resolved path must stay under `artifacts/volumes/` (`test_unknown_sequence_is_rejected`, `test_malformed_patient_id_never_reaches_the_filesystem`).
- **Information disclosure:** the download file name is the sequence only, never the patient id; responses are `Cache-Control: private`. Volumes are skull-stripped public UCSF-PDGM scans (CC BY 4.0).
- **Denial of service:** files are streamed from disk, not read into memory; only committed demo volumes are served.

### Audit log (`GET /api/v1/audit/verify` and every patient-data read)
- **Repudiation:** profile, evidence, doubt, tipping, reveal and volume reads append `{seq, ts, actor, action, object, model_version, prev_hash, hash}`; hash is sha256 over the fields and the previous hash.
- **Tampering:** editing, deleting or re-hashing an entry breaks the chain at that point (`tests/security/test_audit.py`). A Postgres advisory lock serialises appends so the chain cannot fork. Limitation: someone with database write access could rewrite the entire chain from the start; the head hash would then change, so recording it externally would detect that.
- **Information disclosure:** entries hold IDs and action names only, never clinical values. Only the `reviewer` role can run the check (403 otherwise).

### Model artifact loading (startup)
| STRIDE | Risk | Mitigation | Test |
|---|---|---|---|
| T / E | Tampered or swapped `models.joblib` executing code when unpickled | sha256 of every file checked against the committed `manifest.json` before unpickling; unlisted or mismatched files are never loaded | `test_tampered_artifact_is_never_unpickled` |
| T | Tampered `meta.json` (e.g. lowered decision threshold) | Same sha256 check | `test_tampered_meta_is_rejected` |
| T | Manifest path escaping `artifacts/` | Resolved paths must stay inside the artifacts directory | `test_manifest_entry_outside_artifacts_dir_is_rejected` |
| T | Metadata naming leaked clinical inputs (e.g. `who_grade`) | Feature columns validated against the shared naming convention | `test_invalid_meta_is_rejected` |
| D | One broken marker taking down the API | Each marker loads independently; failures are reported per marker in `/ready` | `test_one_broken_marker_does_not_block_the_others` |
| T | A model emitting NaN/out-of-range probabilities shown as a result | Every probability checked to be finite and within [0, 1]; otherwise an error, never a value | `test_model_returning_nan_at_prediction_time_raises` |
| E | API process modifying its own code or models at runtime | Files in the image are root-owned and read-only to the non-root `vbx` user | manual check in container |

### Global (all routes)
- **Request size (D):** bodies over 1 MB get `413 PAYLOAD_TOO_LARGE` before parsing, declared or chunked (`test_oversized_body_is_rejected_before_parsing`, `test_chunked_oversized_body_is_rejected`).
- **Resource consumption (D):** studies routes are limited per user and client IP; at most 2 heavy computations run at once, others get `503 SERVER_BUSY` (`test_analysis_requests_are_limited_per_user_and_ip`, `test_heavy_computation_returns_busy_when_all_slots_are_taken`).
- **Transport (I):** HSTS is sent in production (`test_hsts_only_in_production`).
- **Token storage (I):** the access token is held in memory only; a reload restores the session through the HttpOnly refresh cookie.
| STRIDE | Risk | Mitigation |
|---|---|---|
| I | Unhandled exceptions leaking stack traces / SQL / paths | Global exception handler (`backend/app/core/errors.py`) returns only `{error_code, message, request_id}`; full exception is logged server-side only, via structlog, keyed by `request_id`. |
| R | No way to trace which request produced which log line / error, across process restarts or multiple replicas | Request-ID middleware (`backend/app/core/middleware.py`) generates/propagates `X-Request-Id`, bound into every structlog line for that request. |
| T | CORS misconfiguration allowing arbitrary origins to call authenticated routes | `CORS_ORIGINS` is an explicit env-driven allowlist (`app/core/config.py`), not `*`. |
| S | Forgeable tokens from a weak or default signing key | `JWT_SECRET_KEY` has no default; the app refuses to start if it's missing, shorter than 32 characters, or the `.env.example` placeholder (`test_config.py`). |

## Process
STRIDE review happens while each feature is built, and every mitigated attack gets a regression test in
`backend/tests/security/` (see [CLAUDE.md](../CLAUDE.md) §5).
