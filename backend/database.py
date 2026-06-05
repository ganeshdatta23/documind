"""
DocuMind Database — Async SQLAlchemy 2.x engine and session factory.
Uses asyncpg driver for PostgreSQL.
"""
from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, MappedColumn
from sqlalchemy.pool import NullPool

from config import settings


class Base(DeclarativeBase):
    """SQLAlchemy declarative base for all models."""
    pass


def create_engine(database_url: str | None = None, **kwargs: Any) -> AsyncEngine:
    """
    Create async SQLAlchemy engine.
    Uses NullPool for testing to avoid connection issues.
    """
    url = database_url or settings.DATABASE_URL
    pool_kwargs: dict[str, Any] = {}

    if settings.APP_ENV == "testing":
        pool_kwargs["poolclass"] = NullPool
    else:
        pool_kwargs.update({
            "pool_size": settings.DB_POOL_SIZE,
            "max_overflow": settings.DB_MAX_OVERFLOW,
            "pool_timeout": settings.DB_POOL_TIMEOUT,
            "pool_pre_ping": True,
        })

    # Managed Postgres providers require TLS; asyncpg takes ssl via connect_args.
    connect_args = kwargs.pop("connect_args", {})
    if settings.DB_SSL:
        connect_args.setdefault("ssl", "require")

    return create_async_engine(
        url,
        echo=settings.DB_ECHO,
        connect_args=connect_args,
        **pool_kwargs,
        **kwargs,
    )


# Global engine and session factory
engine: AsyncEngine = create_engine()

async_session_factory: async_sessionmaker[AsyncSession] = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that provides a database session.
    Session is automatically committed on success or rolled back on exception.
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Initialize database (create tables). Used in tests and dev setup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    """Close database connection pool. Called on application shutdown."""
    await engine.dispose()
