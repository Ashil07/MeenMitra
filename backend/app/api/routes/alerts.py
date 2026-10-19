"""Alert centre routes: list, detail, simulated send, acknowledge."""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, Query

from app.api.deps import Page, envelope, get_ctx, list_envelope
from app.context import AppContext
from app.schemas.alerts import AcknowledgeRequest, Alert, AlertStatus, SimulateSendRequest, SimulateSendResult
from app.schemas.common import Envelope, ErrorEnvelope, ListEnvelope
from app.services import alerts

router = APIRouter(prefix="/alerts", tags=["alerts"])
ERRORS: dict[int | str, dict[str, Any]] = {404: {"model": ErrorEnvelope}, 409: {"model": ErrorEnvelope},
                                           422: {"model": ErrorEnvelope}}


@router.get("", response_model=ListEnvelope[Alert], summary="List alerts (newest first)")
def list_alerts(
    pond_id: str | None = Query(None),
    status: AlertStatus | None = Query(None),
    severity: Literal["watch", "danger"] | None = Query(None),
    page: Page = Depends(),
    ctx: AppContext = Depends(get_ctx),
) -> dict[str, Any]:
    return list_envelope(ctx, alerts.list_alerts(ctx, pond_id, status, severity), page)


@router.get("/{alert_id}", response_model=Envelope[Alert], responses=ERRORS, summary="Get an alert")
def get_alert(alert_id: str, ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    return envelope(ctx, alerts.get_alert(ctx, alert_id))


@router.post("/{alert_id}/simulate-send", response_model=Envelope[SimulateSendResult], responses=ERRORS,
             summary="Simulate WhatsApp/SMS/voice delivery through the offline mock provider")
def simulate_send(alert_id: str, payload: SimulateSendRequest | None = None,
                  ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    return envelope(ctx, alerts.simulate_send(ctx, alert_id, payload or SimulateSendRequest()))


@router.post("/{alert_id}/acknowledge", response_model=Envelope[Alert], responses=ERRORS,
             summary="Record the farmer's acknowledgement")
def acknowledge(alert_id: str, payload: AcknowledgeRequest | None = None,
                ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    return envelope(ctx, alerts.acknowledge(ctx, alert_id, payload or AcknowledgeRequest()))
