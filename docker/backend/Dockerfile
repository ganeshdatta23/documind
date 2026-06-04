FROM python:3.12-slim AS base

# Install system dependencies required for PDF parsing and OCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    tesseract-ocr \
    poppler-utils \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
# Install Poetry and install dependencies straight into the system environment.
ENV POETRY_VERSION=1.8.5
ENV POETRY_VIRTUALENVS_CREATE=false
ENV PIP_NO_CACHE_DIR=1
RUN pip install --upgrade pip && pip install "poetry==${POETRY_VERSION}"
COPY backend/pyproject.toml backend/poetry.loc[k] ./
# --no-root: this is an application, there's no package to install.
RUN poetry install --no-root --only main

FROM deps AS final
WORKDIR /app
COPY backend/ .

# Security: run as non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
