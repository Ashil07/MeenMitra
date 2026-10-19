"""Physics-inspired DEMO overnight oxygen-risk engine.

This is a pure, deterministic module: the same EngineInputs always produce the same EngineResult.
It produces a *relative* risk index (0-100), NOT a dissolved-oxygen concentration. Nothing here
has been calibrated against measured dissolved-oxygen data. See docs/FORECAST_MODEL.md.

Conceptual model (one state variable, hourly steps from evening to morning):

    reserve[h+1] = clamp(reserve[h] - demand[h] + (k_wind + k_aerator) * (1 - reserve[h]), 0, 1)
    risk[h]      = 100 * clamp((RESERVE_COMFORT - reserve[h]) / (RESERVE_COMFORT - RESERVE_FLOOR), 0, 1)

- reserve is a unitless, model-internal "oxygen reserve" fraction. It is not mg/L.
- The starting reserve reflects daytime photosynthesis (sunshine, cloud) or, when the farmer
  supplies an evening DO reading, a coarse mapping of that observed value.
- Demand grows with stocking density, warmer water (Q10 ~ 2), shallow depth, heavy rain and feeding,
  and is scaled by the pond's calibration multiplier.
- Re-aeration grows with wind and shallower depth; aerators add a fixed supply term.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import date, datetime, timedelta
from typing import Literal

from app.utils import IST

ENGINE_VERSION = "demo-0.1.0"

# --- Model constants (demonstration assumptions, documented in docs/FORECAST_MODEL.md) -------------
RESERVE_COMFORT = 0.85  # reserve at or above this maps to risk 0
RESERVE_FLOOR = 0.20  # reserve at or below this maps to risk 100
REFERENCE_DENSITY_KG_M3 = 0.5  # ~5 t/ha standing stock at 1 m depth
REFERENCE_DEPTH_M = 1.5
REFERENCE_WATER_TEMP_C = 28.0
TEMP_THETA = 1.07  # per °C; Q10 ≈ 2 for respiration
FISH_DEMAND_PER_HOUR = 0.018
BACKGROUND_DEMAND_PER_HOUR = 0.014  # plankton + sediment respiration
FEEDING_MULTIPLIER = {"normal": 1.0, "reduced": 0.9, "skipped": 0.8}
OBSERVED_DO_FULL_RESERVE_MG_L = 10.0  # coarse mapping of an evening DO reading onto the reserve scale
AERATOR_AREA_M2_PER_UNIT = 2000.0
AERATOR_K_PER_UNIT = 0.12
AERATOR_K_MAX = 0.30

ASSUMPTIONS = [
    "Output is a relative demo risk index (0-100), not a dissolved-oxygen concentration.",
    "Model constants are demonstration settings chosen for plausible qualitative behaviour; "
    "they have not been fitted to measured pond dissolved-oxygen data.",
    "Respiration demand rises ~2x per 10 °C of water temperature (Q10 ≈ 2).",
    "Demand scales with stocking density relative to 0.5 kg/m³ (≈5 t/ha at 1 m depth).",
    "Sunny, clear days are assumed to leave a larger evening oxygen reserve from photosynthesis.",
    "Wind re-aeration grows with wind speed and is stronger in shallower ponds.",
    "Heavy rain (>20 mm) adds demand to represent runoff and possible stratification turnover.",
    "Aerators, when planned, are assumed to run for the whole window.",
    "Water temperature, when not measured, is estimated from air temperature.",
    "Factor contributions are one-at-a-time sensitivities; they do not add up exactly.",
]

Status = Literal["safe", "watch", "danger"]


@dataclass(frozen=True)
class EngineInputs:
    forecast_date: date
    start_hour: int
    end_hour: int
    air_temp_evening_c: float
    air_temp_min_c: float
    cloud_cover_pct: float
    sunshine_hours_today: float
    wind_speed_ms: float
    rainfall_mm: float
    area_m2: float
    depth_m: float
    biomass_kg: float | None
    aerator_count: int
    aerator_planned: bool
    feeding_plan: Literal["normal", "reduced", "skipped"]
    water_temp_c: float | None
    observed_do_mg_l: float | None
    demand_multiplier: float = 1.0


@dataclass(frozen=True)
class HourPoint:
    hour_index: int
    timestamp: datetime
    risk_index: float
    status: Status


@dataclass(frozen=True)
class EngineResult:
    points: list[HourPoint]
    peak_risk_index: float
    peak_index: int
    mean_risk_index: float
    overall_status: Status
    estimated_water_temp_c: float
    water_temp_estimated: bool
    density_kg_m3: float
    density_assumed: bool


def classify(risk_index: float, watch_threshold: float, danger_threshold: float) -> Status:
    if risk_index >= danger_threshold:
        return "danger"
    if risk_index >= watch_threshold:
        return "watch"
    return "safe"


def window_timestamps(forecast_date: date, start_hour: int, end_hour: int) -> list[datetime]:
    start = datetime(forecast_date.year, forecast_date.month, forecast_date.day, start_hour, tzinfo=IST)
    end = datetime(forecast_date.year, forecast_date.month, forecast_date.day, end_hour, tzinfo=IST) + timedelta(days=1)
    hours = int((end - start).total_seconds() // 3600)
    return [start + timedelta(hours=i) for i in range(hours + 1)]


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _photosynthesis_credit(inp: EngineInputs) -> float:
    """0..1 — how much oxygen the preceding day is assumed to have banked."""
    return _clamp(inp.sunshine_hours_today / 10.0, 0.0, 1.0) * (1.0 - 0.5 * inp.cloud_cover_pct / 100.0)


def _initial_reserve(inp: EngineInputs) -> float:
    if inp.observed_do_mg_l is not None:
        return _clamp(inp.observed_do_mg_l / OBSERVED_DO_FULL_RESERVE_MG_L, 0.05, 1.0)
    return 0.45 + 0.45 * _photosynthesis_credit(inp)


def _density(inp: EngineInputs) -> tuple[float, bool]:
    if inp.biomass_kg is None:
        return REFERENCE_DENSITY_KG_M3, True
    return inp.biomass_kg / (inp.area_m2 * inp.depth_m), False


def _water_temp_start(inp: EngineInputs) -> tuple[float, bool]:
    if inp.water_temp_c is not None:
        return inp.water_temp_c, False
    # Ponds retain daytime heat: assume evening water ~1 °C above evening air temperature.
    return _clamp(inp.air_temp_evening_c + 1.0, 15.0, 38.0), True


def _wind_k(inp: EngineInputs) -> float:
    return _clamp((0.015 + 0.012 * inp.wind_speed_ms**1.5) * (REFERENCE_DEPTH_M / inp.depth_m) ** 0.5, 0.0, 0.5)


def _aerator_k(inp: EngineInputs) -> float:
    if not inp.aerator_planned or inp.aerator_count <= 0:
        return 0.0
    return min(AERATOR_K_MAX, AERATOR_K_PER_UNIT * inp.aerator_count * AERATOR_AREA_M2_PER_UNIT / inp.area_m2)


def _rain_demand(inp: EngineInputs) -> float:
    if inp.rainfall_mm <= 20:
        return 0.0
    return 0.012 * min(inp.rainfall_mm, 120.0) / 60.0


def _risk_from_reserve(reserve: float) -> float:
    return 100.0 * _clamp((RESERVE_COMFORT - reserve) / (RESERVE_COMFORT - RESERVE_FLOOR), 0.0, 1.0)


def simulate(inp: EngineInputs, watch_threshold: float = 40.0, danger_threshold: float = 70.0) -> EngineResult:
    stamps = window_timestamps(inp.forecast_date, inp.start_hour, inp.end_hour)
    steps = len(stamps) - 1
    density, density_assumed = _density(inp)
    tw0, tw_estimated = _water_temp_start(inp)
    # Water cools toward (overnight air minimum + 2 °C) but only about half way by morning.
    tw_end = tw0 - 0.5 * max(0.0, tw0 - (inp.air_temp_min_c + 2.0))

    fish = FISH_DEMAND_PER_HOUR * (density / REFERENCE_DENSITY_KG_M3) ** 0.8 * FEEDING_MULTIPLIER[inp.feeding_plan]
    background = BACKGROUND_DEMAND_PER_HOUR * (REFERENCE_DEPTH_M / inp.depth_m) ** 0.5
    k_supply = _wind_k(inp) + _aerator_k(inp)
    rain = _rain_demand(inp)

    reserve = _initial_reserve(inp)
    risks: list[float] = []
    for h in range(steps + 1):
        risks.append(_risk_from_reserve(reserve))
        if h == steps:
            break
        tw = tw0 + (tw_end - tw0) * (h / max(steps, 1))
        temp_factor = TEMP_THETA ** (tw - REFERENCE_WATER_TEMP_C)
        demand = (fish + background) * temp_factor * inp.demand_multiplier + rain
        reserve = _clamp(reserve - demand + k_supply * (1.0 - reserve), 0.0, 1.0)

    rounded = [round(r, 1) for r in risks]
    points = [
        HourPoint(i, stamps[i], rounded[i], classify(rounded[i], watch_threshold, danger_threshold))
        for i in range(len(stamps))
    ]
    peak = max(rounded)
    peak_index = rounded.index(peak)
    return EngineResult(
        points=points,
        peak_risk_index=peak,
        peak_index=peak_index,
        mean_risk_index=round(sum(risks) / len(risks), 1),
        overall_status=classify(peak, watch_threshold, danger_threshold),
        estimated_water_temp_c=round(tw0, 1),
        water_temp_estimated=tw_estimated,
        density_kg_m3=round(density, 3),
        density_assumed=density_assumed,
    )


# --- Explainability: one-at-a-time sensitivities ---------------------------------------------------

@dataclass(frozen=True)
class FactorSpec:
    key: str
    label: str
    unit: str | None
    reference_label: float | bool | str | None


def factor_references(inp: EngineInputs) -> list[tuple[FactorSpec, float | bool | str | None, EngineInputs]]:
    """Each factor with its actual value and a copy of the inputs where only that factor is neutral."""
    density, _ = _density(inp)
    tw0, _ = _water_temp_start(inp)
    ref_biomass = REFERENCE_DENSITY_KG_M3 * inp.area_m2 * inp.depth_m
    return [
        (FactorSpec("water_temperature", "Water temperature", "°C", REFERENCE_WATER_TEMP_C), round(tw0, 1),
         replace(inp, water_temp_c=REFERENCE_WATER_TEMP_C, air_temp_min_c=REFERENCE_WATER_TEMP_C - 2.0)),
        (FactorSpec("cloud_cover", "Daytime cloud cover", "%", 30.0), inp.cloud_cover_pct,
         replace(inp, cloud_cover_pct=30.0)),
        (FactorSpec("sunshine", "Sunshine hours today", "h", 8.0), inp.sunshine_hours_today,
         replace(inp, sunshine_hours_today=8.0)),
        (FactorSpec("wind", "Overnight wind speed", "m/s", 2.0), inp.wind_speed_ms,
         replace(inp, wind_speed_ms=2.0)),
        (FactorSpec("rainfall", "Rainfall in window", "mm", 0.0), inp.rainfall_mm,
         replace(inp, rainfall_mm=0.0)),
        (FactorSpec("stocking_density", "Stocking density", "kg/m³", REFERENCE_DENSITY_KG_M3), round(density, 3),
         replace(inp, biomass_kg=ref_biomass)),
        (FactorSpec("depth", "Pond depth", "m", REFERENCE_DEPTH_M), inp.depth_m,
         replace(inp, depth_m=REFERENCE_DEPTH_M, biomass_kg=None if inp.biomass_kg is None
                 else density * inp.area_m2 * REFERENCE_DEPTH_M)),
        (FactorSpec("aeration", "Aerators running overnight", None, False),
         bool(inp.aerator_planned and inp.aerator_count > 0), replace(inp, aerator_planned=False)),
        (FactorSpec("feeding_plan", "Evening feeding plan", None, "normal"), inp.feeding_plan,
         replace(inp, feeding_plan="normal")),
        (FactorSpec("observed_do", "Evening DO reading (observed)", "mg/L", None), inp.observed_do_mg_l,
         replace(inp, observed_do_mg_l=None)),
        (FactorSpec("calibration", "Pond calibration multiplier", "x", 1.0), round(inp.demand_multiplier, 3),
         replace(inp, demand_multiplier=1.0)),
    ]


def factor_contributions(
    inp: EngineInputs, watch_threshold: float = 40.0, danger_threshold: float = 70.0
) -> list[tuple[FactorSpec, float | bool | str | None, float]]:
    """Change in the window-average risk index when only that factor is set to its reference value."""
    base = simulate(inp, watch_threshold, danger_threshold).mean_risk_index
    out = []
    for spec, value, neutral in factor_references(inp):
        contribution = round(base - simulate(neutral, watch_threshold, danger_threshold).mean_risk_index, 1)
        out.append((spec, value, contribution))
    return out
