from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.conftest import VALID_POND


def test_create_and_retrieve_pond(client: TestClient) -> None:
    created = client.post("/api/v1/ponds", json=VALID_POND)
    assert created.status_code == 201
    body = created.json()
    pond = body["data"]
    assert pond["id"].startswith("pond_")
    assert pond["is_demo_record"] is False
    assert body["meta"]["demo_mode"] is True
    assert pond["latest_status"]["overall_status"] is None
    assert pond["calibration"] == {"demand_multiplier": 1.0, "feedback_count": 0}

    fetched = client.get(f"/api/v1/ponds/{pond['id']}").json()["data"]
    assert fetched["name"] == "Test Pond"
    listed = client.get("/api/v1/ponds").json()
    assert [p["id"] for p in listed["data"]] == [pond["id"]]


def test_phone_number_is_masked_in_responses(client: TestClient) -> None:
    response = client.post("/api/v1/ponds", json=VALID_POND)
    assert "+910000000099" not in response.text
    assert response.json()["data"]["contact_phone_masked"].endswith("0099")


@pytest.mark.parametrize(
    "change",
    [
        {"area_m2": -5},
        {"depth_m": 0},
        {"contact_phone": "12345"},
        {"species": "goldfish"},
        {"alert_channels": []},
        {"alert_channels": ["sms", "sms"]},
        {"stocking_date": "2999-01-01"},
        {"has_aerator": False, "aerator_count": 2},
        {"unexpected_field": 1},
        {"name": ""},
    ],
)
def test_invalid_pond_payloads_are_rejected(client: TestClient, change: dict[str, Any]) -> None:
    response = client.post("/api/v1/ponds", json={**VALID_POND, **change})
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["details"]


def test_missing_required_fields(client: TestClient) -> None:
    response = client.post("/api/v1/ponds", json={"name": "x"})
    assert response.status_code == 422
    missing = {tuple(d["loc"]) for d in response.json()["error"]["details"]}
    assert ("body", "district") in missing


def test_update_pond(client: TestClient, pond_id: str) -> None:
    response = client.patch(f"/api/v1/ponds/{pond_id}", json={"depth_m": 1.6, "has_aerator": False})
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["depth_m"] == 1.6
    assert data["has_aerator"] is False and data["aerator_count"] == 0


def test_update_rejects_null_for_required_field(client: TestClient, pond_id: str) -> None:
    response = client.patch(f"/api/v1/ponds/{pond_id}", json={"name": None})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_input"


def test_unknown_pond_returns_404_envelope(client: TestClient) -> None:
    for response in (client.get("/api/v1/ponds/pond_missing"),
                     client.patch("/api/v1/ponds/pond_missing", json={"depth_m": 1}),
                     client.post("/api/v1/ponds/pond_missing/forecast", json={})):
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "not_found"


def test_pagination(seeded_client: TestClient) -> None:
    page = seeded_client.get("/api/v1/ponds?limit=2&offset=2").json()
    assert page["meta"]["pagination"] == {"total": 6, "limit": 2, "offset": 2}
    assert [p["id"] for p in page["data"]] == ["pond_demo_003", "pond_demo_004"]
    assert seeded_client.get("/api/v1/ponds?limit=0").status_code == 422
