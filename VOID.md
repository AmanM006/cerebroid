# Void (Cerebroid): known limitations

Every behaviour below is known, intentional or accepted, and disclosed before the Attack Phase. The same items
appear in the README ([section 11, Known limitations](README.md#11-known-limitations)). Grouped by bug report
category.

## Login and access control
- **Shared test accounts.** `evaluator`, `doctor` and `reviewer` and their passwords are published on purpose, so
  anyone can sign in as them. Everyone using the same account sees, and can delete, that account's uploads, and
  shares its limit of 10 kept uploads (delete one to upload again). The `reviewer` account can run the read-only
  audit-log check. None of them can change models, demo cases or other accounts; real deployments would issue
  personal accounts.
- **Account lockout.** 5 failed logins lock a real account for 15 minutes, so anyone who knows a username can lock
  that account for 15 minutes. The synthetic test accounts are exempt: their passwords are public, so locking them
  would only lock evaluators out.
- **Failed-login limit per client IP.** 30 failed attempts per 5 minutes, then wrong passwords get
  `429 RATE_LIMITED` with `Retry-After`. Successful sign-ins never count, and a correct password still signs in
  from a limited address, because many people share one public address (a campus network). The limit is in
  memory and resets when the server restarts.
- **Sessions.** Refreshing the same session from two tabs at the same moment counts as refresh-token reuse and
  signs that session out; the user signs in again. Session refreshes are limited to 120 per client IP per
  5 minutes. Logout ends the session at once: its access token stops working immediately.
- The refresh cookie has the `Secure` flag only when `APP_ENV=production` (the public deployment); a local
  development stack over plain HTTP does not set it.
- **Removing a demo case** in the case list hides it in that browser only (stored in the browser). Demo cases are
  shared and are never deleted; uploads are deleted for real by their owner.

## Cross-site request forgery
- **No CSRF tokens, by design.** The API takes the access token from the `Authorization` header, never from a
  cookie. The refresh cookie is `SameSite=Strict`, HttpOnly and scoped to `/api/v1/auth`.

## Information exposure
- `GET /openapi.json` is public on purpose, so evaluators can explore the API. The public deployment has no `/docs`
  page (Swagger needs third-party script, which our CSP blocks).
- `GET /api/v1/metrics/summary` is public: it returns only aggregate held-out metrics and the number of demo cases.
- `GET /ready` is public: it reports whether the database and each model set are loaded.
- Requests that Cloudflare or Render (or nginx, in the Docker Compose setup) reject before they reach the app
  (malformed or encoded paths such as `%00` or `..%2f`, patterns their firewall blocks) get the host's own error
  page, without our security headers or request ID.

## Uploads
- **Processed as voxel data only.** Files are not virus-scanned. They are never served back as uploaded: the viewer
  gets volumes rebuilt from voxels and geometry, and the raw files are deleted after processing.
- A tumor mask is required (no automatic segmentation). Volumes must be skull-stripped and co-registered. The
  skull-stripping check is a heuristic (the volume's outer border must be background), so a tightly cropped head
  scan could pass and a stripped brain touching the edge could be rejected.
- Uploads are kept on the server's temporary disk and deleted after 24 hours; on the free host they are also lost
  on every redeploy or restart. They are processed one at a time, so a second upload waits for the first.
- Lab results typed in with an upload are the uploader's own entries (shown as clinical input). They are not
  verified, and are used only for the reveal comparison, never by the models.
- Features of uploads are extracted with the training code (mode `v1`); for scanners unlike the training sites the
  out-of-distribution flag will usually be raised.

## Resource limits
- Request bodies over 1 MB are rejected with `413 PAYLOAD_TOO_LARGE` before parsing (uploads: 150 MB, streamed to
  disk, 40 MB per file, at most 20 uploads per hour per account and client IP).
- Analysis routes (`/api/v1/studies/*`) allow 300 requests per minute per user and client IP. At most 2 heavy
  computations (uncached profiles, tipping sweeps) run at once; others wait up to 20 s, then get
  `503 SERVER_BUSY` with `Retry-After`. Repeat views are served from a cache and never wait.
- **Free hosting tier.** The public deployment sleeps after 15 idle minutes; the first request then takes about a
  minute. It runs as one small instance, so counters and caches reset when it restarts.

## Audit log
- Entries are hash-chained, so editing or deleting one is detected. Someone with write access to the database could
  still rebuild the whole chain from the start (the head hash then changes, so recording it elsewhere detects that).
  In a self-hosted copy that is whoever runs the database.

## Model behaviour (not security defects)
- **Decision support only.** Every result is to be confirmed with tissue; the app is not a diagnostic device.
- **1p/19q** caught no co-deleted tumour in the held-out test sets (recall 0%). **MGMT** has no reliable MRI signal
  and is never called. The **grade 4 alert** (threshold chosen on cross-validation) also flags about 15% of
  grade 2-3 tumours.
- **Other hospitals.** Trained on UCSF-PDGM (one hospital) plus 70% of a TCGA cohort. On the held-out 30% of TCGA:
  IDH 91% accurate (AUC 0.99), grade 86% (AUC 0.95); 1p/19q and MGMT do not transfer. Too few non-White patients
  for per-race conclusions; race is never a model input.
- **Scanner intensity.** First-order intensity features use raw scanner values (mode `v1`), so a scanner gain
  change alters them; noise and bias-field shading in the stress test changed 0 of 36 calls.
- **Tumor outline errors.** Shifting or shrinking the segmentation by one voxel changed 1-2 of 36 calls and several
  verdicts. There is no automatic segmentation or mask quality check.
