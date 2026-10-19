"""Application context: the dependencies every service needs, built once and injectable in tests."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from app.config import Settings
from app.providers.base import AlertProvider
from app.providers.mock import MockAlertProvider
from app.services.water_rules import ThresholdProfile, load_profile
from app.services.weather import LiveWeatherProvider, OpenMeteoProvider
from app.storage.db import Database
from app.utils import Clock, new_id, utc_now

TEMPLATES_PATH = Path(__file__).resolve().parent / "config_data" / "alert_templates.json"


def load_templates(path: Path = TEMPLATES_PATH) -> dict[str, Any]:
    with open(path, encoding="utf-8") as fh:
        data: dict[str, Any] = json.load(fh)
    return data


@dataclass
class AppContext:
    settings: Settings
    db: Database
    thresholds: ThresholdProfile
    templates: dict[str, Any]
    alert_provider: AlertProvider
    live_weather: LiveWeatherProvider | None
    clock: Clock = field(default=utc_now)
    ids: Callable[[str], str] = field(default=new_id)  # seed script injects deterministic IDs


def build_context(
    settings: Settings,
    *,
    alert_provider: AlertProvider | None = None,
    live_weather: LiveWeatherProvider | None = None,
    clock: Clock | None = None,
) -> AppContext:
    if alert_provider is None:
        if settings.alert_provider != "mock":  # guarded by Settings too; real providers do not exist yet
            raise ValueError(f"alert provider '{settings.alert_provider}' is not implemented")
        alert_provider = MockAlertProvider()
    if live_weather is None and settings.weather_provider == "open_meteo":
        live_weather = OpenMeteoProvider(settings.open_meteo_base_url, settings.open_meteo_timeout_seconds)
    return AppContext(
        settings=settings,
        db=Database(settings.database_file),
        thresholds=load_profile(),
        templates=load_templates(),
        alert_provider=alert_provider,
        live_weather=live_weather,
        clock=clock or utc_now,
    )
