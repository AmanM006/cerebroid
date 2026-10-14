# VBX frontend

React 19 + Vite + TypeScript + Tailwind, with [NiiVue](https://github.com/niivue/niivue) (BSD-2-Clause) for
WebGL MRI rendering.

## Run (development)
The API must be running on `http://localhost:8000` (`docker compose up` from the repo root).
```bash
npm install
npm run dev
```
Open `http://localhost:5173`. The dev server proxies `/api`, `/ready` and `/health` to the API, so the browser sees a
single origin and the HttpOnly refresh cookie works without CORS.

## Checks (also run in CI)
```bash
npm run lint        # ESLint correctness rules only; no formatter (team style omits spaces around =, ==, <, >)
npm run typecheck
npm run build
npm audit --audit-level=high
```

## Structure
| Path | Purpose |
|---|---|
| `src/api/client.ts` | The only code that calls the backend. Access token kept in memory only; one shared refresh attempt on expiry; every failure becomes an `ApiError` carrying `error_code` and `request_id`. |
| `src/api/types.ts` | Mirrors the backend response schemas. |
| `src/auth/AuthContext.tsx` | Session state; restores the session from the refresh cookie on page load. |
| `src/components/MriViewer.tsx` | NiiVue viewer. Volumes are downloaded through the API client (authenticated) and loaded from memory; later volumes are drawn as overlays (e.g. tumor segmentation). Loaded lazily, so NiiVue is only downloaded when a case is opened. |
| `src/components/ProvenanceBadge.tsx` | Icon + text provenance label shown next to every patient value. |
| `src/pages/` | Login, case list, and the three-region case workspace (viewer · molecular profile · evidence & doubt). |

The workspace shows only what the API returns: per-marker model availability comes from `/ready`, patient values
carry their provenance from the API, and errors show the request ID that matches the server logs.
