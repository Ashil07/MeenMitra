from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.services.calibration import MAX_MULTIPLIER, MIN_MULTIPLIER, decide
from tests.conftest import VALID_POND


@pytest.mark.parametrize(
    ("status", "observation", "aerator", "delta", "rule"),
    [
        ("safe", "fish_gasping_at_dawn", False, 0.05, "stress_after_lower_risk_forecast"),
        ("watch", "fish_mortality_overnight", False, 0.03, "stress_after_lower_risk_forecast"),
        ("danger", "fish_gasping_at_dawn", False, 0.0, "consistent_with_forecast"),
        ("danger", "no_stress_seen", False, -0.02, "no_stress_after_higher_risk_forecast"),
        ("watch", "no_stress_seen", False, -0.01, "no_stress_after_higher_risk_forecast"),
        ("safe", "no_stress_seen", False, 0.0, "consistent_with_forecast"),
        ("safe", "fish_gasping_at_dawn", True, 0.0, "confounded_by_aeration"),
        ("danger", "not_checked", False, 0.0, "no_information"),
    ],
)
def test_decision_rules(status: str, observation: str, aerator: bool, delta: float, rule: str) -> None:
    decision = decide(1.0, status, observation, aerator)
    assert decision.delta == pytest.approx(delta)
    assert decision.rule_applied == rule
    assert decision.previous == 1.0


def test_multiplier_is_bounded() -> None:
    assert decide(MAX_MULTIPLIER, "safe", "fish_gasping_at_dawn", False).updated == MAX_MULTIPLIER
    assert decide(MIN_MULTIPLIER, "danger", "no_stress_seen", False).updated == MIN_MULTIPLIER


def _pond(client: TestClient, name: str) -> str:
    return str(client.post("/api/v1/ponds", json={**VALID_POND, "name": name}).json()["data"]["id"])


def _forecast(client: TestClient, pond_id: str, **body: Any) -> dict[str, Any]:
    data: dict[str, Any] = client.post(f"/api/v1/ponds/{pond_id}/forecast", json={
        "forecast_date": "2026-09-30", "create_alert": False, **body}).json()["data"]
    return data


def _feedback(client: TestClient, pond_id: str, forecast_id: str, observation: str = "fish_gasping_at_dawn") -> Any:
    return client.post(f"/api/v1/ponds/{pond_id}/feedback", json={
        "forecast_id": forecast_id, "observation": observation, "observed_at": "2026-10-01T06:10:00+05:30"})


def test_feedback_updates_only_that_pond(client: TestClient) -> None:
    pond_a, pond_b = _pond(client, "A"), _pond(client, "B")
    fc_a = _forecast(client, pond_a, scenario="windy_clear_night")
    assert fc_a["summary"]["overall_status"] == "safe"
    before_b = _forecast(client, pond_b, scenario="clear_calm_night")

    response = _feedback(client, pond_a, fc_a["id"])
    assert response.status_code == 201
    event = response.json()["data"]["event"]
    assert event["previous_demand_multiplier"] == 1.0
    assert event["updated_demand_multiplier"] == 1.05
    assert event["forecast_id"] == fc_a["id"] and event["pond_id"] == pond_a
    assert event["observed_at"] and event["created_at"]

    a = client.get(f"/api/v1/ponds/{pond_a}/calibration").json()["data"]
    b = client.get(f"/api/v1/ponds/{pond_b}/calibration").json()["data"]
    assert a["calibration"]["demand_multiplier"] == 1.05 and len(a["events"]) == 1
    assert b["calibration"]["demand_multiplier"] == 1.0 and b["events"] == []

    after_b = _forecast(client, pond_b, scenario="clear_calm_night")
    assert after_b["hourly"] == before_b["hourly"]
    after_a = _forecast(client, pond_a, scenario="clear_calm_night")
    assert after_a["calibration_applied"]["demand_multiplier"] == 1.05


def test_feedback_validation(client: TestClient) -> None:
    pond_a, pond_b = _pond(client, "A"), _pond(client, "B")
    fc_a = _forecast(client, pond_a)
    wrong_pond = _feedback(client, pond_b, fc_a["id"])
    assert wrong_pond.status_code == 422
    unknown = _feedback(client, pond_a, "fc_missing")
    assert unknown.status_code == 404
    early = client.post(f"/api/v1/ponds/{pond_a}/feedback", json={
        "forecast_id": fc_a["id"], "observation": "no_stress_seen", "observed_at": "2026-09-29T06:00:00+05:30"})
    assert early.status_code == 422
    after_app_clock = client.post(f"/api/v1/ponds/{pond_a}/feedback", json={
        "forecast_id": fc_a["id"], "observation": "no_stress_seen", "observed_at": "2026-10-05T06:00:00+05:30"})
    assert after_app_clock.status_code == 422
    assert after_app_clock.json()["error"]["code"] == "invalid_input"
    bad_obs = _feedback(client, pond_a, fc_a["id"], observation="fish_happy")
    assert bad_obs.status_code == 422
    assert _feedback(client, pond_a, fc_a["id"]).status_code == 201
    duplicate = _feedback(client, pond_a, fc_a["id"])
    assert duplicate.status_code == 409


def test_seeded_calibration_is_auditable(seeded_client: TestClient) -> None:
    data = seeded_client.get("/api/v1/ponds/pond_demo_001/calibration").json()["data"]
    assert data["calibration"]["feedback_count"] == 1
    event = data["events"][0]
    assert event["updated_demand_multiplier"] - event["previous_demand_multiplier"] == pytest.approx(event["delta"])
    assert "retrain" in data["calibration"]["limitations"]
