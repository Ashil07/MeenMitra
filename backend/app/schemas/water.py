"""Water-quality and symptom check schemas."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.common import RiskStatus, StrictModel

Symptom = Literal[
    "gasping_at_surface",
    "reduced_feeding",
    "lethargy",
    "erratic_swimming",
    "red_patches_or_lesions",
    "white_spots",
    "fin_or_tail_rot",
    "cotton_like_growth",
    "bloated_abdomen",
    "abnormal_mortality",
]

MEASUREMENT_FIELDS = (
    "ph",
    "water_temp_c",
    "total_ammonia_mg_l",
    "nitrite_mg_l",
    "dissolved_oxygen_mg_l",
)


class WaterCheckRequest(StrictModel):
    ph: float | None = Field(None, ge=0, le=14, description="pH (unitless)")
    water_temp_c: float | None = Field(None, ge=5, le=45, description="Water temperature, °C")
    total_ammonia_mg_l: float | None = Field(
        None, ge=0, le=50, description="Total ammonia nitrogen (TAN), mg/L as N, from a test kit"
    )
    nitrite_mg_l: float | None = Field(None, ge=0, le=50, description="Nitrite, mg/L as NO2-N")
    dissolved_oxygen_mg_l: float | None = Field(None, ge=0, le=25, description="Dissolved oxygen, mg/L")
    symptoms: list[Symptom] = Field(default_factory=list)
    observed_at: datetime | None = Field(None, description="When the sample/observation was taken (defaults to now)")
    note: str | None = Field(None, max_length=500)
    create_alert: bool = True

    @field_validator("symptoms")
    @classmethod
    def _unique_symptoms(cls, value: list[Symptom]) -> list[Symptom]:
        if len(set(value)) != len(value):
            raise ValueError("symptoms must not contain duplicates")
        return value

    @field_validator("observed_at")
    @classmethod
    def _not_future(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("observed_at must include a timezone offset")
        if value > datetime.now(timezone.utc):
            raise ValueError("observed_at cannot be in the future")
        return value

    @model_validator(mode="after")
    def _something_provided(self) -> "WaterCheckRequest":
        if not self.symptoms and all(getattr(self, f) is None for f in MEASUREMENT_FIELDS):
            raise ValueError("provide at least one measurement or one observed symptom")
        return self


class RuleResult(BaseModel):
    rule_id: str
    parameter: str
    observed_value: float | str | None
    unit: str | None
    status: RiskStatus
    threshold_description: str
    explanation: str
    source: str


class ThresholdProfileInfo(BaseModel):
    id: str
    label: str
    status: Literal["demonstration_settings"]
    validated: bool
    applies_to: str
    notes: str


class WaterCheck(BaseModel):
    id: str
    pond_id: str
    created_at: datetime
    observed_at: datetime
    inputs: dict[str, object]
    derived: dict[str, float | None]
    overall_status: RiskStatus
    triggered_rules: list[RuleResult]
    evaluated_rules: list[RuleResult]
    missing_parameters: list[str]
    next_steps: list[str]
    referral: str
    threshold_profile: ThresholdProfileInfo
    alert_id: str | None = None
    is_demo_record: bool = False
    disclaimer: str
