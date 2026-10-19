"""Provider-independent alert delivery interface.

Real WhatsApp/SMS/voice adapters are future integration points (see docs/ALERTS.md). Only the
offline mock provider is implemented, and it is the default.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Protocol

ChannelName = Literal["whatsapp", "sms", "voice"]


@dataclass(frozen=True)
class DeliveryRequest:
    alert_id: str
    channel: ChannelName
    language: Literal["kn", "en"]
    message: str
    recipient: str | None
    attempt_number: int
    force_failure: bool = False


@dataclass(frozen=True)
class DeliveryOutcome:
    delivered: bool
    provider_name: str
    provider_mode: Literal["mock"]
    error_code: str | None = None
    error_message: str | None = None
    retry_allowed: bool = False
    simulated_call_duration_s: int | None = None
    external_request_made: Literal[False] = False


class AlertProvider(Protocol):
    name: str
    mode: Literal["mock"]

    def send(self, request: DeliveryRequest) -> DeliveryOutcome: ...
