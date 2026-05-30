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
| 🔑 API Key Management | 🚧 Phase 4 |
| 📊 Usage Analytics | 🚧 Phase 5 |
| 🪝 Webhooks | 🚧 Phase 5 |
| 🛡️ Audit Logs | 🚧 Phase 4 |

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

## 🛠️ Development

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt -r requirements-test.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Database Migrations
```bash
cd backend
# Create new migration
alembic revision --autogenerate -m "description"
# Apply migrations
alembic upgrade head
# Rollback
alembic downgrade -1
```

### Running Tests
```bash
cd backend
pytest tests/ -v --cov=. --cov-report=html
```

---

## 📁 Project Structure

See [docs/architecture.md](docs/architecture.md) for the complete architecture documentation.

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, React Query, Zustand |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.x, Alembic, Pydantic v2 |
| Database | PostgreSQL 16 + pgvector |
| Cache/Queue | Redis 7 + Celery |
| AI | OpenAI (text-embedding-3-small + gpt-4o-mini) |
| Storage | Local (dev) → GCS (production) |
| DevOps | Docker Compose → Cloud Run |

---

## 📜 License

MIT — See [LICENSE](LICENSE)
