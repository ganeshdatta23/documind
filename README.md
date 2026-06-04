# DocuMind 🧠

> **Enterprise Document Intelligence Platform powered by RAG**

DocuMind is a production-grade, multi-tenant platform that allows organizations to upload documents and query them using AI-powered semantic search, conversational retrieval with citations, and knowledge discovery.

---

## ✨ Features

| Feature | Status |
|---------|--------|
| 🔐 JWT Auth + RBAC | ✅ |
| 🏢 Multi-tenancy | ✅ |
| 📄 Document Upload (PDF, DOCX, TXT, HTML) | ✅ |
| 🔍 Hybrid Search (Vector + BM25 + RRF) | ✅ |
| 💬 Conversational RAG with Streaming | ✅ |
| 📎 Citation Generation | ✅ |
| 🧵 Conversation summarization (long-context) | ✅ |
| 🔑 API Key Management | ✅ |
| 📊 Usage Analytics | ✅ |
| 🪝 Webhooks (HMAC-signed, retried) | ✅ |
| 🛡️ Audit Logs | ✅ |

---

## 🏗️ Architecture

```
Modular Monolith
│
├── backend/          # Python 3.12 + FastAPI
│   ├── modules/      # Auth, Document, Chat, Search, Admin
│   ├── rag/          # Hybrid Retrieval, Reranking, Citations
│   ├── workers/      # Celery: Ingestion, Embedding, Webhooks
│   └── integrations/ # Storage, AI, OCR, Parsers
│
├── frontend/         # Next.js 14 + TypeScript + Tailwind
│   └── app/          # App Router pages and layouts
│
└── docker/           # Dockerfiles + Docker Compose
```

---

## 🚀 Quick Start

### Prerequisites
- Docker + Docker Compose
- OpenAI API key

### 1. Clone & configure
```bash
git clone https://github.com/your-org/documind.git
cd documind
cp .env.example .env.local
# Edit .env.local and add your OPENAI_API_KEY
```

### 2. Start all services
```bash
docker compose up -d
```

### 3. Run migrations
```bash
docker compose exec api alembic upgrade head
```

### 4. Access the app
- **Frontend**: http://localhost:3000
- **API Docs**: http://localhost:8000/api/docs
- **Flower** (queue monitor): http://localhost:5555

---

## 🛠️ Local development (no Docker, all free)

This path uses a local PostgreSQL install plus a Conda env and Poetry — no paid
services. (Document Q&A still calls the OpenAI API, which needs a key, but the
app boots and the UI runs without one.)

### 1. Postgres

Install PostgreSQL 16 with the `pgvector` extension, then bootstrap the role,
database, and extensions:

```bash
psql -U postgres -f db/setup.sql
```

### 2. Backend (Conda + Poetry)

```bash
conda env create -f environment.yml      # python 3.12 + poppler/tesseract/libmagic
conda activate documind

cd backend
poetry install                            # installs deps from pyproject.toml
poetry run alembic upgrade head           # create tables (or: psql -f ../db/schema.sql)
poetry run python -m scripts.seed         # first login: admin@documind.local / Admin123!
poetry run uvicorn main:app --reload
```

The API is now at http://localhost:8000 and the OpenAPI spec at
`http://localhost:8000/api/openapi.json`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev    # `predev` auto-generates typed hooks from the live OpenAPI spec
```

> The frontend's OpenAPI codegen (`scripts/generate-api.ts`) runs automatically
> before `dev`/`build`. Once the backend is up it reads `/api/openapi.json` and
> regenerates `lib/generated/*` and per-tag hooks in `hooks/generated/*`
> (auth, documents, conversations, search, api-keys, webhooks, …). If the
> backend is down it falls back to the cached snapshot or placeholders, so the
> build never breaks.

### Database migrations

```bash
cd backend
poetry run alembic revision --autogenerate -m "description"
poetry run alembic upgrade head
poetry run alembic downgrade -1
```

### Tests

```bash
cd backend
poetry run pytest --cov=. --cov-report=html
```

---

## 📁 Project Structure

See [docs/architecture.md](docs/architecture.md) for the complete architecture documentation.

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, React Query, Zustand |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.x, Alembic, Pydantic v2, Poetry |
| Database | PostgreSQL 16 + pgvector |
| Cache/Queue | Redis 7 + Celery |
| AI | OpenAI (text-embedding-3-small + gpt-4o-mini) |
| Storage | Local (dev) → GCS (production) |
| DevOps | Docker Compose → Cloud Run |

---

## 📜 License

MIT — See [LICENSE](LICENSE)
