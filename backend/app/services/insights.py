"""Read-only aggregate views: ML status, technical approach and the dashboard summary."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from app.context import AppContext
from app.services import calibration, reports
from app.services.ponds import latest_status
from ml.status import collect_status

STATUS_LEGEND = {
    "implemented_demo": "Working software running on synthetic or user-entered demo data; not validated.",
    "mock": "Simulated stand-in for an external service; nothing real is contacted.",
    "experimental": "Offline experiment; results are not used in the live product flow.",
    "planned": "Designed but not implemented.",
    "not_started": "Not designed or implemented yet.",
}


def ml_status(ctx: AppContext) -> dict[str, Any]:
    return collect_status(ctx.settings.ml_data_path, ctx.settings.ml_artifacts_path)


def approach(ctx: AppContext) -> dict[str, Any]:
    ml = ml_status(ctx)
    live = ctx.settings.weather_provider == "open_meteo"
    experiments = {e["dataset_id"]: e["status"] for e in ml["experiments"]}
    ml_detail = (
        f"No correction model is applied to forecasts. Offline experiment state: {ml['overall_state']}"
        + (f" ({', '.join(f'{k}: {v}' for k, v in sorted(experiments.items()))})." if experiments else ".")
    )
    stages: list[dict[str, Any]] = [
        {
            "id": "farmer_pond_inputs", "name": "Farmer and pond inputs",
            "purpose": "Capture each pond's size, depth, species, stocking and equipment so risk reflects that pond.",
            "inputs": ["pond registration form", "farmer edits"],
            "outputs": ["pond profile"],
            "implementation_status": "implemented_demo",
            "status_detail": "Pond create/list/get/update with validation, stored in local SQLite.",
            "limitations": ["Biomass is the farmer's estimate; no automated stock tracking.",
                            "No authentication or multi-user access control in the MVP."],
            "code_reference": "backend/app/services/ponds.py",
            "api_endpoints": ["GET /api/v1/ponds", "POST /api/v1/ponds", "GET /api/v1/ponds/{pond_id}",
                              "PATCH /api/v1/ponds/{pond_id}"],
        },
        {
            "id": "weather_inputs", "name": "Weather features",
            "purpose": "Summarise sunshine, cloud, wind, rain and temperature that drive overnight oxygen balance.",
            "inputs": ["scenario preset", "manual overrides", "Open-Meteo forecast (optional)"],
            "outputs": ["evening-to-morning weather summary with per-field source"],
            "implementation_status": "implemented_demo",
            "status_detail": ("Open-Meteo adapter enabled with automatic fallback to presets." if live else
                              "Offline synthetic scenario presets in use; Open-Meteo adapter exists but "
                              "WEATHER_PROVIDER=demo."),
            "limitations": ["Presets are synthetic, not observations.",
                            "Open-Meteo lookup uses approximate district centroids, not pond coordinates."],
            "code_reference": "backend/app/services/weather.py",
            "api_endpoints": ["GET /api/v1/weather/scenarios"],
        },
        {
            "id": "physics_baseline", "name": "Physics-inspired baseline",
            "purpose": "Simulate the overnight oxygen reserve hour by hour from demand (respiration) and supply "
                       "(re-aeration, aerators).",
            "inputs": ["pond profile", "weather summary", "optional evening water readings", "pond calibration"],
            "outputs": ["hourly relative risk index (0-100)", "factor sensitivities"],
            "implementation_status": "implemented_demo",
            "status_detail": "Deterministic engine demo-0.1.0 with documented assumptions.",
            "limitations": ["Uncalibrated: constants are demonstration settings, not fitted to measured DO.",
                            "Outputs a relative index, never a dissolved-oxygen concentration or crash time."],
            "code_reference": "backend/app/services/forecast_engine.py",
            "api_endpoints": ["POST /api/v1/ponds/{pond_id}/forecast"],
        },
        {
            "id": "ml_correction", "name": "ML correction layer",
            "purpose": "Learn systematic errors of the baseline from measured overnight DO and adjust the risk.",
            "inputs": ["baseline output", "weather", "measured DO series (needed)"],
            "outputs": ["corrected risk (future)"],
            "implementation_status": "experimental" if ml["ml_correction_in_forecast"]["model_available"] else "planned",
            "status_detail": ml_detail,
            "limitations": ["No labelled overnight DO series with matching weather exists for the target ponds.",
                            "Offline experiments use other datasets/tasks or synthetic data and are not applied."],
            "code_reference": "backend/ml/",
            "api_endpoints": ["GET /api/v1/ml/status"],
        },
        {
            "id": "water_quality_rules", "name": "Water-quality and symptom rules",
            "purpose": "Flag pH, temperature, ammonia, nitrite, DO and visible symptoms that need attention.",
            "inputs": ["test-kit readings", "observed symptoms"],
            "outputs": ["safe/watch/danger with triggered rules, next steps and referral"],
            "implementation_status": "implemented_demo",
            "status_detail": f"Threshold profile '{ctx.thresholds.id}' (demonstration settings, not validated).",
            "limitations": ["Generic warm-water thresholds; not species- or region-specific.",
                            "Never a disease diagnosis; refers medication questions to a fisheries officer."],
            "code_reference": "backend/app/services/water_rules.py",
            "api_endpoints": ["POST /api/v1/ponds/{pond_id}/water-check"],
        },
        {
            "id": "risk_classification", "name": "Safe / Watch / Danger classification",
            "purpose": "Turn scores and rule results into one actionable level.",
            "inputs": ["risk index", "rule results"],
            "outputs": ["status level"],
            "implementation_status": "implemented_demo",
            "status_detail": (f"Forecast: watch ≥ {ctx.settings.risk_watch_threshold}, danger ≥ "
                              f"{ctx.settings.risk_danger_threshold} on the relative index (configurable)."),
            "limitations": ["Boundaries are demonstration settings, not tuned against outcomes."],
            "code_reference": "backend/app/services/forecast_engine.py",
            "api_endpoints": [],
        },
        {
            "id": "alert_delivery", "name": "WhatsApp / SMS / voice alerts",
            "purpose": "Send localized Kannada and English alerts and record delivery and acknowledgement.",
            "inputs": ["watch/danger forecast or water check", "pond contact preferences"],
            "outputs": ["alert", "simulated delivery attempts", "acknowledgement"],
            "implementation_status": "mock",
            "status_detail": f"Provider '{ctx.alert_provider.name}' — offline mock; never contacts phone numbers.",
            "limitations": ["Kannada templates are unreviewed drafts.",
                            "Real providers need onboarding, approved templates, consent, pricing and DLT/TRAI "
                            "compliance before use."],
            "code_reference": "backend/app/services/alerts.py",
            "api_endpoints": ["GET /api/v1/alerts", "POST /api/v1/alerts/{alert_id}/simulate-send",
                              "POST /api/v1/alerts/{alert_id}/acknowledge"],
        },
        {
            "id": "feedback_calibration", "name": "Farmer feedback and per-pond calibration",
            "purpose": "Use what farmers observed at dawn to nudge each pond's demand multiplier.",
            "inputs": ["forecast id", "farmer observation"],
            "outputs": ["calibration event with before/after values"],
            "implementation_status": "implemented_demo",
            "status_detail": calibration.METHOD,
            "limitations": [calibration.LIMITATIONS],
            "code_reference": "backend/app/services/calibration.py",
            "api_endpoints": ["POST /api/v1/ponds/{pond_id}/feedback", "GET /api/v1/ponds/{pond_id}/calibration"],
        },
        {
            "id": "cooperative_monitoring", "name": "Cooperative monitoring and outbreak reporting",
            "purpose": "Aggregate farmer reports by village cluster to spot repeated symptoms early.",
            "inputs": ["farmer reports"],
            "outputs": ["cluster summaries with a follow-up signal"],
            "implementation_status": "implemented_demo",
            "status_detail": reports.SIGNAL_RULE,
            "limitations": ["Signal rule is a demonstration setting, not an epidemiological threshold.",
                            "A signal prompts follow-up; it does not confirm an outbreak."],
            "code_reference": "backend/app/services/reports.py",
            "api_endpoints": ["GET /api/v1/reports", "POST /api/v1/reports", "GET /api/v1/cooperative/summary"],
        },
    ]
    for i, stage in enumerate(stages, start=1):
        stage["order"] = i
    return {
        "title": "MeenMitra proposed hybrid pipeline",
        "summary": "From pond and weather inputs to a demo overnight oxygen-risk index, water-quality rules, "
                   "simulated alerts and farmer feedback. Statuses below are computed from the running system.",
        "stages": stages,
        "status_legend": STATUS_LEGEND,
    }


def dashboard(ctx: AppContext) -> dict[str, Any]:
    now = ctx.clock()
    ponds = ctx.db.list("ponds", newest_first=False)
    alerts = ctx.db.list("alerts")
    open_by_pond: dict[str, int] = {}
    for alert in alerts:
        if alert["status"] != "acknowledged":
            open_by_pond[alert["pond_id"]] = open_by_pond.get(alert["pond_id"], 0) + 1
    by_status = {"safe": 0, "watch": 0, "danger": 0, "unknown": 0}
    pond_rows = []
    for pond in ponds:
        st = latest_status(ctx, pond["id"])
        by_status[st["overall_status"] or "unknown"] += 1
        pond_rows.append({
            "id": pond["id"], "name": pond["name"], "village_cluster": pond["village_cluster"],
            "district": pond["district"], "species": pond["species"], "overall_status": st["overall_status"],
            "forecast_peak_risk_index": st["forecast_peak_risk_index"],
            "forecast_generated_at": st["forecast_generated_at"], "water_status": st["water_status"],
            "open_alert_count": open_by_pond.get(pond["id"], 0), "is_demo_record": pond["is_demo_record"],
        })
    week_ago = now - timedelta(days=7)
    recent_reports = [r for r in ctx.db.list("farmer_reports")
                      if datetime.fromisoformat(r["observed_at"]) >= week_ago]
    coop = reports.cooperative_summary(ctx)
    ml = ml_status(ctx)
    return {
        "totals": {
            "ponds": len(ponds),
            "ponds_by_status": by_status,
            "open_alerts": sum(1 for a in alerts if a["status"] in ("pending", "sent", "failed")),
            "unacknowledged_alerts": sum(1 for a in alerts if a["acknowledgement"] is None),
            "simulated_deliveries": sum(len(a["deliveries"]) for a in alerts),
            "farmer_reports_last_7_days": len(recent_reports),
        },
        "ponds": pond_rows,
        "recent_alerts": [
            {"id": a["id"], "pond_id": a["pond_id"], "pond_name": a["pond_name"], "severity": a["severity"],
             "status": a["status"], "title_en": a["title"]["en"], "created_at": a["created_at"]}
            for a in alerts[:5]
        ],
        "cooperative_signals": [
            {"cluster_id": c["cluster_id"], "village_cluster": c["village_cluster"], "district": c["district"],
             **c["signal"]}
            for c in coop["clusters"] if c["signal"]["level"] != "none"
        ],
        "ml": {"overall_state": ml["overall_state"], "summary": ml["summary"],
               "ml_correction_applied": ml["ml_correction_in_forecast"]["applied"]},
        "data_notice": "Demo mode: seeded ponds, readings, reports and alerts are synthetic records, and every "
                       "forecast is a simulated relative risk index. No message has been sent to a real phone.",
    }
