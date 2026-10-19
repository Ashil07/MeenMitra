"""Domain errors raised by services and mapped to the JSON error envelope by app.api.errors."""

from __future__ import annotations

from typing import Any


class DomainError(Exception):
    status_code = 400
    code = "bad_request"

    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details


class NotFoundError(DomainError):
    status_code = 404
    code = "not_found"


class ConflictError(DomainError):
    status_code = 409
    code = "conflict"


class InvalidInputError(DomainError):
    status_code = 422
    code = "invalid_input"


class FeatureDisabledError(DomainError):
    status_code = 403
    code = "feature_disabled"
