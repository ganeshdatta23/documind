"""
DocuMind Custom Exceptions — Domain error hierarchy.
All exceptions map to specific HTTP status codes for consistent API responses.
"""
from http import HTTPStatus
from typing import Any


class DocuMindError(Exception):
    """Base exception for all DocuMind domain errors."""
    status_code: int = HTTPStatus.INTERNAL_SERVER_ERROR
    error_code: str = "INTERNAL_ERROR"
    message: str = "An unexpected error occurred"

    def __init__(self, message: str | None = None, **context: Any) -> None:
        self.message = message or self.__class__.message
        self.context = context
        super().__init__(self.message)


# ─── 400 Bad Request ──────────────────────────────────────────────────────────

class ValidationError(DocuMindError):
    status_code = HTTPStatus.BAD_REQUEST
    error_code = "VALIDATION_ERROR"
    message = "Invalid request data"


class InvalidFileTypeError(DocuMindError):
    status_code = HTTPStatus.BAD_REQUEST
    error_code = "INVALID_FILE_TYPE"
    message = "File type is not supported"


class InvalidFileContentError(DocuMindError):
    status_code = HTTPStatus.BAD_REQUEST
    error_code = "INVALID_FILE_CONTENT"
    message = "File content does not match declared type"


# ─── 401 Unauthorized ────────────────────────────────────────────────────────

class AuthenticationError(DocuMindError):
    status_code = HTTPStatus.UNAUTHORIZED
    error_code = "AUTHENTICATION_FAILED"
    message = "Authentication failed"


class InvalidTokenError(DocuMindError):
    status_code = HTTPStatus.UNAUTHORIZED
    error_code = "INVALID_TOKEN"
    message = "Token is invalid or expired"


class TokenRevokedError(DocuMindError):
    status_code = HTTPStatus.UNAUTHORIZED
    error_code = "TOKEN_REVOKED"
    message = "Token has been revoked"


# ─── 403 Forbidden ───────────────────────────────────────────────────────────

class PermissionDeniedError(DocuMindError):
    status_code = HTTPStatus.FORBIDDEN
    error_code = "PERMISSION_DENIED"
    message = "You do not have permission to perform this action"


class TenantIsolationError(DocuMindError):
    status_code = HTTPStatus.FORBIDDEN
    error_code = "TENANT_ISOLATION_VIOLATION"
    message = "Access denied: cross-tenant access is not allowed"


class AccountLockedError(DocuMindError):
    status_code = HTTPStatus.FORBIDDEN
    error_code = "ACCOUNT_LOCKED"
    message = "Account is temporarily locked due to failed login attempts"


# ─── 404 Not Found ───────────────────────────────────────────────────────────

class NotFoundError(DocuMindError):
    status_code = HTTPStatus.NOT_FOUND
    error_code = "NOT_FOUND"
    message = "Resource not found"


class DocumentNotFoundError(NotFoundError):
    error_code = "DOCUMENT_NOT_FOUND"
    message = "Document not found"


class ConversationNotFoundError(NotFoundError):
    error_code = "CONVERSATION_NOT_FOUND"
    message = "Conversation not found"


class UserNotFoundError(NotFoundError):
    error_code = "USER_NOT_FOUND"
    message = "User not found"


class TenantNotFoundError(NotFoundError):
    error_code = "TENANT_NOT_FOUND"
    message = "Tenant not found"


# ─── 409 Conflict ────────────────────────────────────────────────────────────

class ConflictError(DocuMindError):
    status_code = HTTPStatus.CONFLICT
    error_code = "CONFLICT"
    message = "Resource already exists"


class EmailAlreadyExistsError(ConflictError):
    error_code = "EMAIL_ALREADY_EXISTS"
    message = "A user with this email already exists"


# ─── 422 Unprocessable ───────────────────────────────────────────────────────

class DocumentProcessingError(DocuMindError):
    status_code = HTTPStatus.UNPROCESSABLE_ENTITY
    error_code = "DOCUMENT_PROCESSING_ERROR"
    message = "Failed to process document"


# ─── 429 Too Many Requests ───────────────────────────────────────────────────

class RateLimitExceededError(DocuMindError):
    status_code = HTTPStatus.TOO_MANY_REQUESTS
    error_code = "RATE_LIMIT_EXCEEDED"
    message = "Rate limit exceeded. Please try again later"


class QuotaExceededError(DocuMindError):
    status_code = HTTPStatus.TOO_MANY_REQUESTS
    error_code = "QUOTA_EXCEEDED"
    message = "Tenant quota exceeded"


class StorageQuotaExceededError(QuotaExceededError):
    error_code = "STORAGE_QUOTA_EXCEEDED"
    message = "Storage quota exceeded"


# ─── 500 Internal Server Error ───────────────────────────────────────────────

class ExternalServiceError(DocuMindError):
    status_code = HTTPStatus.INTERNAL_SERVER_ERROR
    error_code = "EXTERNAL_SERVICE_ERROR"
    message = "External service error"


class EmbeddingError(ExternalServiceError):
    error_code = "EMBEDDING_GENERATION_ERROR"
    message = "Failed to generate embeddings"


class LLMError(ExternalServiceError):
    error_code = "LLM_ERROR"
    message = "Failed to generate AI response"


class StorageError(ExternalServiceError):
    error_code = "STORAGE_ERROR"
    message = "Storage operation failed"
