-- DocuMind — full schema DDL.
--
-- This mirrors backend/alembic/versions/001_initial_schema.py. Prefer
-- `alembic upgrade head` for real environments (it tracks migration state);
-- this file exists so you can stand up a fresh local database in one shot:
--
--   psql -U documind -d documind -f db/schema.sql
--
-- Assumes the pgcrypto, vector and pg_trgm extensions already exist
-- (db/setup.sql creates them).

BEGIN;

-- ── tenants ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                 VARCHAR(255) NOT NULL,
    slug                 VARCHAR(100) NOT NULL,
    plan                 VARCHAR(50)  NOT NULL DEFAULT 'free',
    status               VARCHAR(50)  NOT NULL DEFAULT 'active',
    max_storage_bytes    BIGINT       DEFAULT 1073741824,
    max_documents        INTEGER      DEFAULT 100,
    max_users            INTEGER      DEFAULT 5,
    max_api_calls_month  INTEGER      DEFAULT 1000,
    settings             JSONB        DEFAULT '{}',
    metadata             JSONB        DEFAULT '{}',
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at           TIMESTAMPTZ,
    CONSTRAINT ck_tenants_plan   CHECK (plan IN ('free','starter','professional','enterprise')),
    CONSTRAINT ck_tenants_status CHECK (status IN ('active','suspended','deleted'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_slug ON tenants (slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants (status) WHERE deleted_at IS NULL;

-- ── users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email               VARCHAR(255) NOT NULL,
    hashed_password     VARCHAR(255),
    full_name           VARCHAR(255) NOT NULL,
    avatar_url          TEXT,
    is_active           BOOLEAN DEFAULT TRUE,
    is_superadmin       BOOLEAN DEFAULT FALSE,
    email_verified      BOOLEAN DEFAULT FALSE,
    email_verified_at   TIMESTAMPTZ,
    last_login_at       TIMESTAMPTZ,
    last_login_ip       INET,
    failed_login_count  INTEGER DEFAULT 0,
    locked_until        TIMESTAMPTZ,
    settings            JSONB DEFAULT '{}',
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT uq_users_email_tenant UNIQUE (tenant_id, email)
);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email) WHERE deleted_at IS NULL;

-- ── roles & permissions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name          VARCHAR(100) NOT NULL,
    display_name  VARCHAR(255) NOT NULL,
    description   TEXT,
    is_system     BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_roles_name_tenant UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS permissions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource     VARCHAR(100) NOT NULL,
    action       VARCHAR(100) NOT NULL,
    description  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_permissions_resource_action UNIQUE (resource, action)
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    granted_by  UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id        UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id  UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- ── refresh_tokens ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    token_hash   VARCHAR(255) NOT NULL UNIQUE,
    device_info  JSONB DEFAULT '{}',
    ip_address   INET,
    expires_at   TIMESTAMPTZ NOT NULL,
    revoked_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id);

-- ── api_keys ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          VARCHAR(255) NOT NULL,
    key_prefix    VARCHAR(16) NOT NULL,
    key_hash      VARCHAR(255) NOT NULL UNIQUE,
    scopes        VARCHAR[] DEFAULT '{read}',
    last_used_at  TIMESTAMPTZ,
    expires_at    TIMESTAMPTZ,
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys (tenant_id) WHERE deleted_at IS NULL;

-- ── documents ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    uploaded_by       UUID NOT NULL REFERENCES users(id),
    title             VARCHAR(500) NOT NULL,
    description       TEXT,
    file_name         VARCHAR(500) NOT NULL,
    file_type         VARCHAR(50) NOT NULL,
    mime_type         VARCHAR(100) NOT NULL,
    file_size_bytes   BIGINT NOT NULL,
    storage_path      TEXT NOT NULL,
    storage_bucket    VARCHAR(255) NOT NULL,
    checksum_sha256   VARCHAR(64) NOT NULL,
    status            VARCHAR(50) DEFAULT 'pending',
    error_message     TEXT,
    page_count        INTEGER,
    word_count        INTEGER,
    language          VARCHAR(10),
    tags              VARCHAR[] DEFAULT '{}',
    custom_metadata   JSONB DEFAULT '{}',
    is_public         BOOLEAN DEFAULT FALSE,
    version           INTEGER DEFAULT 1,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ,
    CONSTRAINT ck_documents_status CHECK (
        status IN ('pending','parsing','chunking','embedding','ready','failed','archived')
    )
);
CREATE INDEX IF NOT EXISTS idx_documents_tenant_status ON documents (tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_tenant_created ON documents (tenant_id, created_at);

-- ── document_chunks ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_chunks (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id    UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    chunk_index    INTEGER NOT NULL,
    content        TEXT NOT NULL,
    content_hash   VARCHAR(64) NOT NULL,
    char_start     INTEGER,
    char_end       INTEGER,
    page_number    INTEGER,
    section_title  TEXT,
    token_count    INTEGER,
    metadata       JSONB DEFAULT '{}',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_chunk_index UNIQUE (document_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON document_chunks (document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_tenant_id ON document_chunks (tenant_id);
-- Full-text (BM25-style) index for keyword retrieval.
CREATE INDEX IF NOT EXISTS idx_chunks_fts ON document_chunks USING gin (to_tsvector('english', content));

-- ── chunk_embeddings (pgvector) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chunk_embeddings (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chunk_id       UUID NOT NULL UNIQUE REFERENCES document_chunks(id) ON DELETE CASCADE,
    tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    document_id    UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    model_name     VARCHAR(100) DEFAULT 'text-embedding-3-small',
    model_version  VARCHAR(50),
    embedding      vector(1536) NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_embeddings_tenant_id ON chunk_embeddings (tenant_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_document_id ON chunk_embeddings (document_id);
-- Approximate-nearest-neighbour index for cosine similarity. Tune `lists` to
-- roughly sqrt(row_count) as the corpus grows.
CREATE INDEX IF NOT EXISTS idx_embeddings_ivfflat
    ON chunk_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ── ingestion_jobs ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingestion_jobs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id      UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    job_type         VARCHAR(50) DEFAULT 'full',
    status           VARCHAR(50) DEFAULT 'queued',
    celery_task_id   VARCHAR(255),
    attempt_count    INTEGER DEFAULT 0,
    max_attempts     INTEGER DEFAULT 3,
    started_at       TIMESTAMPTZ,
    completed_at     TIMESTAMPTZ,
    error_message    TEXT,
    error_traceback  TEXT,
    progress         JSONB DEFAULT '{}',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_document ON ingestion_jobs (document_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_status ON ingestion_jobs (status);

-- ── conversations ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title            VARCHAR(500),
    summary          TEXT,
    document_ids     UUID[] DEFAULT '{}',
    settings         JSONB DEFAULT '{}',
    message_count    INTEGER DEFAULT 0,
    token_count      INTEGER DEFAULT 0,
    last_message_at  TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_user ON conversations (tenant_id, user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON conversations (last_message_at);

-- ── messages ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id     UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role                VARCHAR(20) NOT NULL,
    content             TEXT NOT NULL,
    citations           JSONB DEFAULT '[]',
    retrieval_metadata  JSONB DEFAULT '{}',
    prompt_tokens       INTEGER,
    completion_tokens   INTEGER,
    total_tokens        INTEGER,
    model_name          VARCHAR(100),
    latency_ms          INTEGER,
    is_summarized       BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_messages_role CHECK (role IN ('user','assistant','system'))
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_tenant_created ON messages (tenant_id, created_at);

-- ── audit_logs (append-only) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL,
    actor_id       UUID,
    actor_type     VARCHAR(50) NOT NULL,
    action         VARCHAR(100) NOT NULL,
    resource_type  VARCHAR(100) NOT NULL,
    resource_id    UUID,
    ip_address     INET,
    user_agent     TEXT,
    request_id     VARCHAR(100),
    metadata       JSONB DEFAULT '{}',
    status         VARCHAR(20) NOT NULL DEFAULT 'success',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);

-- ── webhooks ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhooks (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id          UUID NOT NULL REFERENCES users(id),
    name             VARCHAR(255) NOT NULL,
    url              TEXT NOT NULL,
    secret           VARCHAR(255) NOT NULL,
    events           VARCHAR[] NOT NULL,
    is_active        BOOLEAN DEFAULT TRUE,
    failure_count    INTEGER DEFAULT 0,
    last_success_at  TIMESTAMPTZ,
    last_failure_at  TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_webhooks_tenant ON webhooks (tenant_id) WHERE deleted_at IS NULL;

-- ── seed the built-in system roles ───────────────────────────────────────────
INSERT INTO roles (id, tenant_id, name, display_name, description, is_system)
VALUES
    (gen_random_uuid(), NULL, 'org_admin', 'Organization Admin', 'Full access to tenant resources', TRUE),
    (gen_random_uuid(), NULL, 'member',    'Member',             'Standard user access', TRUE),
    (gen_random_uuid(), NULL, 'viewer',    'Viewer',             'Read-only access', TRUE)
ON CONFLICT DO NOTHING;

COMMIT;
