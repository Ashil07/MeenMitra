"""Export docs/openapi.json and example request/response payloads for the frontend owner.

Runs the real app against a temporary, freshly seeded database with a fixed anchor time, so the
examples are reproducible and always match the implementation.

Usage (from backend/):  python -m scripts.export_api_docs
"""

from __future__ import annotations

import json
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from app.config import Settings
from app.context import build_context
from app.factory import create_app
from app.storage.seed import seed

BACKEND = Path(__file__).resolve().parent.parent
DOCS = BACKEND / "docs"
EXAMPLES = DOCS / "examples"
ANCHOR = datetime(2026, 10, 1, 4, 30, tzinfo=timezone.utc)


def main() -> None:
    EXAMPLES.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        settings = Settings(_env_file=None, database_path=str(Path(tmp) / "docs.db"),  # type: ignore[call-arg]
                            ml_data_dir=str(Path(tmp) / "raw"), ml_artifacts_dir=str(Path(tmp) / "artifacts"),
                            seed_on_startup=False)
        now = ANCHOR + timedelta(minutes=30)
        ctx = build_context(settings, clock=lambda: now)
        seed(ctx, ANCHOR)
        app = create_app(ctx=ctx)
        with TestClient(app) as client:
            (DOCS / "openapi.json").write_text(json.dumps(app.openapi(), indent=2, ensure_ascii=False) + "\n",
                                               encoding="utf-8")
            pond_body = {"name": "Example Pond", "farmer_name": "Example Farmer", "contact_phone": "+910000000042",
                         "district": "Udupi", "village_cluster": "Example Cluster", "area_m2": 1500, "depth_m": 1.2,
                         "species": "tilapia", "estimated_biomass_kg": 900, "has_aerator": True,
                         "aerator_count": 1, "preferred_language": "kn", "alert_channels": ["whatsapp", "sms"]}
            forecast_body = {"forecast_date": "2026-10-01", "scenario": "overcast_still_night",
                             "weather": {"wind_speed_ms": 0.4}, "aerator_planned": False, "feeding_plan": "normal"}
            water_body = {"ph": 8.6, "water_temp_c": 30.5, "total_ammonia_mg_l": 1.2, "nitrite_mg_l": 0.2,
                          "dissolved_oxygen_mg_l": 3.8, "symptoms": ["reduced_feeding"],
                          "observed_at": "2026-10-01T06:00:00+05:30"}
            past = client.post("/api/v1/ponds/pond_demo_003/forecast",
                               json={"forecast_date": "2026-09-30", "create_alert": False}).json()["data"]
            calls: list[tuple[str, str, str, dict[str, Any] | None]] = [
                ("health", "GET", "/health", None),
                ("dashboard_summary", "GET", "/api/v1/dashboard/summary", None),
                ("ponds_list", "GET", "/api/v1/ponds?limit=2", None),
                ("pond_create", "POST", "/api/v1/ponds", pond_body),
                ("pond_get", "GET", "/api/v1/ponds/pond_demo_002", None),
                ("pond_update", "PATCH", "/api/v1/ponds/pond_demo_002", {"depth_m": 1.3}),
                ("forecast_create", "POST", "/api/v1/ponds/pond_demo_002/forecast", forecast_body),
                ("water_check_create", "POST", "/api/v1/ponds/pond_demo_002/water-check", water_body),
                ("alerts_list", "GET", "/api/v1/alerts?limit=2", None),
                ("alert_simulate_send", "POST", "/api/v1/alerts/alert_demo_003/simulate-send",
                 {"channels": ["whatsapp", "sms"], "language": "kn", "simulate_failure_channels": ["sms"]}),
                ("alert_acknowledge", "POST", "/api/v1/alerts/alert_demo_003/acknowledge",
                 {"response": "seen", "channel": "whatsapp"}),
                ("feedback_create", "POST", "/api/v1/ponds/pond_demo_003/feedback",
                 {"forecast_id": past["id"], "observation": "no_stress_seen",
                  "observed_at": "2026-10-01T06:10:00+05:30", "aerator_used": True}),
                ("calibration_get", "GET", "/api/v1/ponds/pond_demo_001/calibration", None),
                ("reports_list", "GET", "/api/v1/reports?limit=2", None),
                ("cooperative_summary", "GET", "/api/v1/cooperative/summary", None),
                ("weather_scenarios", "GET", "/api/v1/weather/scenarios", None),
                ("ml_status", "GET", "/api/v1/ml/status", None),
                ("approach", "GET", "/api/v1/approach", None),
                ("error_validation", "POST", "/api/v1/ponds", {"name": "x", "area_m2": -1}),
                ("error_not_found", "GET", "/api/v1/ponds/pond_missing", None),
            ]
            for name, method, url, body in calls:
                response = client.request(method, url, json=body)
                if response.status_code >= 500:
                    raise RuntimeError(f"{name}: {response.status_code} {response.text}")
                example = {"request": {"method": method, "url": url, "body": body},
                           "response": {"status": response.status_code, "body": response.json()}}
                (EXAMPLES / f"{name}.json").write_text(json.dumps(example, indent=2, ensure_ascii=False) + "\n",
                                                       encoding="utf-8")
                print(f"{response.status_code} {name}")


if __name__ == "__main__":
    main()
