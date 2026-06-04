# Database setup (local Postgres)

Everything here targets a stock, free **PostgreSQL 16** install with the
**pgvector** extension available locally — no managed/paid services required.

## 1. Bootstrap the role, database, and extensions

Run once as a superuser (the default `postgres` role):

```bash
psql -U postgres -f db/setup.sql
```

This creates the `documind` role + database and enables `pgcrypto`, `vector`,
and `pg_trgm`.

## 2. Create the tables

Pick **one**:

- **Alembic (recommended)** — tracks migration history:
  ```bash
  cd backend && poetry run alembic upgrade head
  ```
- **Raw SQL** — one-shot, no migration tracking:
  ```bash
  psql -U documind -d documind -f db/schema.sql
  ```

`db/schema.sql` is kept in sync with `backend/alembic/versions/001_initial_schema.py`.

## 3. Seed your first login

There's no public sign-up, so create the first superadmin with the seed script:

```bash
cd backend && poetry run python -m scripts.seed
# → admin@documind.local / Admin123!  (override via SEED_EMAIL / SEED_PASSWORD)
```

Then sign in at http://localhost:3000/login.
