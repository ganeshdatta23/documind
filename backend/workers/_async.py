"""
Shared helper for running async coroutines inside synchronous Celery tasks.

Celery workers run synchronously, but our data/AI layers are async. Each task
gets its own fresh event loop so there is no cross-task loop reuse (which can
leave asyncpg connections bound to a closed loop).
"""
from __future__ import annotations

import asyncio
from collections.abc import Coroutine
from typing import Any, TypeVar

T = TypeVar("T")


def run_async(coro: Coroutine[Any, Any, T]) -> T:
    """Run a coroutine to completion on a dedicated event loop."""
    loop = asyncio.new_event_loop()
    try:
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(coro)
    finally:
        try:
            loop.run_until_complete(loop.shutdown_asyncgens())
        finally:
            asyncio.set_event_loop(None)
            loop.close()
