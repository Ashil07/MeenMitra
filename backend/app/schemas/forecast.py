"""Demo oxygen-risk forecast request/response schemas.

The forecast output is a RELATIVE RISK INDEX (0-100), not a dissolved-oxygen concentration.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import RiskStatus, StrictModel

ScenarioName = Literal[
    "clear_calm_night",
    "overcast_still_night",
    "monsoon_heavy_rain",
    "windy_clear_night",
    "hot_humid_still",
]
FeedingPlan = Literal["normal", "reduced", "skipped"]
WeatherSource = Literal["scenario_preset", "scenario_with_overrides", "open_meteo", "demo_fallback"]


class WeatherInput(StrictModel):
    """Evening-to-morning weather summary. Any omitted field is taken from the scenario preset."""

    air_temp_evening_c: float | None = Field(None, ge=10, le=45, description="Air temperature at window start, °C")
    air_temp_min_c: float | None = Field(None, ge=5, le=40, description="Overnight minimum air temperature, °C")
    cloud_cover_pct: float | None = Field(None, ge=0, le=100, description="Mean daytime cloud cover, %")
    sunshine_hours_today: float | None = Field(None, ge=0, le=13, description="Bright sunshine hours during the preceding day")
    wind_speed_ms: float | None = Field(None, ge=0, le=30, description="Mean overnight wind speed at 10 m, m/s")
    rainfall_mm: float | None = Field(None, ge=0, le=400, description="Rain expected during the forecast window, mm")

    @model_validator(mode="after")
    def _min_not_above_evening(self) -> "WeatherInput":
        if (
            self.air_temp_evening_c is not None
            and self.air_temp_min_c is not None
            and self.air_temp_min_c > self.air_temp_evening_c
        ):
            raise ValueError("air_temp_min_c cannot exceed air_temp_evening_c")
        return self


class ForecastWaterInput(StrictModel):
    """Optional evening observations entered by the farmer (treated as observed inputs)."""

    water_temp_c: float | None = Field(None, ge=10, le=40, description="Evening water temperature, °C")
    dissolved_oxygen_mg_l: float | None = Field(
        None, ge=0, le=25, description="Evening dissolved oxygen measured with a meter or kit, mg/L"
    )


class ForecastRequest(StrictModel):
    forecast_date: date | None = Field(
        None, description="Evening on which the window starts (IST). Defaults to today in IST."
    )
    start_hour: int = Field(18, ge=16, le=21, description="Local hour (IST) at which the window starts")
    end_hour: int = Field(6, ge=4, le=8, description="Local hour (IST) next morning at which the window ends")
    scenario: ScenarioName = "clear_calm_night"
    weather: WeatherInput | None = None
    water: ForecastWaterInput | None = None
    aerator_planned: bool | None = Field(
        None, description="Whether aerators will run overnight. Defaults to the pond's has_aerator value."
    )
    feeding_plan: FeedingPlan = "normal"
    use_live_weather: bool = Field(
        False,
        description="Try Open-Meteo when WEATHER_PROVIDER=open_meteo; falls back to the scenario on failure.",
    )
    create_alert: bool = Field(True, description="Create a pending alert when the result is watch or danger")


class ForecastPoint(BaseModel):
    hour_index: int
    timestamp: datetime = Field(..., description="Local IST timestamp (+05:30)")
    local_time: str
    risk_index: float = Field(..., ge=0, le=100, description="Relative demo oxygen-risk index, 0-100")
    status: RiskStatus
    value_type: Literal["synthetic_model_output"] = "synthetic_model_output"


class ForecastFactor(BaseModel):
    key: str
    label: str
    input_value: float | bool | str | None
    unit: str | None
    reference_value: float | bool | str | None
    effect: Literal["increases_risk", "decreases_risk", "neutral"]
    contribution_points: float = Field(
        ...,
        description="Change in the window-average risk index versus the reference value, "
        "with all other inputs unchanged (one-at-a-time sensitivity)",
    )
    value_source: Literal["observed", "pond_profile", "scenario_preset", "user_override", "open_meteo", "default_assumption"]
    explanation: str


class ActionSuggestion(BaseModel):
    id: str
    priority: Literal["high", "medium", "low"]
    text: str
    limitation: str


class ForecastSummary(BaseModel):
    peak_risk_index: float
    mean_risk_index: float
    peak_risk_time: datetime = Field(
        ..., description="Hour with the highest simulated relative risk — not a predicted oxygen-crash time"
    )
    overall_status: RiskStatus
    hours_watch: int
    hours_danger: int
    headline: str


class MlCorrectionInfo(BaseModel):
    applied: bool
    reason: str


class ForecastProvenance(BaseModel):
    simulation: Literal[True] = True
    output_type: Literal["relative_risk_index"] = "relative_risk_index"
    model_mode: Literal["demo_physics_inspired"] = "demo_physics_inspired"
    implementation_status: Literal["demo"] = "demo"
    engine_version: str
    calibrated_to_measured_do: Literal[False] = False
    ml_correction: MlCorrectionInfo
    weather_source: WeatherSource
    weather_fallback_reason: str | None = None
    inputs_hash: str = Field(..., description="SHA-256 of the resolved inputs; equal inputs give equal outputs")
    assumptions: list[str]
    classification_thresholds: dict[str, float]


class Forecast(BaseModel):
    id: str
    pond_id: str
    generated_at: datetime
    forecast_date: date
    window_start: datetime
    window_end: datetime
    timezone: str = "Asia/Kolkata (UTC+05:30)"
    hourly: list[ForecastPoint]
    summary: ForecastSummary
    factors: list[ForecastFactor]
    actions: list[ActionSuggestion]
    missing_data: list[str]
    resolved_inputs: dict[str, object]
    calibration_applied: dict[str, float]
    provenance: ForecastProvenance
    alert_id: str | None = None
    is_demo_record: bool = False
    disclaimer: str


class ScenarioPreset(BaseModel):
    name: ScenarioName
    label: str
    description: str
    weather: dict[str, float]
    synthetic: Literal[True] = True
