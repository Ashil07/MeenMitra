"""Water-check orchestration: validate → rules engine → stored check (+ alert)."""

from __future__ import annotations

from typing import Any

from app.context import AppContext
from app.errors import InvalidInputError
from app.schemas.water import MEASUREMENT_FIELDS, WaterCheckRequest
from app.services import water_rules
from app.services.alerts import build_water_alert
from app.services.ponds import get_pond_record


def run_water_check(
    ctx: AppContext, pond_id: str, request: WaterCheckRequest, *, is_demo_record: bool = False
) -> dict[str, Any]:
    pond = get_pond_record(ctx, pond_id)
    now = ctx.clock()
    if request.observed_at is not None and request.observed_at > now:
        raise InvalidInputError("observed_at cannot be in the future", details={"now": now.isoformat()})
    readings = {k: getattr(request, k) for k in MEASUREMENT_FIELDS}
    evaluation = water_rules.evaluate(readings, list(request.symptoms), ctx.thresholds)
    check: dict[str, Any] = {
        "id": ctx.ids("wc"),
        "pond_id": pond_id,
        "created_at": now.isoformat(),
        "observed_at": (request.observed_at or now).isoformat(),
        "inputs": {**readings, "symptoms": list(request.symptoms), "note": request.note},
        "derived": evaluation.derived,
        "overall_status": evaluation.overall_status,
        "triggered_rules": [o.as_dict() for o in evaluation.triggered],
        "evaluated_rules": [o.as_dict() for o in evaluation.evaluated],
        "missing_parameters": evaluation.missing_parameters,
        "next_steps": evaluation.next_steps,
        "referral": evaluation.referral,
        "threshold_profile": ctx.thresholds.info(),
        "alert_id": None,
        "is_demo_record": is_demo_record,
        "disclaimer": evaluation.disclaimer,
    }
    writes: list[tuple[str, dict[str, Any]]] = []
    if request.create_alert and evaluation.overall_status in ("watch", "danger"):
        alert = build_water_alert(ctx, pond, check)
        check["alert_id"] = alert["id"]
        writes.append(("alerts", alert))
    ctx.db.put_many([("water_checks", check), *writes])
    return check


def list_water_checks(ctx: AppContext, pond_id: str) -> list[dict[str, Any]]:
    get_pond_record(ctx, pond_id)
    return ctx.db.list("water_checks", pond_id=pond_id)
