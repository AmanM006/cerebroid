# Workspace Guidelines & Standing Rules

Always read and adhere to `CLAUDE.md` at the repository root before taking any action.

Key rules:
1. Work layer by layer.
2. Follow house style: no spaces around `=`, `==`, `<`, `>` (e.g. `x=1`, `if a==b:`); no black/ruff format.
3. No AI co-author trailers in git commits.
4. Conventional Commits (`ml:`, `docs:`, `feat:`, `test:`).
5. Never fabricate data, metrics, or numbers.
6. No placeholder or TODO text in committed files; judges read every commit.
7. Verify against `backend/app/domain/contracts.py` before changing data or model interfaces.
8. At the start of each session, read unanswered `[APP→ML]` messages on the open PR and reply by number with evidence.
