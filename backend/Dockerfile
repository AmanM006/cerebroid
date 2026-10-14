FROM python:3.11-slim

WORKDIR /app

RUN groupadd --system vbx && useradd --system --gid vbx --no-create-home vbx

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY alembic.ini .
COPY app ./app

RUN chown -R vbx:vbx /app
USER vbx

EXPOSE 8000

# Apply pending migrations, then hand the process over to uvicorn.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
