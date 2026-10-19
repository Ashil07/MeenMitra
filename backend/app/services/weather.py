"""Weather inputs for the demo forecast.

Default: offline scenario presets (synthetic). Optional: Open-Meteo forecast API, used only when
WEATHER_PROVIDER=open_meteo AND the request asks for live weather. Any Open-Meteo failure falls
back to the scenario preset and the reason is reported in forecast provenance.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Protocol

import httpx

from app.errors import InvalidInputError

logger = logging.getLogger(__name__)

WEATHER_FIELDS = (
    "air_temp_evening_c",
    "air_temp_min_c",
    "cloud_cover_pct",
    "sunshine_hours_today",
    "wind_speed_ms",
    "rainfall_mm",
)

# Synthetic presets chosen to illustrate how weather shifts the demo risk index. Not observations.
SCENARIOS: dict[str, dict[str, Any]] = {
    "clear_calm_night": {
        "label": "Clear, calm night",
        "description": "Sunny day, light wind overnight. Typical of post-monsoon dry spells.",
        "weather": {"air_temp_evening_c": 29.0, "air_temp_min_c": 25.0, "cloud_cover_pct": 15.0,
                    "sunshine_hours_today": 9.0, "wind_speed_ms": 1.0, "rainfall_mm": 0.0},
    },
    "overcast_still_night": {
        "label": "Overcast day, still night",
        "description": "Heavy cloud limits daytime photosynthesis; almost no wind overnight.",
        "weather": {"air_temp_evening_c": 28.0, "air_temp_min_c": 26.0, "cloud_cover_pct": 90.0,
                    "sunshine_hours_today": 2.0, "wind_speed_ms": 0.5, "rainfall_mm": 2.0},
    },
    "monsoon_heavy_rain": {
        "label": "Monsoon heavy rain",
        "description": "Continuous cloud and heavy rain with moderate wind.",
        "weather": {"air_temp_evening_c": 26.0, "air_temp_min_c": 24.0, "cloud_cover_pct": 100.0,
                    "sunshine_hours_today": 0.5, "wind_speed_ms": 4.0, "rainfall_mm": 60.0},
    },
    "windy_clear_night": {
        "label": "Windy, clear night",
        "description": "Good sunshine and a steady sea breeze that mixes the pond surface.",
        "weather": {"air_temp_evening_c": 28.0, "air_temp_min_c": 24.0, "cloud_cover_pct": 20.0,
                    "sunshine_hours_today": 9.0, "wind_speed_ms": 6.0, "rainfall_mm": 0.0},
    },
    "hot_humid_still": {
        "label": "Hot, humid, still",
        "description": "Pre-monsoon heat with partial cloud and almost no wind.",
        "weather": {"air_temp_evening_c": 33.0, "air_temp_min_c": 29.0, "cloud_cover_pct": 60.0,
                    "sunshine_hours_today": 5.0, "wind_speed_ms": 0.3, "rainfall_mm": 0.0},
    },
}

# Approximate district centroids used only for the optional Open-Meteo lookup.
DISTRICT_COORDINATES: dict[str, tuple[float, float]] = {
    "Udupi": (13.34, 74.75),
    "Dakshina Kannada": (12.87, 74.88),
    "Uttara Kannada": (14.80, 74.13),
}


class WeatherUnavailable(Exception):
    pass


@dataclass(frozen=True)
class LiveWeather:
    values: dict[str, float]
    source_detail: str


class LiveWeatherProvider(Protocol):
    def fetch(self, district: str, forecast_date: date, start_hour: int, end_hour: int) -> LiveWeather: ...


class OpenMeteoProvider:
    """Thin client for https://open-meteo.com (free tier, non-commercial use, CC BY 4.0 data)."""

    def __init__(self, base_url: str, timeout_seconds: float) -> None:
        self.base_url = base_url
        self.timeout = timeout_seconds

    def fetch(self, district: str, forecast_date: date, start_hour: int, end_hour: int) -> LiveWeather:
        if district not in DISTRICT_COORDINATES:
            raise WeatherUnavailable(f"no coordinates configured for district '{district}'")
        lat, lon = DISTRICT_COORDINATES[district]
        params: dict[str, str | float] = {
            "latitude": lat,
            "longitude": lon,
            "hourly": "temperature_2m,cloud_cover,wind_speed_10m,precipitation",
            "daily": "sunshine_duration",
            "wind_speed_unit": "ms",
            "timezone": "Asia/Kolkata",
            "start_date": forecast_date.isoformat(),
            "end_date": (forecast_date + timedelta(days=1)).isoformat(),
        }
        try:
            response = httpx.get(self.base_url, params=params, timeout=self.timeout)
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise WeatherUnavailable(f"Open-Meteo request failed: {exc}") from exc
        return LiveWeather(parse_open_meteo(payload, forecast_date, start_hour, end_hour),
                           f"Open-Meteo forecast at district centroid {lat},{lon}")


def parse_open_meteo(payload: dict[str, Any], forecast_date: date, start_hour: int, end_hour: int) -> dict[str, float]:
    try:
        hourly = payload["hourly"]
        times: list[str] = hourly["time"]
        index = {t: i for i, t in enumerate(times)}
        next_day = forecast_date + timedelta(days=1)
        window = [f"{forecast_date.isoformat()}T{h:02d}:00" for h in range(start_hour, 24)] + [
            f"{next_day.isoformat()}T{h:02d}:00" for h in range(0, end_hour + 1)
        ]
        daytime = [f"{forecast_date.isoformat()}T{h:02d}:00" for h in range(6, 18)]
        idx = [index[t] for t in window]
        day_idx = [index[t] for t in daytime]

        def series(name: str, positions: list[int]) -> list[float]:
            values = [hourly[name][i] for i in positions]
            if any(v is None for v in values):
                raise WeatherUnavailable(f"Open-Meteo returned missing values for {name}")
            return [float(v) for v in values]

        temps = series("temperature_2m", idx)
        sunshine_s = payload["daily"]["sunshine_duration"][0]
        if sunshine_s is None:
            raise WeatherUnavailable("Open-Meteo returned no sunshine_duration")
        return {
            "air_temp_evening_c": round(temps[0], 1),
            "air_temp_min_c": round(min(temps), 1),
            "cloud_cover_pct": round(sum(series("cloud_cover", day_idx)) / len(day_idx), 1),
            "sunshine_hours_today": round(min(13.0, float(sunshine_s) / 3600.0), 1),
            "wind_speed_ms": round(sum(series("wind_speed_10m", idx)) / len(idx), 1),
            "rainfall_mm": round(sum(series("precipitation", idx)), 1),
        }
    except (KeyError, IndexError, TypeError) as exc:
        raise WeatherUnavailable(f"unexpected Open-Meteo response shape: {exc}") from exc


@dataclass(frozen=True)
class ResolvedWeather:
    values: dict[str, float]
    sources: dict[str, str]  # per field: scenario_preset | user_override | open_meteo
    weather_source: str
    fallback_reason: str | None


def resolve_weather(
    scenario: str,
    overrides: dict[str, float | None] | None,
    live_provider: LiveWeatherProvider | None,
    use_live: bool,
    district: str,
    forecast_date: date,
    start_hour: int,
    end_hour: int,
) -> ResolvedWeather:
    values = dict(SCENARIOS[scenario]["weather"])
    sources = {k: "scenario_preset" for k in values}
    weather_source = "scenario_preset"
    fallback_reason: str | None = None

    if use_live:
        if live_provider is None:
            weather_source = "demo_fallback"
            fallback_reason = "Live weather requested but WEATHER_PROVIDER is 'demo'; used scenario preset."
        else:
            try:
                live = live_provider.fetch(district, forecast_date, start_hour, end_hour)
                values.update(live.values)
                sources = {k: "open_meteo" for k in values}
                weather_source = "open_meteo"
            except WeatherUnavailable as exc:
                logger.warning("Live weather unavailable, falling back to scenario preset: %s", exc)
                weather_source = "demo_fallback"
                fallback_reason = str(exc)

    applied_override = False
    for key, value in (overrides or {}).items():
        if value is not None:
            values[key] = float(value)
            sources[key] = "user_override"
            applied_override = True
    if applied_override and weather_source == "scenario_preset":
        weather_source = "scenario_with_overrides"
    if values["air_temp_min_c"] > values["air_temp_evening_c"]:
        # A partial override can conflict with the preset values; reject rather than guess.
        raise InvalidInputError(
            "air_temp_min_c is above air_temp_evening_c after applying overrides to the scenario",
            details={"resolved_weather": values},
        )
    return ResolvedWeather(values, sources, weather_source, fallback_reason)
