# Bug Bounty self-test

Run on 15 Oct 2026 against a local Docker build and the public deployment (`https://cerebroid-app.onrender.com`),
commit `5f31a09`. Each row was tested with real HTTP requests. Automated regression tests live in
`backend/tests/security/` and `backend/tests/api/test_uploads.py` (285 tests pass).

| Area | What was tried | Result |
|---|---|---|
| Anonymous access | Every study, case, volume, model-card and audit route without a token | 401 everywhere; only `/health`, `/ready`, `/api/v1/metrics/summary`, `/openapi.json` and the frontend are public |
| IDOR | Other accounts' uploads, random/zero/uppercase UUIDs, non-UUID ids, SQL and traversal strings as ids, on all 12 study routes and DELETE | 404 (identical to "does not exist") or 422; never another user's data |
| Role checks | Clinician on audit verify; reviewer uploading; anyone deleting a demo case | 403 |
| Tokens | alg `none`, wrong key, tampered role, wrong type/issuer, missing claims, Basic scheme, 8 KB header, garbage | 401 |
| Sessions | Refresh rotation, replay of a rotated refresh token, logout | Replay revokes the whole session family; logout makes the access token fail at once |
| Login input | Non-JSON, arrays, extra fields (`role`), wrong types, 65-char username, 257-char password, NUL/newline, SQL injection, NoSQL operators, 50 000-deep nesting, 5 000-digit numbers, duplicate keys | 401/422 with the standard error body; no token issued |
| User enumeration | Unknown user vs wrong password | Same status, message and argon2 timing |
| Brute force | Repeated failed logins | 429 after 30 failures per client IP in 5 min; successes never count; per-account lockout for real accounts |
| Parameter fuzzing | `marker`, `known`, `view`, `sequence`, `limit`, `offset` with invalid, duplicate, oversized (10 KB), unicode, CRLF, SQL, traversal and prototype-pollution values on every analysis route | 4xx with the standard error body; no header injection; no 5xx |
| Path traversal | `../`, `%2e%2e`, `..%2f`, `..;`, double encoding, backslashes, NUL, raw-socket `/../../etc/passwd`, `/.env`, `/.git/config`, source files | Index page or 404; no file outside the built frontend is ever served |
| HTTP methods | PUT, PATCH, DELETE, TRACE, OPTIONS, PROPFIND on API routes | 405, nothing echoed |
| CORS | `evil.example`, `null`, look-alike suffix origins, preflight and simple requests | No `Access-Control-Allow-Origin` for foreign origins |
| Headers | CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, HSTS | On every app response, errors included; HSTS in production |
| Request ID / Host | Script and oversized `X-Request-Id`; forged `Host` and `X-Forwarded-Host` | Replaced by a server ID; never reflected |
| Body size | 2 MB JSON, 3 MB chunked body, 41 MB upload, chunked upload | 413 / 411 before parsing |
| Uploads | Ages 17/101/float/unicode digits/`1e2`/5 000 digits, bad sex, script or overlong label, invalid lab values, missing or empty files, HTML as NIfTI, traversal filenames, mass-assignment fields (`owner_id`, `kind`), 1 500 form fields, gzip bomb, 4D/complex/fake headers, NaN voxels, non-stripped heads, mismatched grids | 422/413/400 at once, or the upload fails with a specific error code in the isolated worker; no path from the client is ever used |
| Error leakage | Every response above scanned for stack traces, file paths, SQL, library names | None found |
| Frontend | `innerHTML`/`dangerouslySetInnerHTML`/`eval` sinks; token storage | None; access token in memory only, refresh token in an HttpOnly SameSite=Strict cookie |

Responses produced by Cloudflare or Render before a request reaches the app (for example `%00` in a path) carry the
host's own error page; see Known Limitations in the README.
