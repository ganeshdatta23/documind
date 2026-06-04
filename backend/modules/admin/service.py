"""Admin service — orchestrates platform-level operations via AdminRepository."""
from __future__ import annotations

from modules.admin.repository import AdminRepository


class AdminService:
    def __init__(self, repo: AdminRepository) -> None:
        self.repo = repo

    async def get_platform_stats(self) -> dict:
        return await self.repo.get_platform_stats()
