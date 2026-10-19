from __future__ import annotations

import socket
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.context import AppContext


@pytest.fixture
def alert_id(client: TestClient, pond_id: str) -> str:
    data = client.post(f"/api/v1/ponds/{pond_id}/forecast", json={
        "forecast_date": "2026-10-01", "scenario": "hot_humid_still", "aerator_planned": False}).json()["data"]
    assert data["alert_id"]
    return str(data["alert_id"])


@pytest.fixture
def no_network(monkeypatch: pytest.MonkeyPatch) -> None:
    def refuse(*args: Any, **kwargs: Any) -> None:
        raise AssertionError("network access attempted during a mock delivery")

    monkeypatch.setattr(socket.socket, "connect", refuse)
    monkeypatch.setattr(socket, "create_connection", refuse)


def test_alert_has_bilingual_content(client: TestClient, alert_id: str) -> None:
    alert = client.get(f"/api/v1/alerts/{alert_id}").json()["data"]
    assert alert["message"]["en"].startswith("MeenMitra DEMO")
    assert "ಮೀನ್‌ಮಿತ್ರ" in alert["message"]["kn"]
    assert alert["voice_script"]["kn"].startswith("ಇದು ಮೀನ್‌ಮಿತ್ರ ಡೆಮೊ ಕರೆ")
    assert alert["template_review_status"] == "unreviewed_draft"


def test_simulated_send_records_attempts_without_network(
    client: TestClient, ctx: AppContext, alert_id: str, no_network: None
) -> None:
    response = client.post(f"/api/v1/alerts/{alert_id}/simulate-send",
                           json={"channels": ["whatsapp", "sms", "voice"], "language": "kn"})
    assert response.status_code == 200
    result = response.json()["data"]
    assert "No WhatsApp message, SMS or phone call was sent" in result["notice"]
    assert result["alert"]["status"] == "sent"
    attempts = result["attempts"]
    assert [a["channel"] for a in attempts] == ["whatsapp", "sms", "voice"]
    for attempt in attempts:
        assert attempt["status"] == "simulated_delivered"
        assert attempt["provider_mode"] == "mock"
        assert attempt["simulated"] is True
        assert attempt["external_request_made"] is False
        assert attempt["recipient_masked"].endswith("0099")
        assert attempt["language"] == "kn"
        assert attempt["attempted_at"]
    assert attempts[2]["simulated_call_duration_s"] > 0
    assert "+910000000099" not in response.text
    assert len(ctx.alert_provider.sent) == 3  # type: ignore[attr-defined]


def test_resend_skips_already_delivered_channels(client: TestClient, alert_id: str) -> None:
    client.post(f"/api/v1/alerts/{alert_id}/simulate-send", json={"channels": ["whatsapp"]})
    again = client.post(f"/api/v1/alerts/{alert_id}/simulate-send", json={"channels": ["whatsapp"]}).json()["data"]
    assert again["attempts"] == []
    assert len(again["alert"]["deliveries"]) == 1


def test_simulated_failure_and_retry(client: TestClient, alert_id: str) -> None:
    url = f"/api/v1/alerts/{alert_id}/simulate-send"
    first = client.post(url, json={"channels": ["sms"], "simulate_failure_channels": ["sms"]}).json()["data"]
    assert first["alert"]["status"] == "failed"
    failed = first["attempts"][0]
    assert failed["status"] == "simulated_failed"
    assert failed["error"]["code"] == "simulated_failure"
    assert failed["retry_allowed"] is True and failed["attempt_number"] == 1

    second = client.post(url, json={"channels": ["sms"]}).json()["data"]
    assert second["attempts"][0]["attempt_number"] == 2
    assert second["attempts"][0]["status"] == "simulated_delivered"
    assert second["alert"]["status"] == "sent"


def test_retries_are_bounded(client: TestClient, alert_id: str) -> None:
    url = f"/api/v1/alerts/{alert_id}/simulate-send"
    body = {"channels": ["sms"], "simulate_failure_channels": ["sms"]}
    for _ in range(3):
        assert client.post(url, json=body).status_code == 200
    blocked = client.post(url, json=body)
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "conflict"


def test_pond_without_phone_records_no_recipient_failure(client: TestClient) -> None:
    pond = client.post("/api/v1/ponds", json={
        "name": "No phone", "farmer_name": "F", "district": "Udupi", "village_cluster": "C",
        "area_m2": 500, "depth_m": 0.8, "species": "tilapia", "estimated_biomass_kg": 600}).json()["data"]
    fc = client.post(f"/api/v1/ponds/{pond['id']}/forecast", json={"scenario": "hot_humid_still"}).json()["data"]
    result = client.post(f"/api/v1/alerts/{fc['alert_id']}/simulate-send", json={}).json()["data"]
    assert result["attempts"][0]["error"]["code"] == "no_recipient"
    assert result["attempts"][0]["recipient_masked"] is None
    assert result["alert"]["status"] == "failed"


def test_acknowledge(client: TestClient, alert_id: str) -> None:
    response = client.post(f"/api/v1/alerts/{alert_id}/acknowledge",
                           json={"response": "action_taken", "channel": "whatsapp", "note": "Aerator on"})
    assert response.status_code == 200
    alert = response.json()["data"]
    assert alert["status"] == "acknowledged"
    assert alert["acknowledgement"]["acknowledged_at"]
    assert alert["acknowledgement"]["response"] == "action_taken"

    again = client.post(f"/api/v1/alerts/{alert_id}/acknowledge", json={})
    assert again.status_code == 409
    send_after = client.post(f"/api/v1/alerts/{alert_id}/simulate-send", json={})
    assert send_after.status_code == 409


def test_alert_validation_and_not_found(client: TestClient, alert_id: str) -> None:
    assert client.post(f"/api/v1/alerts/{alert_id}/simulate-send",
                       json={"channels": ["telegram"]}).status_code == 422
    assert client.post(f"/api/v1/alerts/{alert_id}/simulate-send",
                       json={"channels": ["sms", "sms"]}).status_code == 422
    assert client.post(f"/api/v1/alerts/{alert_id}/acknowledge",
                       json={"response": "maybe"}).status_code == 422
    missing = client.post("/api/v1/alerts/alert_missing/acknowledge", json={})
    assert missing.status_code == 404 and missing.json()["error"]["code"] == "not_found"


def test_alert_list_filters(seeded_client: TestClient) -> None:
    all_alerts = seeded_client.get("/api/v1/alerts").json()
    assert all_alerts["meta"]["pagination"]["total"] == len(all_alerts["data"]) > 0
    danger = seeded_client.get("/api/v1/alerts?severity=danger").json()["data"]
    assert danger and all(a["severity"] == "danger" for a in danger)
    acked = seeded_client.get("/api/v1/alerts?status=acknowledged").json()["data"]
    assert all(a["acknowledgement"] for a in acked)
    by_pond = seeded_client.get("/api/v1/alerts?pond_id=pond_demo_002").json()["data"]
    assert by_pond and {a["pond_id"] for a in by_pond} == {"pond_demo_002"}
    assert seeded_client.get("/api/v1/alerts?status=bogus").status_code == 422
