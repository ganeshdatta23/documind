"""
DocuMind Configuration — Pydantic Settings v2
All configuration is loaded from environment variables with .env.local fallback.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ─── Application ──────────────────────────────────────────────────────────
    APP_NAME: str = "DocuMind"
    APP_ENV: Literal["development", "testing", "production"] = "development"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production-min-32-chars!!"
    ALLOWED_HOSTS: list[str] = ["*"]
    API_PREFIX: str = "/api/v1"

    # ─── Database ─────────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://documind:documind_dev@localhost:5432/documind"
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30
    DB_ECHO: bool = False

    # ─── Redis ────────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_MAX_CONNECTIONS: int = 50

    # ─── Celery ───────────────────────────────────────────────────────────────
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"
    CELERY_TASK_SERIALIZER: str = "json"
    CELERY_RESULT_SERIALIZER: str = "json"
    CELERY_MAX_RETRIES: int = 3

    # ─── JWT Authentication ───────────────────────────────────────────────────
    JWT_SECRET_KEY: str = "change-me-jwt-secret-min-32-chars-!!!"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ─── Storage ──────────────────────────────────────────────────────────────
    STORAGE_BACKEND: Literal["local", "gcs", "s3"] = "local"
    STORAGE_BUCKET: str = "documind-dev"
    STORAGE_LOCAL_PATH: str = "./uploads"
    GCS_PROJECT_ID: str = ""
    GCS_CREDENTIALS_PATH: str = ""
    AWS_REGION: str = "us-east-1"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""

    # ─── AI / OpenAI ─────────────────────────────────────────────────────────
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    OPENAI_CHAT_MODEL: str = "gpt-4o-mini"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIMENSIONS: int = 1536
    EMBEDDING_BATCH_SIZE: int = 100
    LLM_TEMPERATURE: float = 0.1
    LLM_MAX_TOKENS: int = 2048
    LLM_TIMEOUT_SECONDS: int = 60

    # ─── RAG Configuration ───────────────────────────────────────────────────
    CHUNK_SIZE: int = 512             # tokens
    CHUNK_OVERLAP: int = 64           # tokens
    VECTOR_SEARCH_TOP_K: int = 20
    BM25_SEARCH_TOP_K: int = 20
    RRF_K: int = 60
    HYBRID_FUSION_TOP_K: int = 10
    RERANK_TOP_K: int = 5
    RERANKER_BACKEND: Literal["passthrough", "cohere", "local"] = "passthrough"
    COHERE_API_KEY: str = ""

    # ─── Conversation Memory / Summarization ──────────────────────────────────
    # When a conversation accumulates more than THRESHOLD un-summarized messages,
    # the oldest are rolled into a running summary, keeping KEEP_RECENT verbatim.
    CONVERSATION_SUMMARY_THRESHOLD: int = 20
    CONVERSATION_SUMMARY_KEEP_RECENT: int = 6

    # ─── Maintenance / Retention ───────────────────────────────────────────────
    SOFT_DELETE_RETENTION_DAYS: int = 30   # hard-delete soft-deleted rows after N days

    # ─── Webhooks ───────────────────────────────────────────────────────────────
    WEBHOOK_TIMEOUT_SECONDS: int = 10
    WEBHOOK_MAX_RETRIES: int = 5
    WEBHOOK_DISABLE_AFTER_FAILURES: int = 20   # auto-disable an endpoint after N consecutive failures

    # ─── Rate Limiting ────────────────────────────────────────────────────────
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_DEFAULT_REQUESTS: int = 100
    RATE_LIMIT_DEFAULT_WINDOW_SECONDS: int = 60
    RATE_LIMIT_EXEMPT_PATHS: list[str] = ["/health", "/health/detailed"]

    # ─── File Upload ──────────────────────────────────────────────────────────
    MAX_FILE_SIZE_BYTES: int = 50 * 1024 * 1024   # 50MB
    ALLOWED_MIME_TYPES: list[str] = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
        "text/html",
        "text/markdown",
    ]

    # ─── Observability ────────────────────────────────────────────────────────
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: Literal["json", "console"] = "json"
    OTEL_ENABLED: bool = False
    OTEL_EXPORTER_ENDPOINT: str = ""
    OTEL_SERVICE_NAME: str = "documind-api"

    # ─── CORS ─────────────────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    CORS_ALLOW_CREDENTIALS: bool = True

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        if not v.startswith(("postgresql+asyncpg://", "sqlite+aiosqlite://")):
            raise ValueError("DATABASE_URL must use asyncpg or aiosqlite driver")
        return v

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def is_development(self) -> bool:
        return self.APP_ENV == "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
