"""Offline mock alert provider.

It performs NO network I/O and never contacts a phone number: it only decides a simulated outcome
deterministically from the request. There are no imports of HTTP or telephony libraries here.
"""

from __future__ import annotations

import math
from typing import Literal

from app.providers.base import DeliveryOutcome, DeliveryRequest

MAX_ATTEMPTS_PER_CHANNEL = 3


class MockAlertProvider:
    name: str = "mock-offline"
    mode: Literal["mock"] = "mock"

    def __init__(self) -> None:
        self.sent: list[DeliveryRequest] = []  # in-memory log, handy for tests and debugging

    def send(self, request: DeliveryRequest) -> DeliveryOutcome:
        self.sent.append(request)
        retry_allowed = request.attempt_number < MAX_ATTEMPTS_PER_CHANNEL
        if request.recipient is None:
            return DeliveryOutcome(
                delivered=False,
                provider_name=self.name,
                provider_mode="mock",
                error_code="no_recipient",
                error_message="Pond has no contact phone on record; nothing to simulate delivery to.",
                retry_allowed=False,
            )
        if request.force_failure:
            return DeliveryOutcome(
                delivered=False,
                provider_name=self.name,
                provider_mode="mock",
                error_code="simulated_failure",
                error_message=f"Demo-requested failure on the {request.channel} channel (no real network involved).",
                retry_allowed=retry_allowed,
            )
        duration = None
        if request.channel == "voice":
            # ~12 characters per second of synthesised speech, a rough demo figure.
            duration = int(math.ceil(len(request.message) / 12))
        return DeliveryOutcome(
            delivered=True,
            provider_name=self.name,
            provider_mode="mock",
            simulated_call_duration_s=duration,
        )
