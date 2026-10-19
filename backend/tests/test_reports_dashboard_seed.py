from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app.context import AppContext, build_context
from app.factory import create_app
from app.storage.seed import seed
from tests.conftest import ANCHOR, fixed_clock, make_settings


def test_seed_is_reproducible(tmp_path: Path) -> None:
    a = build_context(make_settings(tmp_path / "a"), clock=fixed_clock)
    b = build_context(make_settings(tmp_path / "b"), clock=fixed_clock)
    assert seed(a, ANCHOR) == seed(b, ANCHOR)
    for collection in ("ponds", "forecasts", "water_checks", "alerts", "farmer_reports", "calibration_events"):
        assert a.db.list(collection) == b.db.list(collection), collection


def test_seeded_records_are_flagged_and_stable(seeded_ctx: AppContext) -> None:
    ponds = seeded_ctx.db.list("ponds", newest_first=False)
    assert [p["id"] for p in ponds] == [f"pond_demo_00{i}" for i in range(1, 7)]
    assert all(p["is_demo_record"] for p in ponds)
    assert all(f["is_demo_record"] for f in seeded_ctx.db.list("forecasts"))
    assert all(a["id"].startswith("alert_demo_") for a in seeded_ctx.db.list("alerts"))


def test_reset_requires_flag(seeded_client: TestClient) -> None:
    response = seeded_client.post("/api/v1/demo/reset")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "feature_disabled"


def test_reset_when_enabled(tmp_path: Path) -> None:
    ctx = build_context(make_settings(tmp_path, allow_demo_reset=True), clock=fixed_clock)
    seed(ctx, ANCHOR)
    with TestClient(create_app(ctx=ctx)) as client:
        client.post("/api/v1/ponds", json={"name": "Extra", "farmer_name": "F", "district": "Udupi",
                                           "village_cluster": "C", "area_m2": 500, "depth_m": 1,
                                           "species": "tilapia"})
        assert client.get("/api/v1/ponds").json()["meta"]["pagination"]["total"] == 7
        response = client.post("/api/v1/demo/reset")
        assert response.status_code == 200
        assert client.get("/api/v1/ponds").json()["meta"]["pagination"]["total"] == 6


def test_report_creation_and_validation(client: TestClient, pond_id: str) -> None:
    ok = client.post("/api/v1/reports", json={"pond_id": pond_id, "symptoms": ["white_spots"],
                                              "observed_at": "2026-10-01T07:00:00+05:30"})
    assert ok.status_code == 201
    assert ok.json()["data"]["village_cluster"] == "Test Cluster"
    empty = client.post("/api/v1/reports", json={"pond_id": pond_id, "observed_at": "2026-10-01T07:00:00+05:30"})
    assert empty.status_code == 422
    missing = client.post("/api/v1/reports", json={"pond_id": "pond_x", "note": "x",
                                                   "observed_at": "2026-10-01T07:00:00+05:30"})
    assert missing.status_code == 404


def test_cooperative_summary_is_anonymised_and_signals(seeded_client: TestClient) -> None:
    response = seeded_client.get("/api/v1/cooperative/summary")
    text = response.text
    for secret in ("Demo Farmer", "+91000", "Demo Pond"):
        assert secret not in text
    clusters = {c["village_cluster"]: c for c in response.json()["data"]["clusters"]}
    assert clusters["Demo Cluster Mulki"]["signal"]["level"] == "investigate"
    assert clusters["Demo Cluster Brahmavar"]["signal"]["level"] == "watch"
    assert clusters["Demo Cluster Kumta"]["signal"]["level"] == "none"
    assert clusters["Demo Cluster Kumta"]["mortality_reported"] == 0  # older report is outside the window
    wide = seeded_client.get("/api/v1/cooperative/summary?window_days=30").json()["data"]
    assert {c["village_cluster"]: c for c in wide["clusters"]}["Demo Cluster Kumta"]["mortality_reported"] == 5


def test_dashboard_summary_is_consistent(seeded_client: TestClient) -> None:
    data = seeded_client.get("/api/v1/dashboard/summary").json()["data"]
    totals = data["totals"]
    assert totals["ponds"] == 6 == sum(totals["ponds_by_status"].values()) == len(data["ponds"])
    alerts = seeded_client.get("/api/v1/alerts?limit=200").json()["data"]
    assert totals["unacknowledged_alerts"] == sum(1 for a in alerts if a["acknowledgement"] is None)
    assert totals["simulated_deliveries"] == sum(len(a["deliveries"]) for a in alerts)
    assert totals["farmer_reports_last_7_days"] == 6
    assert data["ml"]["ml_correction_applied"] is False
    assert "synthetic" in data["data_notice"]


def test_approach_reflects_actual_status(seeded_client: TestClient) -> None:
    data = seeded_client.get("/api/v1/approach").json()["data"]
    stages = {s["id"]: s for s in data["stages"]}
    assert list(stages) == ["farmer_pond_inputs", "weather_inputs", "physics_baseline", "ml_correction",
                            "water_quality_rules", "risk_classification", "alert_delivery",
                            "feedback_calibration", "cooperative_monitoring"]
    assert stages["ml_correction"]["implementation_status"] == "planned"
    assert "no_runs" in stages["ml_correction"]["status_detail"]
    assert stages["alert_delivery"]["implementation_status"] == "mock"
    assert "WEATHER_PROVIDER=demo" in stages["weather_inputs"]["status_detail"]
    for stage in data["stages"]:
        assert stage["purpose"] and stage["inputs"] and stage["outputs"] and stage["limitations"]
        assert stage["implementation_status"] in data["status_legend"]


def test_weather_scenarios_listed(client: TestClient) -> None:
    data = client.get("/api/v1/weather/scenarios").json()["data"]
    assert {s["name"] for s in data} >= {"clear_calm_night", "overcast_still_night"}
    assert all(s["synthetic"] for s in data)
