"""Per-pond calibration from farmer feedback — a conservative, auditable DEMO adjustment.

The only calibrated quantity is a per-pond `demand_multiplier` that scales oxygen demand in the demo
engine. Farmer observations are coarse (e.g. "fish gasping at dawn"); they do not measure dissolved
oxygen, so each observation moves the multiplier by a small, bounded step. No model is retrained.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from app.storage.db import Database

DEFAULT_MULTIPLIER = 1.0
MIN_MULTIPLIER = 0.80
MAX_MULTIPLIER = 1.25

STRESS_OBSERVATIONS = {"fish_gasping_at_dawn", "fish_mortality_overnight"}

# delta applied to demand_multiplier for (forecast_status, observation group)
STEP_UP = {"safe": 0.05, "watch": 0.03, "danger": 0.0}
STEP_DOWN = {"safe": 0.0, "watch": -0.01, "danger": -0.02}

METHOD = (
    "Bounded step adjustment of a per-pond demand multiplier ({lo}-{hi}). Stress observed after a "
    "safe/watch forecast nudges it up (+0.05/+0.03); no stress after a watch/danger forecast nudges it "
    "down (-0.01/-0.02). Nights with aerators running, or not checked, cause no change."
).format(lo=MIN_MULTIPLIER, hi=MAX_MULTIPLIER)
LIMITATIONS = (
    "Farmer observations are qualitative and do not measure dissolved oxygen. This demo adjustment is "
    "not statistical calibration, is not validated, and never retrains any model automatically."
)


@dataclass(frozen=True)
class CalibrationDecision:
    previous: float
    updated: float
    delta: float
    rule_applied: str
    explanation: str


def decide(previous: float, forecast_status: str, observation: str, aerator_used: bool) -> CalibrationDecision:
    def result(delta: float, rule: str, explanation: str) -> CalibrationDecision:
        updated = round(min(MAX_MULTIPLIER, max(MIN_MULTIPLIER, previous + delta)), 3)
        return CalibrationDecision(previous, updated, round(updated - previous, 3), rule, explanation)

    if observation == "not_checked":
        return result(0.0, "no_information", "Pond was not checked, so the outcome is unknown; no change.")
    if aerator_used:
        return result(0.0, "confounded_by_aeration",
                      "Aerators ran overnight, so the outcome does not show the pond's natural oxygen demand; no change.")
    if observation in STRESS_OBSERVATIONS:
        delta = STEP_UP[forecast_status]
        if delta == 0:
            return result(0.0, "consistent_with_forecast",
                          "Stress was reported after a danger forecast; the forecast already reflected high risk.")
        return result(delta, "stress_after_lower_risk_forecast",
                      f"Stress was reported after a {forecast_status} forecast; demand multiplier nudged up.")
    delta = STEP_DOWN[forecast_status]
    if delta == 0:
        return result(0.0, "consistent_with_forecast",
                      "No stress was seen after a safe forecast; the forecast and outcome agree.")
    return result(delta, "no_stress_after_higher_risk_forecast",
                  f"No stress was seen after a {forecast_status} forecast; demand multiplier nudged down slightly.")


def get_state(db: Database, pond_id: str) -> dict[str, Any]:
    state = db.find("calibration_states", pond_id)
    if state is None:
        return {
            "id": pond_id,
            "pond_id": pond_id,
            "created_at": "1970-01-01T00:00:00+00:00",
            "demand_multiplier": DEFAULT_MULTIPLIER,
            "feedback_count": 0,
            "updated_at": None,
        }
    return state


def state_response(state: dict[str, Any]) -> dict[str, Any]:
    return {
        "pond_id": state["pond_id"],
        "demand_multiplier": state["demand_multiplier"],
        "min_multiplier": MIN_MULTIPLIER,
        "max_multiplier": MAX_MULTIPLIER,
        "feedback_count": state["feedback_count"],
        "updated_at": state["updated_at"],
        "method": METHOD,
        "limitations": LIMITATIONS,
    }


def record_feedback(
    db: Database,
    *,
    event_id: str,
    pond_id: str,
    forecast: dict[str, Any],
    observation: str,
    observed_at: datetime,
    aerator_used: bool,
    note: str | None,
    now: datetime,
) -> tuple[dict[str, Any], dict[str, Any]]:
    state = get_state(db, pond_id)
    forecast_status = forecast["summary"]["overall_status"]
    decision = decide(float(state["demand_multiplier"]), forecast_status, observation, aerator_used)
    event = {
        "id": event_id,
        "pond_id": pond_id,
        "forecast_id": forecast["id"],
        "forecast_status": forecast_status,
        "forecast_peak_risk_index": forecast["summary"]["peak_risk_index"],
        "observation": observation,
        "observed_at": observed_at.isoformat(),
        "aerator_used": aerator_used,
        "note": note,
        "created_at": now.isoformat(),
        "previous_demand_multiplier": decision.previous,
        "updated_demand_multiplier": decision.updated,
        "delta": decision.delta,
        "rule_applied": decision.rule_applied,
        "explanation": decision.explanation,
    }
    new_state = {
        **state,
        "created_at": state["created_at"] if state["feedback_count"] else now.isoformat(),
        "demand_multiplier": decision.updated,
        "feedback_count": int(state["feedback_count"]) + 1,
        "updated_at": now.isoformat(),
    }
    db.put_many([("calibration_events", event), ("calibration_states", new_state)])
    return event, new_state
