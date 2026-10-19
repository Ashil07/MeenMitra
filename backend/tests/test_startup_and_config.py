from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.context import build_context
from app.factory import create_app
from tests.conftest import fixed_clock, make_settings


def test_starts_and_seeds_without_any_credentials(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    for key in list(os.environ):
        if key.endswith(("_API_KEY", "_TOKEN", "_SECRET")) or key.startswith(("TWILIO", "KAGGLE")):
            monkeypatch.delenv(key, raising=False)
    settings = make_settings(tmp_path, seed_on_startup=True)
    with TestClient(create_app(settings)) as client:
        health = client.get("/health")
        assert health.status_code == 200
        body = health.json()
        assert body["status"] == "ok"
        assert body["external_credentials_required"] is False
        assert "mock" in body["alert_provider"]
        ponds = client.get("/api/v1/ponds").json()
        assert ponds["meta"]["pagination"]["total"] == 6
        assert all(p["is_demo_record"] for p in ponds["data"])
        assert client.get("/api/v1/health").status_code == 200


def test_seed_on_startup_can_be_disabled(client: TestClient) -> None:
    assert client.get("/api/v1/ponds").json()["data"] == []


def test_cors_allows_configured_origin_only(tmp_path: Path) -> None:
    settings = make_settings(tmp_path, cors_origins="http://localhost:3000")
    with TestClient(create_app(ctx=build_context(settings, clock=fixed_clock))) as client:
        ok = client.options("/api/v1/ponds", headers={"Origin": "http://localhost:3000",
                                                      "Access-Control-Request-Method": "GET"})
        assert ok.headers.get("access-control-allow-origin") == "http://localhost:3000"
        other = client.get("/api/v1/ponds", headers={"Origin": "http://evil.example"})
        assert "access-control-allow-origin" not in other.headers


def test_settings_reject_wildcard_cors_and_inverted_thresholds(tmp_path: Path) -> None:
    with pytest.raises(ValidationError):
        make_settings(tmp_path, cors_origins="*")
    with pytest.raises(ValidationError):
        make_settings(tmp_path, risk_watch_threshold=80, risk_danger_threshold=70)


def test_unknown_alert_provider_is_rejected(tmp_path: Path) -> None:
    with pytest.raises(ValidationError):
        make_settings(tmp_path, alert_provider="twilio")


def test_unknown_route_uses_error_envelope(client: TestClient) -> None:
    response = client.get("/api/v1/does-not-exist")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_openapi_schema_is_generated(client: TestClient) -> None:
    schema = client.get("/openapi.json").json()
    for path in ["/api/v1/dashboard/summary", "/api/v1/ponds", "/api/v1/ponds/{pond_id}",
                 "/api/v1/ponds/{pond_id}/forecast", "/api/v1/ponds/{pond_id}/water-check", "/api/v1/alerts",
                 "/api/v1/alerts/{alert_id}/simulate-send", "/api/v1/alerts/{alert_id}/acknowledge",
                 "/api/v1/ml/status", "/api/v1/approach"]:
        assert path in schema["paths"], path
