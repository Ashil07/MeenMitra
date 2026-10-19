# Demo overnight oxygen-risk engine

Code: [app/services/forecast_engine.py](../app/services/forecast_engine.py) (pure, deterministic) and
[app/services/forecasts.py](../app/services/forecasts.py) (orchestration). Version `demo-0.1.0`.

## What it is, and what it is not

* It **is** a transparent, physics-*inspired* simulation that shows how weather, pond characteristics
  and management choices push overnight oxygen risk up or down.
* It outputs a **relative risk index (0–100)**. It does **not** output a dissolved-oxygen
  concentration, does **not** predict when oxygen will crash, and has **not** been calibrated or
  validated against measured pond DO. No such data exists in this project for coastal Karnataka ponds.
* Suggested actions are generic good practice tied to the simulated risk level. They are not a
  guarantee that stress or mortality will be prevented.

## Model

One unitless state variable, the *oxygen reserve* `R ∈ [0, 1]`, stepped hourly from the evening
start hour (default 18:00 IST) to the morning end hour (default 06:00 IST):

```
R[h+1] = clamp(R[h] − D[h] + (k_wind + k_aerator) · (1 − R[h]), 0, 1)
risk[h] = 100 · clamp((0.85 − R[h]) / (0.85 − 0.20), 0, 1)
```

| Term | Definition (demonstration constants) |
|---|---|
| Starting reserve `R[0]` | `0.45 + 0.45 · P` with photosynthesis credit `P = min(sun_h/10, 1) · (1 − 0.5 · cloud%/100)`. If the farmer gives an evening DO reading: `clamp(DO/10 mg/L, 0.05, 1)` |
| Demand `D[h]` | `(fish + background) · θ^(Tw[h] − 28) · m + rain` |
| fish | `0.018 · (density / 0.5 kg/m³)^0.8 · feeding` (feeding: normal 1.0, reduced 0.9, skipped 0.8) |
| background | `0.014 · (1.5 m / depth)^0.5` (plankton + sediment respiration; shallower = more per volume) |
| θ | 1.07 per °C (respiration roughly doubles per 10 °C, Q10 ≈ 2) |
| Water temperature | Measured if given, else evening air + 1 °C. Cools linearly halfway toward (overnight air min + 2 °C) |
| `m` | Per-pond calibration multiplier (default 1.0, bounded 0.80–1.25), see [calibration](#calibration) |
| rain | `0.012 · min(rain, 120)/60` when rain > 20 mm (runoff, possible turnover) |
| `k_wind` | `(0.015 + 0.012 · wind^1.5) · (1.5 m / depth)^0.5`, capped at 0.5 |
| `k_aerator` | `min(0.30, 0.12 · aerators · 2000 m² / area)` when aerators are planned. Assumed to run all night |
| density | `biomass_kg / (area · depth)`. If biomass is missing, 0.5 kg/m³ is assumed and flagged |

Classification of each hour and of the peak: `watch` at ≥ 40, `danger` at ≥ 70 (configurable via
`RISK_WATCH_THRESHOLD` / `RISK_DANGER_THRESHOLD`; these are demonstration settings).

## Explainability

Each forecast lists factors (water temperature, cloud, sunshine, wind, rain, stocking density,
depth, aeration, feeding, observed DO, calibration). For each factor, `contribution_points` is
the change in the **window-average** risk index when only that factor is reset to a neutral
reference value. These are one-at-a-time sensitivities: interactions and clipping mean they do
not add up to the total. Each factor also states its `value_source`: `observed`,
`pond_profile`, `scenario_preset`, `user_override`, `open_meteo` or `default_assumption`.

`missing_data` lists every assumption made because an input was missing.

## Determinism and provenance

The same pond, inputs, calibration state and thresholds always produce the same hourly series.
`provenance.inputs_hash` is the SHA-256 of those resolved inputs. IDs and `generated_at` differ
per run. Provenance flags: `simulation: true`, `output_type: relative_risk_index`,
`calibrated_to_measured_do: false`, `ml_correction.applied: false`, plus the weather source and
any fallback reason.

## Weather inputs

* Default: five **synthetic** scenario presets (`GET /api/v1/weather/scenarios`), which requests
  can override field by field.
* Optional: with `WEATHER_PROVIDER=open_meteo` and `use_live_weather: true`, the
  [Open-Meteo](https://open-meteo.com) forecast for an approximate district centroid supplies the
  values. Any failure falls back to the preset and the reason is reported (`demo_fallback`).

## Calibration

Farmer feedback (`POST /ponds/{id}/feedback`) nudges only that pond's multiplier `m`, in small
bounded steps (see [calibration.py](../app/services/calibration.py)). The before/after values and the
rule applied are stored as an auditable event. Nights with aerators running, or nights not checked,
cause no change. Nothing is retrained.

## Path to a calibrated model

1. Collect paired overnight DO logs (e.g. hourly from a calibrated optical DO probe) with local weather,
   pond depth/area, stocking and aeration records for a set of pilot ponds.
2. Replace the reserve state with a DO mass balance in mg/L (saturation from temperature/salinity,
   measured respiration and re-aeration coefficients), fitted per pond type.
3. Evaluate with ponds and seasons held out. Only then present DO concentrations, together with
   uncertainty intervals.
4. Train the ML correction layer on the residuals of that physics model.
