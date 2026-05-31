"""
Auth queries — refresh token management and login tracking.
"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import Select, select, update

from models import RefreshToken
from queries import utc_now


# ─── Refresh tokens ──────────────────────────────────────────────────────────

def select_refresh_token_by_hash(token_hash: str) -> Select:
    """Look up a refresh token by its SHA-256 hash."""
    return select(RefreshToken).where(RefreshToken.token_hash == token_hash)


def revoke_refresh_token(token_id: UUID):
    """Mark a refresh token as revoked."""
    return (
        update(RefreshToken)
        .where(RefreshToken.id == token_id)
        .values(revoked_at=utc_now())
    )
