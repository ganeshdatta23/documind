-- DocuMind — local Postgres bootstrap.
--
-- Run this once as a superuser (e.g. the default `postgres` role) to create the
-- application role, database, and required extensions. After this, either run
-- `alembic upgrade head` from the backend, or load db/schema.sql to create the
-- tables directly.
--
--   psql -U postgres -f db/setup.sql
--
-- Everything here is free and runs against a stock local PostgreSQL 16 install
-- with the pgvector extension available (the `vector` extension below).

-- Create the application role if it doesn't already exist.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'documind') THEN
        CREATE ROLE documind WITH LOGIN PASSWORD 'documind_dev';
    END IF;
END
$$;

-- Create the database owned by that role. (CREATE DATABASE can't run inside a
-- DO block / transaction, so we guard it with \gexec instead.)
SELECT 'CREATE DATABASE documind OWNER documind'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'documind')
\gexec

-- Enable the extensions the schema relies on. These must be created inside the
-- target database, so reconnect to it first.
\connect documind

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS vector;     -- pgvector: embedding column + ANN index
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- trigram fuzzy matching

GRANT ALL PRIVILEGES ON DATABASE documind TO documind;
GRANT ALL ON SCHEMA public TO documind;
