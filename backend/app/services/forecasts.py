"""Forecast orchestration: pond profile + weather + calibration → demo engine → stored forecast (+ alert)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from app.context import AppContext
from app.errors import ConflictError, InvalidInputError, NotFoundError
from app.schemas.calibration import FeedbackRequest
from app.schemas.forecast import ForecastRequest
from app.services import calibration
from app.services.alerts import build_forecast_alert
from app.services.forecast_engine import (
    ASSUMPTIONS,
    ENGINE_VERSION,
    EngineInputs,
    factor_contributions,
    simulate,
)
from app.services.ponds import get_pond_record
from app.services.weather import WEATHER_FIELDS, resolve_weather
from app.utils import IST, stable_hash

DISCLAIMER = (
    "Demo simulation. The risk index is a relative, uncalibrated score from a physics-inspired model "
    "with synthetic or user-entered inputs. It is not a measured or predicted dissolved-oxygen value, "
    "does not predict when oxygen will crash, and following the suggestions does not guarantee that "
    "fish stress or mortality will be prevented."
)
ML_NOT_APPLIED_REASON = (
    "No ML correction model has been trained on features compatible with this forecast "
    "(pond profile + weather → overnight oxygen). See GET /api/v1/ml/status."
)
ACTION_LIMITATION = (
    "Demo suggestion based on a simulated relative risk index; it is not guaranteed to prevent stress or mortality."
)
NEUTRAL_BAND = 0.5


def run_forecast(
    ctx: AppContext, pond_id: str, request: ForecastRequest, *, is_demo_record: bool = False
) -> dict[str, Any]:
    """Run the demo engine for a pond. `is_demo_record` is set only by the seed script."""
    pond = get_pond_record(ctx, pond_id)
    now = ctx.clock()
    forecast_date = request.forecast_date or now.astimezone(IST).date()
    weather = resolve_weather(
        scenario=request.scenario,
        overrides=request.weather.model_dump() if request.weather else None,
        live_provider=ctx.live_weather,
        use_live=request.use_live_weather,
        district=pond["district"],
        forecast_date=forecast_date,
        start_hour=request.start_hour,
        end_hour=request.end_hour,
    )
    state = calibration.get_state(ctx.db, pond_id)
    water = request.water
    aerator_planned = pond["has_aerator"] if request.aerator_planned is None else request.aerator_planned
    if aerator_planned and pond["aerator_count"] == 0:
        raise InvalidInputError("aerator_planned is true but the pond has no aerators registered",
                                details={"pond_id": pond_id})

    inputs = EngineInputs(
        forecast_date=forecast_date,
        start_hour=request.start_hour,
        end_hour=request.end_hour,
        **{k: weather.values[k] for k in WEATHER_FIELDS},
        area_m2=float(pond["area_m2"]),
        depth_m=float(pond["depth_m"]),
        biomass_kg=pond.get("estimated_biomass_kg"),
        aerator_count=int(pond["aerator_count"]),
        aerator_planned=bool(aerator_planned),
        feeding_plan=request.feeding_plan,
        water_temp_c=water.water_temp_c if water else None,
        observed_do_mg_l=water.dissolved_oxygen_mg_l if water else None,
        demand_multiplier=float(state["demand_multiplier"]),
    )
    watch, danger = ctx.settings.risk_watch_threshold, ctx.settings.risk_danger_threshold
    result = simulate(inputs, watch, danger)
    resolved_inputs = {
        "scenario": request.scenario,
        "weather": weather.values,
        "weather_value_sources": weather.sources,
        "pond": {k: pond.get(k) for k in ("area_m2", "depth_m", "species", "estimated_biomass_kg", "aerator_count")},
        "aerator_planned": inputs.aerator_planned,
        "feeding_plan": inputs.feeding_plan,
        "water_temp_c": {"value": result.estimated_water_temp_c,
                         "source": "default_assumption" if result.water_temp_estimated else "observed"},
        "observed_do_mg_l": inputs.observed_do_mg_l,
        "stocking_density_kg_m3": {"value": result.density_kg_m3,
                                   "source": "default_assumption" if result.density_assumed else "pond_profile"},
        "demand_multiplier": inputs.demand_multiplier,
        "window": {"forecast_date": forecast_date.isoformat(), "start_hour": request.start_hour,
                   "end_hour": request.end_hour},
    }
    peak_point = result.points[result.peak_index]
    forecast: dict[str, Any] = {
        "id": ctx.ids("fc"),
        "pond_id": pond_id,
        "created_at": now.isoformat(),
        "generated_at": now.isoformat(),
        "forecast_date": forecast_date.isoformat(),
        "window_start": result.points[0].timestamp.isoformat(),
        "window_end": result.points[-1].timestamp.isoformat(),
        "timezone": "Asia/Kolkata (UTC+05:30)",
        "hourly": [
            {"hour_index": p.hour_index, "timestamp": p.timestamp.isoformat(),
             "local_time": p.timestamp.strftime("%H:%M"), "risk_index": p.risk_index,
             "status": p.status, "value_type": "synthetic_model_output"}
            for p in result.points
        ],
        "summary": {
            "peak_risk_index": result.peak_risk_index,
            "mean_risk_index": result.mean_risk_index,
            "peak_risk_time": peak_point.timestamp.isoformat(),
            "overall_status": result.overall_status,
            "hours_watch": sum(1 for p in result.points if p.status == "watch"),
            "hours_danger": sum(1 for p in result.points if p.status == "danger"),
            "headline": _headline(result.overall_status, result.peak_risk_index, peak_point.timestamp.strftime("%H:%M")),
        },
        "factors": _factors(inputs, weather.sources, request, result, watch, danger),
        "actions": _actions(result.overall_status, pond, inputs.aerator_planned),
        "missing_data": _missing(pond, inputs, result),
        "resolved_inputs": resolved_inputs,
        "calibration_applied": {"demand_multiplier": inputs.demand_multiplier},
        "provenance": {
            "simulation": True,
            "output_type": "relative_risk_index",
            "model_mode": "demo_physics_inspired",
            "implementation_status": "demo",
            "engine_version": ENGINE_VERSION,
            "calibrated_to_measured_do": False,
            "ml_correction": {"applied": False, "reason": ML_NOT_APPLIED_REASON},
            "weather_source": weather.weather_source,
            "weather_fallback_reason": weather.fallback_reason,
            "inputs_hash": stable_hash({"engine": ENGINE_VERSION, "inputs": inputs.__dict__,
                                        "thresholds": [watch, danger]}),
            "assumptions": ASSUMPTIONS,
            "classification_thresholds": {"watch_at_or_above": watch, "danger_at_or_above": danger},
        },
        "alert_id": None,
        "is_demo_record": is_demo_record,
        "disclaimer": DISCLAIMER,
    }
    writes: list[tuple[str, dict[str, Any]]] = []
    if request.create_alert and result.overall_status in ("watch", "danger"):
        alert = build_forecast_alert(ctx, pond, forecast)
        forecast["alert_id"] = alert["id"]
        writes.append(("alerts", alert))
    ctx.db.put_many([("forecasts", forecast), *writes])
    return forecast


def _headline(status: str, peak: float, time: str) -> str:
    if status == "danger":
        return f"High simulated overnight oxygen risk (index {peak}, highest around {time}). Prepare to act tonight."
    if status == "watch":
        return f"Moderate simulated overnight oxygen risk (index {peak}, highest around {time}). Stay alert."
    return f"Low simulated overnight oxygen risk (peak index {peak}). Continue routine checks."


def _factor_source(key: str, weather_sources: dict[str, str], request: ForecastRequest, result: Any) -> str:
    weather_keys = {"cloud_cover": "cloud_cover_pct", "sunshine": "sunshine_hours_today",
                    "wind": "wind_speed_ms", "rainfall": "rainfall_mm"}
    if key in weather_keys:
        return weather_sources[weather_keys[key]]
    if key == "water_temperature":
        return "default_assumption" if result.water_temp_estimated else "observed"
    if key == "stocking_density":
        return "default_assumption" if result.density_assumed else "pond_profile"
    if key == "aeration":
        return "pond_profile" if request.aerator_planned is None else "user_override"
    if key == "feeding_plan":
        return "user_override"
    if key == "observed_do":
        return "observed" if request.water and request.water.dissolved_oxygen_mg_l is not None else "default_assumption"
    return "pond_profile"


_FACTOR_TEXT = {
    "water_temperature": ("Warmer water speeds up respiration by fish, plankton and sediment.",
                          "Cooler water slows respiration, lowering overnight demand."),
    "cloud_cover": ("Cloudy days reduce photosynthesis, leaving less oxygen banked for the night.",
                    "Clear skies allow more daytime photosynthesis."),
    "sunshine": ("Few sunshine hours mean less oxygen produced by algae before evening.",
                 "Long sunshine hours let algae build an oxygen reserve before evening."),
    "wind": ("Still air means little surface mixing and re-aeration overnight.",
             "Wind mixes the surface and adds oxygen from the air."),
    "rainfall": ("Heavy rain can wash in organic matter and disturb pond layers.",
                 "Little rain, so no extra demand from runoff."),
    "stocking_density": ("More fish per cubic metre consume oxygen faster.",
                         "Lighter stocking means lower oxygen demand."),
    "depth": ("Shallow ponds have proportionally more sediment demand per volume.",
              "A deeper pond holds more water per unit of sediment and stock."),
    "aeration": ("No aerators running overnight.",
                 "Aerators add oxygen through the night."),
    "feeding_plan": ("Normal feeding adds demand from digestion and uneaten feed.",
                     "Reduced or skipped evening feed lowers overnight demand."),
    "observed_do": ("The evening DO reading starts the night with a smaller reserve than the weather suggests.",
                    "The evening DO reading starts the night with a larger reserve than the weather suggests."),
    "calibration": ("Past farmer feedback for this pond nudged demand up.",
                    "Past farmer feedback for this pond nudged demand down."),
}


def _factors(inputs: EngineInputs, weather_sources: dict[str, str], request: ForecastRequest,
             result: Any, watch: float, danger: float) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for spec, value, contribution in factor_contributions(inputs, watch, danger):
        if abs(contribution) < NEUTRAL_BAND:
            effect, text = "neutral", "Close to the reference value; little effect on this forecast."
        elif contribution > 0:
            effect, text = "increases_risk", _FACTOR_TEXT[spec.key][0]
        else:
            effect, text = "decreases_risk", _FACTOR_TEXT[spec.key][1]
        if spec.key == "observed_do" and value is None:
            effect, text = "neutral", "No evening DO reading provided; the starting reserve was estimated from weather."
        out.append({
            "key": spec.key,
            "label": spec.label,
            "input_value": value,
            "unit": spec.unit,
            "reference_value": spec.reference_label,
            "effect": effect,
            "contribution_points": contribution,
            "value_source": _factor_source(spec.key, weather_sources, request, result),
            "explanation": text,
        })
    out.sort(key=lambda f: -abs(f["contribution_points"]))
    return out


def _actions(status: str, pond: dict[str, Any], aerator_planned: bool) -> list[dict[str, Any]]:
    actions: list[dict[str, Any]] = []

    def add(action_id: str, priority: str, text: str) -> None:
        actions.append({"id": action_id, "priority": priority, "text": text, "limitation": ACTION_LIMITATION})

    if status == "danger":
        if pond["aerator_count"] > 0:
            add("run_aerators_all_night", "high", "Run aerators from late evening until after sunrise.")
        else:
            add("arrange_aeration", "high", "Arrange temporary aeration (e.g. a pump or paddle) if one is available.")
        add("skip_evening_feed", "high", "Skip or sharply reduce the evening feed.")
        add("prepare_water_exchange", "medium", "If a clean, oxygen-rich water source is available, be ready to add water.")
        add("contact_officer", "medium", "If fish gasp at the surface or die, contact your local fisheries officer.")
    elif status == "watch":
        if pond["aerator_count"] > 0 and not aerator_planned:
            add("aerators_from_midnight", "high", "Keep aerators ready and run them from around midnight.")
        add("reduce_evening_feed", "medium", "Reduce the evening feed and avoid fertiliser or manure today.")
    add("dawn_check", "medium" if status != "safe" else "low",
        "Check fish between 5 and 6 AM for gasping at the surface, and report what you see.")
    return actions


def _missing(pond: dict[str, Any], inputs: EngineInputs, result: Any) -> list[str]:
    missing = []
    if result.density_assumed:
        missing.append("estimated_biomass_kg not recorded for this pond; a reference density of 0.5 kg/m³ was assumed.")
    if result.water_temp_estimated:
        missing.append("Water temperature not measured; estimated as evening air temperature + 1 °C.")
    if inputs.observed_do_mg_l is None:
        missing.append("No evening dissolved-oxygen reading; starting reserve estimated from sunshine and cloud.")
    if pond.get("stocking_date") is None:
        missing.append("stocking_date not recorded (not used by the demo engine yet).")
    return missing


def get_forecast(ctx: AppContext, forecast_id: str) -> dict[str, Any]:
    forecast = ctx.db.find("forecasts", forecast_id)
    if forecast is None:
        raise NotFoundError(f"Forecast '{forecast_id}' not found", details={"forecast_id": forecast_id})
    return forecast


def list_forecasts(ctx: AppContext, pond_id: str) -> list[dict[str, Any]]:
    get_pond_record(ctx, pond_id)
    return ctx.db.list("forecasts", pond_id=pond_id)


def submit_feedback(ctx: AppContext, pond_id: str, payload: FeedbackRequest) -> dict[str, Any]:
    get_pond_record(ctx, pond_id)
    forecast = get_forecast(ctx, payload.forecast_id)
    if forecast["pond_id"] != pond_id:
        raise InvalidInputError("forecast_id belongs to a different pond",
                                details={"forecast_id": payload.forecast_id, "pond_id": pond_id})
    if payload.observed_at > ctx.clock():
        raise InvalidInputError("observed_at cannot be in the future", details={"now": ctx.clock().isoformat()})
    if payload.observed_at < datetime.fromisoformat(forecast["window_start"]):
        raise InvalidInputError("observed_at is before the forecast window started",
                                details={"window_start": forecast["window_start"]})
    if any(e["forecast_id"] == forecast["id"] for e in ctx.db.list("calibration_events", pond_id=pond_id)):
        raise ConflictError("Feedback for this forecast was already recorded",
                            details={"forecast_id": forecast["id"]})
    event, state = calibration.record_feedback(
        ctx.db,
        event_id=ctx.ids("fb"),
        pond_id=pond_id,
        forecast=forecast,
        observation=payload.observation,
        observed_at=payload.observed_at,
        aerator_used=payload.aerator_used,
        note=payload.note,
        now=ctx.clock(),
    )
    return {"event": event, "calibration": calibration.state_response(state)}


def calibration_history(ctx: AppContext, pond_id: str) -> dict[str, Any]:
    get_pond_record(ctx, pond_id)
    return {
        "calibration": calibration.state_response(calibration.get_state(ctx.db, pond_id)),
        "events": ctx.db.list("calibration_events", pond_id=pond_id),
    }
