"""Pond management, forecasts, water checks and per-pond feedback/calibration routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, status

from app.api.deps import Page, envelope, get_ctx, list_envelope
from app.context import AppContext
from app.schemas.calibration import CalibrationHistory, FeedbackRequest, FeedbackResult
from app.schemas.common import Envelope, ErrorEnvelope, ListEnvelope
from app.schemas.forecast import Forecast, ForecastRequest
from app.schemas.ponds import Pond, PondCreate, PondUpdate
from app.schemas.water import WaterCheck, WaterCheckRequest
from app.services import forecasts, ponds, water_checks

router = APIRouter(prefix="/ponds", tags=["ponds"])
NOT_FOUND: dict[int | str, dict[str, Any]] = {404: {"model": ErrorEnvelope}, 422: {"model": ErrorEnvelope}}


@router.get("", response_model=ListEnvelope[Pond], summary="List ponds")
def list_ponds(page: Page = Depends(), ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    return list_envelope(ctx, ponds.list_ponds(ctx), page)


@router.post("", response_model=Envelope[Pond], status_code=status.HTTP_201_CREATED,
             responses={422: {"model": ErrorEnvelope}}, summary="Register a pond")
def create_pond(payload: PondCreate, ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    return envelope(ctx, ponds.create_pond(ctx, payload))


@router.get("/{pond_id}", response_model=Envelope[Pond], responses=NOT_FOUND, summary="Get a pond")
def get_pond(pond_id: str, ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    return envelope(ctx, ponds.to_response(ctx, ponds.get_pond_record(ctx, pond_id)))


@router.patch("/{pond_id}", response_model=Envelope[Pond], responses=NOT_FOUND, summary="Update a pond")
def update_pond(pond_id: str, payload: PondUpdate, ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    return envelope(ctx, ponds.update_pond(ctx, pond_id, payload))


@router.post("/{pond_id}/forecast", response_model=Envelope[Forecast], status_code=status.HTTP_201_CREATED,
             responses=NOT_FOUND, summary="Run the demo overnight oxygen-risk forecast")
def run_forecast(pond_id: str, payload: ForecastRequest | None = None,
                 ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    return envelope(ctx, forecasts.run_forecast(ctx, pond_id, payload or ForecastRequest()))


@router.get("/{pond_id}/forecasts", response_model=ListEnvelope[Forecast], responses=NOT_FOUND,
            summary="List stored forecasts for a pond (newest first)")
def list_forecasts(pond_id: str, page: Page = Depends(), ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    return list_envelope(ctx, forecasts.list_forecasts(ctx, pond_id), page)


@router.post("/{pond_id}/water-check", response_model=Envelope[WaterCheck], status_code=status.HTTP_201_CREATED,
             responses=NOT_FOUND, summary="Evaluate water-quality readings and symptoms")
def water_check(pond_id: str, payload: WaterCheckRequest, ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    return envelope(ctx, water_checks.run_water_check(ctx, pond_id, payload))


@router.get("/{pond_id}/water-checks", response_model=ListEnvelope[WaterCheck], responses=NOT_FOUND,
            summary="List stored water checks for a pond (newest first)")
def list_water_checks(pond_id: str, page: Page = Depends(), ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    return list_envelope(ctx, water_checks.list_water_checks(ctx, pond_id), page)


@router.post("/{pond_id}/feedback", response_model=Envelope[FeedbackResult], status_code=status.HTTP_201_CREATED,
             responses={**NOT_FOUND, 409: {"model": ErrorEnvelope}},
             summary="Record a farmer's dawn observation for a forecast (updates pond calibration)")
def feedback(pond_id: str, payload: FeedbackRequest, ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    return envelope(ctx, forecasts.submit_feedback(ctx, pond_id, payload))


@router.get("/{pond_id}/calibration", response_model=Envelope[CalibrationHistory], responses=NOT_FOUND,
            summary="Current calibration state and audit trail for a pond")
def calibration(pond_id: str, ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    return envelope(ctx, forecasts.calibration_history(ctx, pond_id))
