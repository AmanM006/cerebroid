# Single-service image for free hosting (Render): the API also serves the built
# frontend, so the browser talks to one origin and the SameSite=Strict refresh
# cookie works. docker compose keeps using backend/Dockerfile + ops/nginx.

FROM node:22-alpine AS frontend
WORKDIR /src
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim

# libgomp1: OpenMP runtime required by LightGBM.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system vbx && useradd --system --gid vbx --no-create-home vbx

WORKDIR /srv/vbx/backend

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/alembic.ini .
COPY backend/app ./app
COPY ml/configs /srv/vbx/ml/configs
COPY artifacts /srv/vbx/artifacts
COPY --from=frontend /src/dist /srv/vbx/frontend_dist

ENV FRONTEND_DIST=/srv/vbx/frontend_dist
# Fewer glibc malloc arenas: threaded Python otherwise holds far more memory than it uses (512 MB host).
ENV MALLOC_ARENA_MAX=2

# Files stay owned by root: the API process can read its code, models and frontend but not modify them.
USER vbx

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && python -m app.cli seed && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
