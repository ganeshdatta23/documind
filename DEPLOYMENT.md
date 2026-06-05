# Deploying DocuMind for free

This walks you through a **$0 / no-credit-card-needed** deployment using only free
tiers. You create the accounts and paste a few secrets; the repo already contains
all the config (`render.yaml`, `backend/start.sh`, env templates).

## Architecture (all free tiers)

| Piece | Service | Free tier | Notes |
|-------|---------|-----------|-------|
| LLM + embeddings | **Google Gemini** (AI Studio) | Free, generous | One key, OpenAI-compatible |
| Postgres + pgvector | **Neon** (or Supabase) | 0.5 GB | Vector store + app data |
| Redis | **Upstash** | 10k cmd/day | Cache + rate limiting |
| Backend API | **Render** (Docker web service) | 750 hrs/mo | Spins down when idle |
| Frontend | **Vercel** (Next.js) | Hobby | Auto-build from GitHub |

The backend runs document ingestion **inline** (`CELERY_TASK_ALWAYS_EAGER=true`)
so no separate worker/broker is needed — that keeps it on one free Render service
and well under Upstash's command limit.

### Honest free-tier caveats
- **Cold starts:** Render free spins down after ~15 min idle; the first request
  then takes ~30–60s. (Refresh and it's fast.)
- **Ephemeral disk:** with `STORAGE_BACKEND=local`, uploaded *original files* live
  on Render's ephemeral disk and are lost on restart/redeploy. Embeddings + chunks
  are in Postgres (persistent), so chat over already-ingested docs keeps working;
  only the "download original" would 404. Fine for a demo.
- **Gemini limits:** free tier is rate-limited (requests/min) — keep test docs small.
  Free quota is also **model-specific**: this stack uses `gemini-2.5-flash` (chat)
  and `gemini-embedding-001` (embeddings), which have free quota; some models
  (e.g. `gemini-2.0-flash`) may report a 0 free-tier limit on a given key/region.
- **Neon/Supabase** auto-suspend when idle and resume on the next query.

---

## 0. Prerequisites
- The repo is pushed to GitHub (it is: `ganeshdatta23/documind`).
- A Google account, plus sign-ins for Neon, Upstash, Render, Vercel (all support
  "Sign in with GitHub").

---

## 1. Gemini API key (AI)
1. Go to **https://aistudio.google.com/apikey** → **Create API key**.
2. Copy the key. This is your `OPENAI_API_KEY` value (yes, the var is named
   `OPENAI_*` — it's just the OpenAI-compatible client pointed at Gemini).

---

## 2. Postgres + pgvector (Neon — recommended)
1. **https://neon.tech** → sign up → **New Project** (pick a region near you).
2. After it's created, open **Connection Details** and copy the connection string.
   It looks like:
   `postgresql://USER:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require`
3. Convert it for this app:
   - change the scheme to **`postgresql+asyncpg://`**
   - **drop** the `?sslmode=require` query (we set TLS via `DB_SSL=true` instead)
   - keep the `-pooler` host (IPv4-friendly, works from Render)
   Result → your `DATABASE_URL`:
   `postgresql+asyncpg://USER:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/neondb`
4. Enable pgvector: Neon **SQL Editor** → run `CREATE EXTENSION IF NOT EXISTS vector;`
   (the migration also runs this, but doing it now avoids first-boot surprises).

> **Supabase instead?** Use the **Session pooler** connection string (Settings →
> Database → Connection string → "Session" / port 5432, which is IPv4). Convert the
> scheme to `postgresql+asyncpg://` and drop `sslmode`. Avoid the direct
> `db.*.supabase.co` host — it's IPv6-only and Render can't reach it.

---

## 3. Redis (Upstash)
1. **https://upstash.com** → **Create Database** (Regional, region near your Render).
2. Copy the **`rediss://`** URL (TLS). Format:
   `rediss://default:PASSWORD@HOST.upstash.io:6379`
3. You'll use this same URL for `REDIS_URL`, `CELERY_BROKER_URL`, and
   `CELERY_RESULT_BACKEND`.

---

## 4. Backend on Render (Blueprint)
1. **https://render.com** → **New** → **Blueprint** → connect the GitHub repo.
   Render reads [`render.yaml`](render.yaml) and proposes the `documind-api` service.
2. It will prompt for the `sync:false` env vars. Fill them in:
   | Var | Value |
   |-----|-------|
   | `OPENAI_API_KEY` | your Gemini key (step 1) |
   | `DATABASE_URL` | your Neon asyncpg URL (step 2) |
   | `REDIS_URL` | your Upstash URL (step 3) |
   | `CELERY_BROKER_URL` | same Upstash URL |
   | `CELERY_RESULT_BACKEND` | same Upstash URL |
   | `CORS_ORIGINS` | `["https://PLACEHOLDER.vercel.app"]` (fix in step 6) |
   `SECRET_KEY` and `JWT_SECRET_KEY` are auto-generated; the Gemini model names,
   `EMBEDDING_DIMENSIONS=768`, `DB_SSL=true`, etc. are already set in `render.yaml`.
3. **Create / Apply.** On boot, `start.sh` runs migrations (creating the
   `vector(768)` column to match Gemini), seeds the admin user, and starts the API.
4. Watch the logs until you see `Starting API on port …`. Note your API URL:
   `https://documind-api.onrender.com` (or similar).
5. Sanity check: open `https://YOUR-API.onrender.com/health` → should return OK,
   and `…/api/docs` shows the Swagger UI.

**Default admin** (from the seed): `admin@documind.io` / `Admin123!`
— change the password after first login.

---

## 5. Frontend on Vercel
1. **https://vercel.com** → **Add New… → Project** → import the repo.
2. **Root Directory: `frontend`** (important — the Next.js app lives there).
   Framework preset auto-detects as Next.js.
3. **Environment Variables** → add:
   `NEXT_PUBLIC_API_URL = https://YOUR-API.onrender.com`
   (no trailing slash; this is baked in at build time).
4. **Deploy.** Note your frontend URL: `https://YOUR-APP.vercel.app`.

---

## 6. Connect CORS (one-time)
1. Back in Render → `documind-api` → **Environment** → set
   `CORS_ORIGINS` = `["https://YOUR-APP.vercel.app"]` (your real Vercel URL, JSON list).
2. Save → Render redeploys. (`COOKIE_SAMESITE=none` + `COOKIE_SECURE=true` are
   already set so the refresh-token cookie works cross-site.)

---

## 7. Smoke test
1. Open `https://YOUR-APP.vercel.app` → log in with `admin@documind.io` / `Admin123!`.
   (First hit may cold-start the API — give it ~40s.)
2. **Documents** → upload a small PDF/txt → status should reach **ready**
   (ingestion runs inline, so it may take a few seconds).
3. **Chat** → ask a question about the doc → you should get a streamed answer with
   citations. 🎉

---

## Troubleshooting
- **Login works but you're logged out after ~15 min:** the refresh cookie isn't
  crossing domains — confirm `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true`, and that
  `CORS_ORIGINS` exactly matches the Vercel origin (https, no trailing slash).
- **CORS errors in the browser console:** `CORS_ORIGINS` must be a JSON array and
  match the frontend origin exactly; redeploy Render after changing it.
- **DB connection/SSL errors:** ensure `DATABASE_URL` uses `postgresql+asyncpg://`,
  has **no** `sslmode` query param, and `DB_SSL=true` is set (it is, in render.yaml).
  On Supabase use the **Session pooler** (IPv4) host.
- **Embeddings error / dimension mismatch:** the DB column is sized at first
  migration from `EMBEDDING_DIMENSIONS`. It must equal your embedding model's size
  (768 for `gemini-embedding-001` with `EMBEDDING_SEND_DIMENSIONS=true`). If you
  change models later, drop & recreate the
  `chunk_embeddings.embedding` column at the new size.
- **Gemini "batch"/input errors on embeddings:** keep `EMBEDDING_BATCH_SIZE=1`
  (set in render.yaml). Raise it only if your provider accepts array input.
- **429 / rate limit from Gemini:** you've hit the free RPM cap — wait, or upload
  smaller docs.

---

## Local development
Unchanged — the defaults still target local Postgres/Redis + OpenAI. Copy
`.env.example` → `backend/.env.local` and fill in values. See the repo README for
the Docker Compose / conda setup. The free-provider values live in the "FREE
DEPLOY" block at the bottom of `.env.example`.
