"""Dashboard, ML status, approach, forecasts by id, reports, cooperative and system routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import Page, envelope, get_ctx, list_envelope
from app.context import AppContext
from app.errors import FeatureDisabledError
from app.schemas.common import Envelope, ErrorEnvelope, ListEnvelope
from app.schemas.forecast import Forecast, ScenarioPreset
from app.schemas.reports import CooperativeSummary, FarmerReport, FarmerReportCreate
from app.schemas.status import Approach, DashboardSummary, Health, MlStatus
from app.services import forecasts, insights, reports
from app.services.weather import SCENARIOS
from app.storage import seed

router = APIRouter()
health_router = APIRouter(tags=["system"])


@health_router.get("/health", response_model=Health, summary="Liveness and configuration check")
def health(ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    ctx.db.count("ponds")  # raises (→ 500) if the database is unusable
    return {"status": "ok", "app_env": ctx.settings.app_env, "database": "ok",
            "alert_provider": f"{ctx.alert_provider.name} ({ctx.alert_provider.mode})",
            "weather_provider": ctx.settings.weather_provider, "external_credentials_required": False}


@router.get("/dashboard/summary", response_model=Envelope[DashboardSummary], tags=["dashboard"])
def dashboard(ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    return envelope(ctx, insights.dashboard(ctx))


@router.get("/ml/status", response_model=Envelope[MlStatus], tags=["ml"],
            summary="Real dataset availability and experiment results read from disk")
def ml_status(ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    return envelope(ctx, insights.ml_status(ctx))


@router.get("/approach", response_model=Envelope[Approach], tags=["approach"],
            summary="Pipeline stages with their actual implementation status")
def approach(ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    return envelope(ctx, insights.approach(ctx))


@router.get("/forecasts/{forecast_id}", response_model=Envelope[Forecast], tags=["forecasts"],
            responses={404: {"model": ErrorEnvelope}})
def get_forecast(forecast_id: str, ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    return envelope(ctx, forecasts.get_forecast(ctx, forecast_id))


@router.get("/weather/scenarios", response_model=Envelope[list[ScenarioPreset]], tags=["forecasts"],
            summary="Synthetic weather scenario presets for the forecast explorer")
def weather_scenarios(ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    data = [{"name": name, "label": s["label"], "description": s["description"], "weather": s["weather"],
             "synthetic": True} for name, s in SCENARIOS.items()]
    return envelope(ctx, data)


@router.get("/reports", response_model=ListEnvelope[FarmerReport], tags=["reports"])
def list_reports(pond_id: str | None = Query(None), page: Page = Depends(),
                 ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    return list_envelope(ctx, reports.list_reports(ctx, pond_id), page)


@router.post("/reports", response_model=Envelope[FarmerReport], status_code=status.HTTP_201_CREATED,
             tags=["reports"], responses={404: {"model": ErrorEnvelope}, 422: {"model": ErrorEnvelope}})
def create_report(payload: FarmerReportCreate, ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    return envelope(ctx, reports.create_report(ctx, payload))


@router.get("/cooperative/summary", response_model=Envelope[CooperativeSummary], tags=["reports"],
            summary="Cluster-level, anonymised report aggregation with a demo follow-up signal")
def cooperative(window_days: int = Query(7, ge=1, le=60), ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    return envelope(ctx, reports.cooperative_summary(ctx, window_days))


@router.post("/demo/reset", tags=["system"], responses={403: {"model": ErrorEnvelope}},
             summary="Wipe and re-seed the local demo database (requires ALLOW_DEMO_RESET=true)")
def demo_reset(ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    if not ctx.settings.allow_demo_reset:
        raise FeatureDisabledError("Demo reset is disabled. Set ALLOW_DEMO_RESET=true for local demos, "
                                   "or run `python -m app.storage.seed --reset`.")
    return envelope(ctx, {"reset": True, "counts": seed.reset(ctx)})
