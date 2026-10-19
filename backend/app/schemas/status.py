"""Dashboard, ML-status, approach and health schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.common import RiskStatus

# ---- health -----------------------------------------------------------------


class Health(BaseModel):
    status: Literal["ok"]
    app_env: str
    database: Literal["ok"]
    alert_provider: str
    weather_provider: str
    external_credentials_required: Literal[False] = False


# ---- ML status --------------------------------------------------------------

DatasetLocalStatus = Literal["missing", "present", "invalid", "not_applicable"]
OverallMlState = Literal["no_runs", "synthetic_only", "trained_on_external_data"]


class DatasetStatus(BaseModel):
    id: str
    title: str
    task: str
    source_url: str
    licence: str
    licence_verified: bool
    access: str
    local_status: DatasetLocalStatus
    local_path: str | None
    files_found: list[str]
    validation: dict[str, Any] | None
    used_in_pipeline: bool
    data_nature: str = Field(..., description="Whether the records were measured, generated, or are unknown")
    notes: list[str]


class ExperimentStatus(BaseModel):
    experiment_id: str
    dataset_id: str
    data_origin: Literal["external", "synthetic"] = Field(
        ..., description="external = downloaded third-party dataset (see its data_nature); synthetic = generated here"
    )
    status: Literal["completed", "failed"]
    trained_at: datetime | None
    task: str
    target: str
    split: str
    n_train: int | None
    n_test: int | None
    model_type: str | None
    metrics: dict[str, Any]
    artifact_available: bool
    warnings: list[str]
    error: str | None = None


class MlStatus(BaseModel):
    overall_state: OverallMlState
    summary: str
    datasets: list[DatasetStatus]
    experiments: list[ExperimentStatus]
    ml_correction_in_forecast: dict[str, Any]
    optional_libraries: dict[str, bool]
    how_to_run: list[str]


# ---- approach ---------------------------------------------------------------

ImplementationStatus = Literal["implemented_demo", "mock", "experimental", "planned", "not_started"]


class ApproachStage(BaseModel):
    id: str
    order: int
    name: str
    purpose: str
    inputs: list[str]
    outputs: list[str]
    implementation_status: ImplementationStatus
    status_detail: str
    limitations: list[str]
    code_reference: str | None
    api_endpoints: list[str]


class Approach(BaseModel):
    title: str
    summary: str
    stages: list[ApproachStage]
    status_legend: dict[str, str]


# ---- dashboard --------------------------------------------------------------


class DashboardPond(BaseModel):
    id: str
    name: str
    village_cluster: str
    district: str
    species: str
    overall_status: RiskStatus | None
    forecast_peak_risk_index: float | None
    forecast_generated_at: datetime | None
    water_status: RiskStatus | None
    open_alert_count: int
    is_demo_record: bool


class DashboardAlert(BaseModel):
    id: str
    pond_id: str
    pond_name: str
    severity: Literal["watch", "danger"]
    status: str
    title_en: str
    created_at: datetime


class DashboardTotals(BaseModel):
    ponds: int
    ponds_by_status: dict[str, int] = Field(
        ..., description="Keys: safe, watch, danger, unknown (no forecast or water check yet)"
    )
    open_alerts: int
    unacknowledged_alerts: int
    simulated_deliveries: int
    farmer_reports_last_7_days: int


class DashboardSummary(BaseModel):
    totals: DashboardTotals
    ponds: list[DashboardPond]
    recent_alerts: list[DashboardAlert]
    cooperative_signals: list[dict[str, Any]]
    ml: dict[str, Any]
    data_notice: str
