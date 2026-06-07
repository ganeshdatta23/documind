"""
DocuMind Security — JWT, password hashing, API key utilities.
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from jose import JWTError, jwt
from passlib.context import CryptContext

from config import settings

# Password hashing context (bcrypt with deprecated="auto" for gradual migration)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT token types
ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"


# ─── Password Utilities ───────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """Hash password with bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)


# ─── JWT Utilities ────────────────────────────────────────────────────────────

def create_access_token(
    user_id: UUID,
    tenant_id: UUID,
    email: str,
    roles: list[str],
    is_superadmin: bool = False,
    extra_claims: dict[str, Any] | None = None,
) -> tuple[str, datetime]:
    """
    Create a signed JWT access token.
    Returns (token_string, expiry_datetime).
    """
    now = datetime.now(UTC)
    expires_at = now + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

    claims = {
        "sub": str(user_id),
        "tid": str(tenant_id),         # Tenant ID
        "email": email,
        "roles": roles,
        "is_superadmin": is_superadmin,
        "type": ACCESS_TOKEN_TYPE,
        "iat": now,
        "exp": expires_at,
        "jti": secrets.token_urlsafe(16),  # JWT ID for revocation
    }
    if extra_claims:
        claims.update(extra_claims)

    token = jwt.encode(claims, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return token, expires_at


def create_refresh_token() -> tuple[str, str, datetime]:
    """
    Create a secure random refresh token.
    Returns (raw_token, hashed_token, expiry_datetime).
    """
    raw_token = secrets.token_urlsafe(64)
    hashed = hash_token(raw_token)
    expires_at = datetime.now(UTC) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    return raw_token, hashed, expires_at


def decode_access_token(token: str) -> dict[str, Any]:
    """
    Decode and validate a JWT access token.
    Raises JWTError on invalid/expired token.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        if payload.get("type") != ACCESS_TOKEN_TYPE:
            raise JWTError("Invalid token type")
        return payload
    except JWTError:
        raise


# ─── API Key Utilities ────────────────────────────────────────────────────────

API_KEY_PREFIX = "dm_"
API_KEY_LIVE_PREFIX = "dm_live_"
API_KEY_TEST_PREFIX = "dm_test_"


def generate_api_key(is_live: bool = True) -> tuple[str, str, str]:
    """
    Generate a new API key.
    Returns (full_key, key_prefix, key_hash).

    Format: dm_live_<32_random_chars> or dm_test_<32_random_chars>
    Only key_prefix is shown to user after creation.
    key_hash (SHA-256) is stored in the database.
    """
    prefix = API_KEY_LIVE_PREFIX if is_live else API_KEY_TEST_PREFIX
    random_part = secrets.token_urlsafe(32)
    full_key = f"{prefix}{random_part}"
    key_prefix = full_key[:16]  # Show first 16 chars (e.g., "dm_live_xK3mN2p8")
    key_hash = hash_token(full_key)
    return full_key, key_prefix, key_hash


def hash_token(token: str) -> str:
    """SHA-256 hash a token for secure storage."""
    return hashlib.sha256(token.encode()).hexdigest()


# ─── Webhook Signing ──────────────────────────────────────────────────────────

import hmac  # noqa: E402  (grouped with the webhook-signing helpers)
import json  # noqa: E402


def generate_webhook_secret() -> str:
    """Generate a secure webhook signing secret."""
    return secrets.token_urlsafe(32)


def sign_webhook_payload(payload: dict[str, Any], secret: str) -> str:
    """
    Create HMAC-SHA256 signature for webhook payload.
    Header format: sha256=<hex_digest>
    """
    payload_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    signature = hmac.new(secret.encode(), payload_bytes, hashlib.sha256).hexdigest()
    return f"sha256={signature}"


def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify incoming webhook signature (for external webhook validation)."""
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)
