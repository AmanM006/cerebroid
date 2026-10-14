# Built from the repo root (see docker-compose.yml) because the API needs
# artifacts/ and ml/configs/ as well as backend/. The image mirrors the repo
# layout under /srv/vbx so paths resolve the same as in development.
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

# Files stay owned by root: the API process can read its code and models but not modify them.
USER vbx

EXPOSE 8000

# Apply pending migrations, then hand the process over to uvicorn.
# PORT is set by some hosts (e.g. Render); seed is a no-op unless VBX_SEED_* variables are set.
CMD ["sh", "-c", "alembic upgrade head && python -m app.cli seed && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
