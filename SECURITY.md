# Security

VBX is a hackathon research prototype, **not** a diagnostic device, built under the Manipal
Hackathon 2026 Bug Bounty rules (see [docs/REPO_GUIDELINES.md](docs/REPO_GUIDELINES.md)).

## Reporting a vulnerability
- **During the official Bug Bounty Attack Phase:** follow the event's bug-report process (component,
  environment, prerequisites, repro steps, expected vs actual, impact, evidence, severity).
- **At any other time, or for anything you believe is a critical/privacy issue:** report it privately
  to the organizers and/or to the team rather than opening a public issue.

## What's already known
We maintain an honest, up-to-date **Known Limitations** section in [README.md](README.md#11-known-limitations).
Per the rulebook, anything disclosed there before the freeze is excluded from valid Bug Bounty reports
against us — so we keep it genuinely current, not sparse.

## Design posture
Security and privacy are treated as first-class in every build layer, not a final pass. The running
threat model (STRIDE per endpoint, updated every layer) lives in [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).
Current posture:

- No secrets in source control; `.env` is gitignored, `.env.example` holds placeholders only.
- gitleaks runs pre-commit and in CI.
- Dependencies are pinned; `pip-audit` and `bandit` run in CI.
- The API container runs as a non-root user.
- All error responses are a stable `{error_code, message, request_id}` shape — no stack traces, SQL,
  file paths, or library versions ever reach a client (see `backend/app/core/errors.py`).
- Passwords hashed with argon2id; 15-minute HS256 access tokens; rotating refresh tokens in HttpOnly,
  SameSite=Strict cookies with reuse detection; account lockout after repeated failures.
- One shared authorization dependency for every case route; other users' cases return 404.
- The API refuses to start without a strong `JWT_SECRET_KEY`.
