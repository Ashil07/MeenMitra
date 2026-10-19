from __future__ import annotations

from dataclasses import replace
from datetime import date, timedelta

import pytest

from app.services.forecast_engine import EngineInputs, classify, factor_contributions, simulate, window_timestamps
from app.utils import IST

BASE = EngineInputs(
    forecast_date=date(2026, 10, 1),
    start_hour=18,
    end_hour=6,
    air_temp_evening_c=29.0,
    air_temp_min_c=25.0,
    cloud_cover_pct=15.0,
    sunshine_hours_today=9.0,
    wind_speed_ms=1.0,
    rainfall_mm=0.0,
    area_m2=1500.0,
    depth_m=1.2,
    biomass_kg=900.0,
    aerator_count=1,
    aerator_planned=False,
    feeding_plan="normal",
    water_temp_c=None,
    observed_do_mg_l=None,
)


def test_deterministic_for_identical_inputs() -> None:
    first, second = simulate(BASE), simulate(replace(BASE))
    assert first == second
    assert factor_contributions(BASE) == factor_contributions(BASE)


def test_hourly_shape_and_timestamps() -> None:
    result = simulate(BASE)
    assert len(result.points) == 13  # 18:00 .. 06:00 inclusive
    first, last = result.points[0].timestamp, result.points[-1].timestamp
    assert first.utcoffset() == timedelta(hours=5, minutes=30)
    assert (first.hour, last.hour) == (18, 6)
    assert last.date() == BASE.forecast_date + timedelta(days=1)
    gaps = {b.timestamp - a.timestamp for a, b in zip(result.points, result.points[1:])}
    assert gaps == {timedelta(hours=1)}
    assert [p.hour_index for p in result.points] == list(range(13))
    assert all(0.0 <= p.risk_index <= 100.0 for p in result.points)


def test_custom_window() -> None:
    stamps = window_timestamps(date(2026, 10, 1), 20, 5)
    assert len(stamps) == 10
    assert stamps[0].tzinfo == IST


@pytest.mark.parametrize(
    ("riskier", "safer"),
    [
        ({"cloud_cover_pct": 95.0, "sunshine_hours_today": 1.0}, {}),
        ({"wind_speed_ms": 0.2}, {"wind_speed_ms": 6.0}),
        ({"biomass_kg": 3000.0}, {"biomass_kg": 400.0}),
        ({"air_temp_evening_c": 34.0, "air_temp_min_c": 30.0}, {"air_temp_evening_c": 26.0, "air_temp_min_c": 22.0}),
        ({}, {"aerator_planned": True}),
        ({}, {"feeding_plan": "skipped"}),
        ({"rainfall_mm": 80.0}, {}),
        ({"observed_do_mg_l": 3.0}, {"observed_do_mg_l": 9.0}),
        ({"demand_multiplier": 1.2}, {"demand_multiplier": 0.9}),
    ],
)
def test_scenario_changes_move_risk_in_expected_direction(riskier: dict[str, object], safer: dict[str, object]) -> None:
    high = simulate(replace(BASE, **riskier))  # type: ignore[arg-type]
    low = simulate(replace(BASE, **safer))  # type: ignore[arg-type]
    assert high.mean_risk_index > low.mean_risk_index


def test_scenarios_span_safe_to_danger() -> None:
    calm = simulate(replace(BASE, wind_speed_ms=6.0))
    stormy = simulate(replace(BASE, cloud_cover_pct=90.0, sunshine_hours_today=2.0, wind_speed_ms=0.5,
                              biomass_kg=1500.0))
    assert calm.overall_status == "safe"
    assert stormy.overall_status == "danger"


@pytest.mark.parametrize(
    ("value", "expected"),
    [(0.0, "safe"), (39.9, "safe"), (40.0, "watch"), (69.9, "watch"), (70.0, "danger"), (100.0, "danger")],
)
def test_classification_boundaries(value: float, expected: str) -> None:
    assert classify(value, 40.0, 70.0) == expected


def test_configurable_thresholds_change_classification() -> None:
    result = simulate(BASE)
    strict = simulate(BASE, watch_threshold=1.0, danger_threshold=2.0)
    assert strict.overall_status == "danger" or result.peak_risk_index < 2.0
    assert strict.peak_risk_index == result.peak_risk_index


def test_missing_biomass_and_water_temp_are_flagged_as_assumptions() -> None:
    result = simulate(replace(BASE, biomass_kg=None))
    assert result.density_assumed is True
    assert result.water_temp_estimated is True
    measured = simulate(replace(BASE, water_temp_c=27.0))
    assert measured.water_temp_estimated is False


def test_factor_contributions_have_expected_signs() -> None:
    calm_cloudy = replace(BASE, cloud_cover_pct=90.0, sunshine_hours_today=2.0, wind_speed_ms=0.3)
    contributions = {spec.key: c for spec, _, c in factor_contributions(calm_cloudy)}
    assert contributions["sunshine"] > 0
    assert contributions["wind"] > 0
    aerated = {spec.key: c for spec, _, c in factor_contributions(replace(calm_cloudy, aerator_planned=True))}
    assert aerated["aeration"] < 0
    assert contributions["observed_do"] == 0
