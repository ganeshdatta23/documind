#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Production launcher for a single-container deploy (e.g. Render free tier).
#
# Runs DB migrations, seeds an admin user (idempotent), and starts the API.
# Render's free plan has no separate background-worker service, so by default we
# run document processing inline via Celery's eager mode (CELERY_TASK_ALWAYS_EAGER=true).
# If you DO have a worker/broker budget, set CELERY_TASK_ALWAYS_EAGER=false and
# this script will also launch a Celery worker alongside the API.
# ─────────────────────────────────────────────────────────────────────────────
set -e

# Make top-level modules (config, main, …) importable regardless of CWD.
export PYTHONPATH="/app:${PYTHONPATH:-}"

echo "→ Running database migrations…"
alembic upgrade head

echo "→ Seeding initial admin user (idempotent)…"
python scripts/seed.py || echo "  (seed skipped — user likely already exists)"

if [ "${CELERY_TASK_ALWAYS_EAGER:-true}" != "true" ]; then
  echo "→ Starting Celery worker in the background…"
  celery -A celery_app worker \
    --loglevel=info \
    --concurrency="${CELERY_CONCURRENCY:-1}" \
    -Q ingestion,embedding,webhooks,summaries,maintenance &
fi

echo "→ Starting API on port ${PORT:-8000}…"
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers "${WEB_CONCURRENCY:-1}"
