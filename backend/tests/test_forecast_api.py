from __future__ import annotations

from datetime import date
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.context import AppContext
from app.factory import create_app
from app.services.weather import LiveWeather, WeatherUnavailable, parse_open_meteo


def forecast(client: TestClient, pond_id: str, **body: Any) -> dict[str, Any]:
    response = client.post(f"/api/v1/ponds/{pond_id}/forecast", json={"forecast_date": "2026-10-01", **body})
    assert response.status_code == 201, response.text
    data: dict[str, Any] = response.json()["data"]
    return data


def test_forecast_response_contract(client: TestClient, pond_id: str) -> None:
    data = forecast(client, pond_id)
    assert data["pond_id"] == pond_id and data["id"].startswith("fc_")
    assert len(data["hourly"]) == 13
    assert data["hourly"][0]["timestamp"].endswith("+05:30")
    assert data["hourly"][0]["local_time"] == "18:00" and data["hourly"][-1]["local_time"] == "06:00"
    assert {p["value_type"] for p in data["hourly"]} == {"synthetic_model_output"}
    prov = data["provenance"]
    assert prov["simulation"] is True
    assert prov["output_type"] == "relative_risk_index"
    assert prov["calibrated_to_measured_do"] is False
    assert prov["ml_correction"]["applied"] is False
    assert prov["weather_source"] == "scenario_preset"
    assert data["summary"]["overall_status"] in {"safe", "watch", "danger"}
    assert data["factors"] and all("explanation" in f for f in data["factors"])
    assert all(a["limitation"] for a in data["actions"])
    assert "not a measured or predicted dissolved-oxygen value" in data["disclaimer"]
    # The output never claims a DO concentration.
    assert not any("mg" in key for p in data["hourly"] for key in p)


def test_forecast_is_deterministic_for_same_inputs(client: TestClient, pond_id: str) -> None:
    a = forecast(client, pond_id, scenario="overcast_still_night", create_alert=False)
    b = forecast(client, pond_id, scenario="overcast_still_night", create_alert=False)
    assert a["id"] != b["id"]
    assert a["hourly"] == b["hourly"]
    assert a["factors"] == b["factors"]
    assert a["provenance"]["inputs_hash"] == b["provenance"]["inputs_hash"]


def test_forecast_changes_with_scenario_and_inputs(client: TestClient, pond_id: str) -> None:
    calm = forecast(client, pond_id, scenario="windy_clear_night", aerator_planned=False)
    still = forecast(client, pond_id, scenario="overcast_still_night", aerator_planned=False)
    aerated = forecast(client, pond_id, scenario="overcast_still_night", aerator_planned=True)
    assert still["summary"]["mean_risk_index"] > calm["summary"]["mean_risk_index"]
    assert aerated["summary"]["mean_risk_index"] < still["summary"]["mean_risk_index"]
    assert still["provenance"]["inputs_hash"] != calm["provenance"]["inputs_hash"]


def test_weather_overrides_are_applied_and_labelled(client: TestClient, pond_id: str) -> None:
    data = forecast(client, pond_id, weather={"wind_speed_ms": 7.5})
    assert data["resolved_inputs"]["weather"]["wind_speed_ms"] == 7.5
    assert data["resolved_inputs"]["weather_value_sources"]["wind_speed_ms"] == "user_override"
    assert data["resolved_inputs"]["weather_value_sources"]["cloud_cover_pct"] == "scenario_preset"
    assert data["provenance"]["weather_source"] == "scenario_with_overrides"
    wind = next(f for f in data["factors"] if f["key"] == "wind")
    assert wind["value_source"] == "user_override"


@pytest.mark.parametrize(
    "body",
    [
        {"scenario": "sunny_forever"},
        {"weather": {"wind_speed_ms": -1}},
        {"weather": {"cloud_cover_pct": 150}},
        {"weather": {"air_temp_evening_c": 25, "air_temp_min_c": 30}},
        {"start_hour": 12},
        {"water": {"dissolved_oxygen_mg_l": 40}},
        {"feeding_plan": "double"},
    ],
)
def test_invalid_forecast_requests(client: TestClient, pond_id: str, body: dict[str, Any]) -> None:
    response = client.post(f"/api/v1/ponds/{pond_id}/forecast", json=body)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_override_conflicting_with_preset_is_rejected(client: TestClient, pond_id: str) -> None:
    # clear_calm_night preset has evening 29 °C; a 30 °C minimum conflicts with it.
    response = client.post(f"/api/v1/ponds/{pond_id}/forecast", json={"weather": {"air_temp_min_c": 30}})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_input"


def test_aerator_planned_without_aerators_is_rejected(client: TestClient) -> None:
    pond = client.post("/api/v1/ponds", json={
        "name": "No aerator", "farmer_name": "F", "district": "Udupi", "village_cluster": "C",
        "area_m2": 500, "depth_m": 1, "species": "tilapia"}).json()["data"]
    response = client.post(f"/api/v1/ponds/{pond['id']}/forecast", json={"aerator_planned": True})
    assert response.status_code == 422


def test_missing_data_is_reported(client: TestClient) -> None:
    pond = client.post("/api/v1/ponds", json={
        "name": "Sparse", "farmer_name": "F", "district": "Udupi", "village_cluster": "C",
        "area_m2": 500, "depth_m": 1, "species": "tilapia"}).json()["data"]
    data = forecast(client, pond["id"])
    text = " ".join(data["missing_data"])
    assert "estimated_biomass_kg" in text and "Water temperature" in text
    density = next(f for f in data["factors"] if f["key"] == "stocking_density")
    assert density["value_source"] == "default_assumption"


def test_forecast_creates_alert_only_for_watch_or_danger(client: TestClient, pond_id: str) -> None:
    risky = forecast(client, pond_id, scenario="hot_humid_still", aerator_planned=False)
    assert risky["summary"]["overall_status"] in {"watch", "danger"}
    assert risky["alert_id"]
    alert = client.get(f"/api/v1/alerts/{risky['alert_id']}").json()["data"]
    assert alert["source_type"] == "forecast" and alert["source_id"] == risky["id"]
    assert alert["status"] == "pending"

    calm = forecast(client, pond_id, scenario="windy_clear_night")
    assert calm["summary"]["overall_status"] == "safe" and calm["alert_id"] is None

    suppressed = forecast(client, pond_id, scenario="hot_humid_still", aerator_planned=False, create_alert=False)
    assert suppressed["alert_id"] is None


def test_forecast_retrievable_and_listed(client: TestClient, pond_id: str) -> None:
    data = forecast(client, pond_id)
    assert client.get(f"/api/v1/forecasts/{data['id']}").json()["data"]["hourly"] == data["hourly"]
    listed = client.get(f"/api/v1/ponds/{pond_id}/forecasts").json()
    assert listed["meta"]["pagination"]["total"] == 1
    pond = client.get(f"/api/v1/ponds/{pond_id}").json()["data"]
    assert pond["latest_status"]["forecast_id"] == data["id"]


def test_live_weather_requested_in_demo_mode_falls_back(client: TestClient, pond_id: str) -> None:
    data = forecast(client, pond_id, use_live_weather=True)
    assert data["provenance"]["weather_source"] == "demo_fallback"
    assert "WEATHER_PROVIDER" in data["provenance"]["weather_fallback_reason"]


class FakeLive:
    def __init__(self, fail: bool = False) -> None:
        self.fail = fail

    def fetch(self, district: str, forecast_date: date, start_hour: int, end_hour: int) -> LiveWeather:
        if self.fail:
            raise WeatherUnavailable("network down (test)")
        return LiveWeather({"air_temp_evening_c": 30.0, "air_temp_min_c": 26.0, "cloud_cover_pct": 70.0,
                            "sunshine_hours_today": 3.0, "wind_speed_ms": 0.8, "rainfall_mm": 1.0}, "fake")


@pytest.mark.parametrize(("fail", "expected"), [(False, "open_meteo"), (True, "demo_fallback")])
def test_live_weather_provider_and_fallback(ctx: AppContext, fail: bool, expected: str) -> None:
    ctx.live_weather = FakeLive(fail)
    with TestClient(create_app(ctx=ctx)) as client:
        pond = client.post("/api/v1/ponds", json={
            "name": "P", "farmer_name": "F", "district": "Udupi", "village_cluster": "C",
            "area_m2": 500, "depth_m": 1, "species": "tilapia"}).json()["data"]
        data = forecast(client, pond["id"], use_live_weather=True)
    assert data["provenance"]["weather_source"] == expected
    if fail:
        assert "network down" in data["provenance"]["weather_fallback_reason"]
    else:
        assert data["resolved_inputs"]["weather"]["cloud_cover_pct"] == 70.0


def test_parse_open_meteo_payload() -> None:
    times = [f"2026-10-01T{h:02d}:00" for h in range(24)] + [f"2026-10-02T{h:02d}:00" for h in range(24)]
    payload = {
        "hourly": {
            "time": times,
            "temperature_2m": [28.0 - (i % 24) * 0.1 for i in range(48)],
            "cloud_cover": [50.0] * 48,
            "wind_speed_10m": [2.0] * 48,
            "precipitation": [0.5] * 48,
        },
        "daily": {"sunshine_duration": [21600.0, 30000.0]},
    }
    parsed = parse_open_meteo(payload, date(2026, 10, 1), 18, 6)
    assert parsed["cloud_cover_pct"] == 50.0
    assert parsed["sunshine_hours_today"] == 6.0
    assert parsed["rainfall_mm"] == 6.5  # 13 hourly values of 0.5 mm
    assert parsed["air_temp_evening_c"] == 26.2
    with pytest.raises(WeatherUnavailable):
        parse_open_meteo({"hourly": {}}, date(2026, 10, 1), 18, 6)
