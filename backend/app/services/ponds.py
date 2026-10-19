"""Pond management service."""

from __future__ import annotations

from typing import Any

from app.context import AppContext
from app.errors import InvalidInputError, NotFoundError
from app.schemas.ponds import PondCreate, PondUpdate
from app.services import calibration
from app.utils import mask_phone

_SEVERITY = {"safe": 0, "watch": 1, "danger": 2}


def get_pond_record(ctx: AppContext, pond_id: str) -> dict[str, Any]:
    pond = ctx.db.find("ponds", pond_id)
    if pond is None:
        raise NotFoundError(f"Pond '{pond_id}' not found", details={"pond_id": pond_id})
    return pond


def create_pond(ctx: AppContext, payload: PondCreate) -> dict[str, Any]:
    now = ctx.clock().isoformat()
    record = {
        "id": ctx.ids("pond"),
        **payload.model_dump(mode="json"),
        "is_demo_record": False,
        "created_at": now,
        "updated_at": now,
    }
    ctx.db.put("ponds", record)
    return to_response(ctx, record)


def update_pond(ctx: AppContext, pond_id: str, payload: PondUpdate) -> dict[str, Any]:
    record = get_pond_record(ctx, pond_id)
    changes = payload.model_dump(mode="json", exclude_unset=True)
    nullable = {"contact_phone", "stocking_date", "stocked_count", "estimated_biomass_kg"}
    for key, value in changes.items():
        if value is None and key not in nullable:
            raise InvalidInputError(f"'{key}' cannot be set to null", details={"field": key})
    merged = {**record, **changes}
    if changes.get("has_aerator") is True and merged.get("aerator_count", 0) == 0:
        merged["aerator_count"] = 1
    if merged["has_aerator"] is False and merged.get("aerator_count", 0) > 0:
        if "aerator_count" in changes:
            raise InvalidInputError("aerator_count must be 0 when has_aerator is false",
                                    details={"field": "aerator_count"})
        merged["aerator_count"] = 0
    merged["updated_at"] = ctx.clock().isoformat()
    ctx.db.put("ponds", merged)
    return to_response(ctx, merged)


def list_ponds(ctx: AppContext) -> list[dict[str, Any]]:
    ponds = ctx.db.list("ponds", newest_first=False)
    return [to_response(ctx, p) for p in ponds]


def latest_status(ctx: AppContext, pond_id: str) -> dict[str, Any]:
    forecasts = ctx.db.list("forecasts", pond_id=pond_id)
    checks = ctx.db.list("water_checks", pond_id=pond_id)
    status: dict[str, Any] = {
        "forecast_status": None, "forecast_id": None, "forecast_generated_at": None,
        "forecast_peak_risk_index": None, "water_status": None, "water_check_id": None,
        "water_checked_at": None, "overall_status": None,
    }
    if forecasts:
        f = forecasts[0]
        status.update(forecast_status=f["summary"]["overall_status"], forecast_id=f["id"],
                      forecast_generated_at=f["generated_at"],
                      forecast_peak_risk_index=f["summary"]["peak_risk_index"])
    if checks:
        c = checks[0]
        status.update(water_status=c["overall_status"], water_check_id=c["id"], water_checked_at=c["observed_at"])
    candidates = [s for s in (status["forecast_status"], status["water_status"]) if s]
    if candidates:
        status["overall_status"] = max(candidates, key=lambda s: _SEVERITY[s])
    return status


def to_response(ctx: AppContext, record: dict[str, Any]) -> dict[str, Any]:
    state = calibration.get_state(ctx.db, record["id"])
    response = {k: v for k, v in record.items() if k != "contact_phone"}
    response["contact_phone_masked"] = mask_phone(record.get("contact_phone"))
    response["latest_status"] = latest_status(ctx, record["id"])
    response["calibration"] = {
        "demand_multiplier": state["demand_multiplier"],
        "feedback_count": state["feedback_count"],
    }
    return response
