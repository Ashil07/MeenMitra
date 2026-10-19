from __future__ import annotations

import copy
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.services.water_rules import evaluate, load_profile, unionized_ammonia_fraction, validate_profile

PROFILE = load_profile()


def statuses(result: Any) -> dict[str, str]:
    return {o.rule_id: o.status for o in result.evaluated}


@pytest.mark.parametrize(
    ("ph", "expected"),
    [(5.9, "danger"), (6.0, "watch"), (6.49, "watch"), (6.5, "safe"), (8.99, "safe"), (9.0, "watch"), (9.5, "danger")],
)
def test_ph_band_boundaries(ph: float, expected: str) -> None:
    assert evaluate({"ph": ph}, [], PROFILE).overall_status == expected


@pytest.mark.parametrize(("do", "expected"), [(2.9, "danger"), (3.0, "watch"), (4.99, "watch"), (5.0, "safe")])
def test_dissolved_oxygen_bands(do: float, expected: str) -> None:
    assert evaluate({"dissolved_oxygen_mg_l": do}, [], PROFILE).overall_status == expected


def test_unionized_ammonia_fraction_matches_emerson_reference() -> None:
    # Emerson et al. (1975) tables: ~0.57% at pH 7.0 / 25 °C and ~5.4% at pH 8.0 / 25 °C.
    assert unionized_ammonia_fraction(7.0, 25.0) == pytest.approx(0.0057, abs=0.0003)
    assert unionized_ammonia_fraction(8.0, 25.0) == pytest.approx(0.054, abs=0.003)


def test_ammonia_uses_derived_nh3_when_ph_and_temperature_present() -> None:
    low_ph = evaluate({"total_ammonia_mg_l": 1.5, "ph": 7.0, "water_temp_c": 28.0}, [], PROFILE)
    high_ph = evaluate({"total_ammonia_mg_l": 1.5, "ph": 8.8, "water_temp_c": 28.0}, [], PROFILE)
    assert statuses(low_ph)["unionized_ammonia_mg_l_band"] == "safe"
    assert statuses(high_ph)["unionized_ammonia_mg_l_band"] == "danger"
    assert high_ph.derived["unionized_ammonia_mg_l"] is not None


def test_ammonia_falls_back_to_tan_band_when_ph_missing() -> None:
    result = evaluate({"total_ammonia_mg_l": 1.5}, [], PROFILE)
    assert statuses(result) == {"total_ammonia_mg_l_band": "watch"}
    assert result.derived["unionized_ammonia_mg_l"] is None
    assert "fallback" in result.evaluated[0].explanation


def test_missing_parameters_are_reported() -> None:
    result = evaluate({"ph": 7.5}, [], PROFILE)
    assert result.overall_status == "safe"
    assert set(result.missing_parameters) == {"water_temp_c", "total_ammonia_mg_l", "nitrite_mg_l",
                                              "dissolved_oxygen_mg_l"}
    assert any("Not measured" in step for step in result.next_steps)


def test_symptom_rules_and_referral() -> None:
    gasping = evaluate({}, ["gasping_at_surface"], PROFILE)
    assert gasping.overall_status == "danger"
    lesions = evaluate({}, ["red_patches_or_lesions"], PROFILE)
    assert lesions.overall_status == "watch"
    assert "not a diagnosis" in lesions.referral.lower()
    assert any("Do not start medication" in s for s in lesions.next_steps)
    several = evaluate({}, ["white_spots", "fin_or_tail_rot"], PROFILE)
    assert several.overall_status == "danger"
    assert "multiple_disease_signs" in statuses(several)


def test_triggered_rules_explain_why() -> None:
    result = evaluate({"ph": 9.7, "nitrite_mg_l": 0.1}, [], PROFILE)
    assert [o.rule_id for o in result.triggered] == ["ph_band"]
    assert "9.7" in result.triggered[0].explanation
    assert result.triggered[0].unit == "pH units"


def test_profile_validation_rejects_bad_bands() -> None:
    raw = copy.deepcopy(PROFILE.raw)
    raw["parameters"]["ph"]["bands"][1]["min"] = 6.1
    with pytest.raises(ValueError):
        validate_profile(raw)
    raw = copy.deepcopy(PROFILE.raw)
    raw["status"] = "production"
    with pytest.raises(ValueError):
        validate_profile(raw)


def test_profile_is_labelled_as_demonstration_settings() -> None:
    assert PROFILE.info()["status"] == "demonstration_settings"
    assert PROFILE.info()["validated"] is False


def test_water_check_api(client: TestClient, pond_id: str) -> None:
    response = client.post(f"/api/v1/ponds/{pond_id}/water-check", json={
        "ph": 8.6, "water_temp_c": 30.5, "total_ammonia_mg_l": 1.2, "symptoms": ["reduced_feeding"],
        "observed_at": "2026-10-01T05:00:00+05:30"})
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["overall_status"] == "danger"
    assert data["threshold_profile"]["status"] == "demonstration_settings"
    assert data["alert_id"]
    assert "nitrite_mg_l" in data["missing_parameters"]
    alert = client.get(f"/api/v1/alerts/{data['alert_id']}").json()["data"]
    assert alert["source_type"] == "water_check"
    assert "ammonia" in alert["message"]["en"]
    pond = client.get(f"/api/v1/ponds/{pond_id}").json()["data"]
    assert pond["latest_status"]["water_status"] == "danger"


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"ph": 15},
        {"ph": -1},
        {"symptoms": ["purple_scales"]},
        {"symptoms": ["lethargy", "lethargy"]},
        {"ph": 7, "observed_at": "2999-01-01T00:00:00+00:00"},
        {"ph": 7, "observed_at": "2026-10-01T00:00:00"},
        {"ph": "acidic"},
    ],
)
def test_water_check_validation(client: TestClient, pond_id: str, body: dict[str, Any]) -> None:
    response = client.post(f"/api/v1/ponds/{pond_id}/water-check", json=body)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_water_check_rejects_time_after_app_clock(client: TestClient, pond_id: str) -> None:
    response = client.post(f"/api/v1/ponds/{pond_id}/water-check",
                           json={"ph": 7, "observed_at": "2026-10-05T06:00:00+05:30"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_input"
