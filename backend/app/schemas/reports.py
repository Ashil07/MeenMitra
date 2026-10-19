"""Farmer observation reports and cooperative (cluster-level) monitoring schemas."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.common import RiskStatus, StrictModel
from app.schemas.water import Symptom


class FarmerReportCreate(StrictModel):
    pond_id: str = Field(..., min_length=1)
    symptoms: list[Symptom] = Field(default_factory=list)
    mortality_count: int | None = Field(None, ge=0, le=1_000_000)
    note: str | None = Field(None, max_length=500)
    observed_at: datetime

    @field_validator("observed_at")
    @classmethod
    def _aware_not_future(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("observed_at must include a timezone offset")
        if value > datetime.now(timezone.utc):
            raise ValueError("observed_at cannot be in the future")
        return value

    @field_validator("symptoms")
    @classmethod
    def _unique(cls, value: list[Symptom]) -> list[Symptom]:
        if len(set(value)) != len(value):
            raise ValueError("symptoms must not contain duplicates")
        return value

    @model_validator(mode="after")
    def _non_empty(self) -> "FarmerReportCreate":
        if not self.symptoms and not self.mortality_count and not self.note:
            raise ValueError("provide at least one symptom, a mortality count or a note")
        return self


class FarmerReport(BaseModel):
    id: str
    pond_id: str
    district: str
    village_cluster: str
    symptoms: list[Symptom]
    mortality_count: int | None
    note: str | None
    observed_at: datetime
    created_at: datetime
    is_demo_record: bool


class ClusterSignal(BaseModel):
    level: Literal["none", "watch", "investigate"]
    explanation: str
    rule: str


class ClusterSummary(BaseModel):
    cluster_id: str
    village_cluster: str
    district: str
    pond_count: int
    ponds_by_status: dict[str, int]
    reports_in_window: int
    ponds_reporting: int
    symptom_counts: dict[str, int]
    mortality_reported: int
    signal: ClusterSignal


class CooperativeSummary(BaseModel):
    window_days: int
    window_start: datetime
    clusters: list[ClusterSummary]
    privacy_note: str
    method_note: str
