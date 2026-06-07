"""
Local Storage Client — development file storage using local filesystem.
Implements the same interface as GCS/S3 clients for easy swapping.
"""
from __future__ import annotations

import io
from pathlib import Path
from typing import BinaryIO

import aiofiles  # type: ignore[import-untyped]

from config import settings


class LocalStorageClient:
    """Local filesystem storage for development."""

    def __init__(self) -> None:
        self.base_path = Path(settings.STORAGE_LOCAL_PATH)
        self.base_path.mkdir(parents=True, exist_ok=True)

    async def upload(
        self,
        path: str,
        data: BinaryIO | bytes | io.BytesIO,
        content_type: str = "application/octet-stream",
    ) -> str:
        """Upload file to local path. Returns storage path."""
        full_path = self.base_path / path
        full_path.parent.mkdir(parents=True, exist_ok=True)

        if isinstance(data, (bytes, bytearray)):
            content = data
        elif isinstance(data, io.BytesIO):
            content = data.read()
        else:
            content = data.read()

        async with aiofiles.open(full_path, "wb") as f:
            await f.write(content)

        return path

    async def download(self, path: str) -> bytes:
        """Download file content from local storage."""
        from core.exceptions import StorageError

        full_path = self.base_path / path
        if not full_path.exists():
            raise StorageError(f"Storage object not found: {path}")
        try:
            async with aiofiles.open(full_path, "rb") as f:
                return await f.read()
        except OSError as exc:
            raise StorageError(f"Failed to read storage object: {path}") from exc

    async def delete(self, path: str) -> None:
        """Delete file from local storage (idempotent)."""
        full_path = self.base_path / path
        try:
            if full_path.exists():
                full_path.unlink()
        except OSError:
            # Best-effort delete — surfaced via logs by callers, never fatal.
            pass

    async def exists(self, path: str) -> bool:
        return (self.base_path / path).exists()

    def get_public_url(self, path: str, expires_seconds: int = 3600) -> str:
        """For local dev, return a local file URL (not a signed URL)."""
        return f"/api/v1/files/{path}"
