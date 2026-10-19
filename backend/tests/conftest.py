from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.context import AppContext, build_context
from app.factory import create_app
from app.storage.seed import seed

ANCHOR = datetime(2026, 10, 1, 4, 30, tzinfo=timezone.utc)  # 10:00 IST, safely in the past
NOW = ANCHOR + timedelta(minutes=30)


def fixed_clock() -> datetime:
    return NOW


def make_settings(tmp_path: Path, **overrides: object) -> Settings:
    values: dict[str, object] = {
        "database_path": str(tmp_path / "test.db"),
        "ml_data_dir": str(tmp_path / "raw"),
        "ml_artifacts_dir": str(tmp_path / "artifacts"),
        "seed_on_startup": False,
        "weather_provider": "demo",
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)  # type: ignore[call-arg]


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return make_settings(tmp_path)


@pytest.fixture
def ctx(settings: Settings) -> AppContext:
    return build_context(settings, clock=fixed_clock)


@pytest.fixture
def seeded_ctx(ctx: AppContext) -> AppContext:
    seed(ctx, ANCHOR)
    return ctx


@pytest.fixture
def client(ctx: AppContext) -> Iterator[TestClient]:
    with TestClient(create_app(ctx=ctx)) as c:
        yield c


@pytest.fixture
def seeded_client(seeded_ctx: AppContext) -> Iterator[TestClient]:
    with TestClient(create_app(ctx=seeded_ctx)) as c:
        yield c


VALID_POND = {
    "name": "Test Pond",
    "farmer_name": "Test Farmer",
    "contact_phone": "+910000000099",
    "district": "Udupi",
    "village_cluster": "Test Cluster",
    "area_m2": 1500,
    "depth_m": 1.2,
    "species": "tilapia",
    "estimated_biomass_kg": 900,
    "has_aerator": True,
    "aerator_count": 1,
    "preferred_language": "en",
    "alert_channels": ["whatsapp", "sms"],
}


@pytest.fixture
def pond_id(client: TestClient) -> str:
    response = client.post("/api/v1/ponds", json=VALID_POND)
    assert response.status_code == 201, response.text
    return str(response.json()["data"]["id"])
