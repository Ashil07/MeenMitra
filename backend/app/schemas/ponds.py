"""Pond registration, update and response schemas."""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, Field, model_validator

from app.schemas.common import Channel, Language, RiskStatus, StrictModel
from app.utils import IST

Species = Literal[
    "indian_major_carp_polyculture",
    "tilapia",
    "pangasius",
    "pacific_white_shrimp",
    "other",
]
WaterType = Literal["freshwater", "brackish"]
District = Literal["Udupi", "Dakshina Kannada", "Uttara Kannada", "Other"]

PHONE_PATTERN = r"^\+91\d{10}$"


def _check_channels(channels: list[Channel]) -> list[Channel]:
    if len(set(channels)) != len(channels):
        raise ValueError("alert_channels must not contain duplicates")
    return channels


def _check_stocking_date(value: date) -> date:
    if value > datetime.now(IST).date():
        raise ValueError("stocking_date cannot be in the future")
    return value


def _default_channels() -> list[Channel]:
    return ["whatsapp", "sms"]


ChannelList = Annotated[list[Channel], AfterValidator(_check_channels)]
StockingDate = Annotated[date, AfterValidator(_check_stocking_date)]


class PondBase(StrictModel):
    name: str = Field(..., min_length=1, max_length=80, examples=["North Pond"])
    farmer_name: str = Field(..., min_length=1, max_length=80)
    contact_phone: str | None = Field(
        None,
        pattern=PHONE_PATTERN,
        description="E.164 Indian number, e.g. +919800000000. Stored locally, masked in responses. "
        "The mock provider never contacts it.",
    )
    district: District
    village_cluster: str = Field(..., min_length=1, max_length=80)
    area_m2: float = Field(..., ge=50, le=200_000, description="Water surface area in square metres")
    depth_m: float = Field(..., ge=0.3, le=5, description="Average water depth in metres")
    species: Species
    water_type: WaterType = "freshwater"
    stocking_date: StockingDate | None = None
    stocked_count: int | None = Field(None, ge=0, le=5_000_000)
    estimated_biomass_kg: float | None = Field(
        None, ge=0, le=200_000, description="Farmer's estimate of standing fish/shrimp biomass"
    )
    has_aerator: bool = False
    aerator_count: int = Field(0, ge=0, le=100)
    preferred_language: Language = "kn"
    alert_channels: ChannelList = Field(default_factory=_default_channels, min_length=1)


class PondCreate(PondBase):
    @model_validator(mode="after")
    def _aerators_consistent(self) -> "PondCreate":
        if self.has_aerator and self.aerator_count == 0:
            self.aerator_count = 1
        if not self.has_aerator and self.aerator_count > 0:
            raise ValueError("aerator_count must be 0 when has_aerator is false")
        return self


class PondUpdate(StrictModel):
    name: str | None = Field(None, min_length=1, max_length=80)
    farmer_name: str | None = Field(None, min_length=1, max_length=80)
    contact_phone: str | None = Field(None, pattern=PHONE_PATTERN)
    district: District | None = None
    village_cluster: str | None = Field(None, min_length=1, max_length=80)
    area_m2: float | None = Field(None, ge=50, le=200_000)
    depth_m: float | None = Field(None, ge=0.3, le=5)
    species: Species | None = None
    water_type: WaterType | None = None
    stocking_date: StockingDate | None = None
    stocked_count: int | None = Field(None, ge=0, le=5_000_000)
    estimated_biomass_kg: float | None = Field(None, ge=0, le=200_000)
    has_aerator: bool | None = None
    aerator_count: int | None = Field(None, ge=0, le=100)
    preferred_language: Language | None = None
    alert_channels: ChannelList | None = Field(None, min_length=1)


class PondLatestStatus(BaseModel):
    forecast_status: RiskStatus | None = None
    forecast_id: str | None = None
    forecast_generated_at: datetime | None = None
    forecast_peak_risk_index: float | None = None
    water_status: RiskStatus | None = None
    water_check_id: str | None = None
    water_checked_at: datetime | None = None
    overall_status: RiskStatus | None = Field(
        None, description="Worse of the latest forecast and latest water-check status"
    )


class PondCalibrationSummary(BaseModel):
    demand_multiplier: float
    feedback_count: int


class Pond(BaseModel):
    id: str
    name: str
    farmer_name: str
    contact_phone_masked: str | None
    district: District
    village_cluster: str
    area_m2: float
    depth_m: float
    species: Species
    water_type: WaterType
    stocking_date: date | None
    stocked_count: int | None
    estimated_biomass_kg: float | None
    has_aerator: bool
    aerator_count: int
    preferred_language: Language
    alert_channels: list[Channel]
    is_demo_record: bool = Field(..., description="True for seeded synthetic ponds")
    created_at: datetime
    updated_at: datetime
    latest_status: PondLatestStatus
    calibration: PondCalibrationSummary
