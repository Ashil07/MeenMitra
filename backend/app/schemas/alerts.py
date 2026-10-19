"""Alert, simulated delivery and acknowledgement schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import Channel, Language, LocalizedText, StrictModel

AlertStatus = Literal["pending", "sent", "failed", "acknowledged"]
AlertSourceType = Literal["forecast", "water_check"]
DeliveryStatus = Literal["simulated_delivered", "simulated_failed"]
AckResponse = Literal["seen", "action_taken", "need_help"]


class DeliveryError(BaseModel):
    code: str
    message: str


class DeliveryAttempt(BaseModel):
    id: str
    channel: Channel
    language: Language
    message: str
    attempt_number: int
    attempted_at: datetime
    status: DeliveryStatus
    provider_mode: Literal["mock"]
    provider_name: str
    recipient_masked: str | None
    error: DeliveryError | None = None
    retry_allowed: bool
    simulated: Literal[True] = True
    external_request_made: Literal[False] = Field(
        False, description="The mock provider never calls an external service or phone network"
    )
    simulated_call_duration_s: int | None = Field(None, description="Voice channel only (simulated)")


class Acknowledgement(BaseModel):
    acknowledged_at: datetime
    response: AckResponse
    channel: Channel | None
    note: str | None


class Alert(BaseModel):
    id: str
    pond_id: str
    pond_name: str
    source_type: AlertSourceType
    source_id: str
    severity: Literal["watch", "danger"]
    title: LocalizedText
    message: LocalizedText
    voice_script: LocalizedText
    status: AlertStatus
    created_at: datetime
    updated_at: datetime
    deliveries: list[DeliveryAttempt]
    acknowledgement: Acknowledgement | None
    template_review_status: Literal["unreviewed_draft"] = Field(
        "unreviewed_draft",
        description="Kannada wording has not been reviewed by a competent speaker; not production-ready",
    )
    is_demo_record: bool = False


class SimulateSendRequest(StrictModel):
    channels: list[Channel] | None = Field(
        None, min_length=1, description="Defaults to the pond's alert_channels"
    )
    language: Language | None = Field(None, description="Defaults to the pond's preferred_language")
    simulate_failure_channels: list[Channel] = Field(
        default_factory=list,
        description="Demo control: force these channels to record a simulated failure",
    )

    @field_validator("channels", "simulate_failure_channels")
    @classmethod
    def _unique(cls, value: list[Channel] | None) -> list[Channel] | None:
        if value is not None and len(set(value)) != len(value):
            raise ValueError("channels must not contain duplicates")
        return value


class AcknowledgeRequest(StrictModel):
    response: AckResponse = "seen"
    channel: Channel | None = None
    note: str | None = Field(None, max_length=500)


class SimulateSendResult(BaseModel):
    alert: Alert
    attempts: list[DeliveryAttempt]
    notice: str
