"""Shared response envelope and enum types used across the API."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")

RiskStatus = Literal["safe", "watch", "danger"]
Language = Literal["kn", "en"]
Channel = Literal["whatsapp", "sms", "voice"]


class StrictModel(BaseModel):
    """Request models reject unknown fields so typos surface as validation errors."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Meta(BaseModel):
    generated_at: datetime
    demo_mode: bool = Field(
        True, description="Always true in this MVP: data is synthetic or user-entered demo data."
    )
    api_version: str = "v1"


class Pagination(BaseModel):
    total: int
    limit: int
    offset: int


class ListMeta(Meta):
    pagination: Pagination


class Envelope(BaseModel, Generic[T]):
    data: T
    meta: Meta


class ListEnvelope(BaseModel, Generic[T]):
    data: list[T]
    meta: ListMeta


class ErrorDetail(BaseModel):
    code: str = Field(..., examples=["validation_error", "not_found", "conflict"])
    message: str
    details: list[dict[str, Any]] | dict[str, Any] | None = None


class ErrorEnvelope(BaseModel):
    error: ErrorDetail


class LocalizedText(BaseModel):
    en: str
    kn: str
