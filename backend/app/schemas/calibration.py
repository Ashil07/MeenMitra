"""Farmer feedback and per-pond calibration schemas."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import RiskStatus, StrictModel

Observation = Literal[
    "no_stress_seen",
    "fish_gasping_at_dawn",
    "fish_mortality_overnight",
    "not_checked",
]


class FeedbackRequest(StrictModel):
    forecast_id: str = Field(..., min_length=1)
    observation: Observation
    observed_at: datetime
    aerator_used: bool = Field(
        False, description="Aerators ran overnight; the outcome then says little about natural demand"
    )
    note: str | None = Field(None, max_length=500)

    @field_validator("observed_at")
    @classmethod
    def _aware_not_future(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("observed_at must include a timezone offset")
        if value > datetime.now(timezone.utc):
            raise ValueError("observed_at cannot be in the future")
        return value


class CalibrationEvent(BaseModel):
    id: str
    pond_id: str
    forecast_id: str
    forecast_status: RiskStatus
    forecast_peak_risk_index: float
    observation: Observation
    observed_at: datetime
    aerator_used: bool
    note: str | None
    created_at: datetime
    previous_demand_multiplier: float
    updated_demand_multiplier: float
    delta: float
    rule_applied: str
    explanation: str


class CalibrationState(BaseModel):
    pond_id: str
    demand_multiplier: float
    min_multiplier: float
    max_multiplier: float
    feedback_count: int
    updated_at: datetime | None
    method: str
    limitations: str


class FeedbackResult(BaseModel):
    event: CalibrationEvent
    calibration: CalibrationState


class CalibrationHistory(BaseModel):
    calibration: CalibrationState
    events: list[CalibrationEvent]
