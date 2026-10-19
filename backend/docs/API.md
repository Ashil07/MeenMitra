# MeenMitra API contract (v1)

Base URL (local): `http://localhost:8000/api/v1`. The machine-readable schema is
[openapi.json](openapi.json). Real request/response pairs from a seeded demo database are in
[examples/](examples/); regenerate both with `python -m scripts.export_api_docs`.

Status: **proposed by the backend owner, pending frontend review.** Changes after agreement need
coordination between both developers.

## Conventions

| Topic | Rule |
|---|---|
| Success body | `{"data": <object or array>, "meta": {"generated_at", "demo_mode": true, "api_version": "v1"}}` |
| List body | as above, plus `meta.pagination = {total, limit, offset}`. Query `limit` (1–200, default 50) and `offset` (≥0) |
| Error body | `{"error": {"code", "message", "details"}}` |
| Error codes | `validation_error` (422, schema), `invalid_input` (422, business rule), `not_found` (404), `conflict` (409), `feature_disabled` (403), `internal_error` (500) |
| IDs | Prefixed strings: `pond_…`, `fc_…`, `wc_…`, `alert_…`, `dlv_…`, `fb_…`, `rpt_…`. Seeded records use `…_demo_NNN` |
| Timestamps | ISO 8601 with offset. Record times are UTC (`Z`); forecast hours are IST (`+05:30`). Request datetimes **must** include an offset |
| Request bodies | Unknown fields are rejected (422) |
| Status levels | `safe`, `watch`, `danger` everywhere |
| Language | `kn`, `en`. Alert text is returned in both |
| Provenance | `is_demo_record` on stored records; forecasts carry `provenance` (simulation flags, weather source, inputs hash) |
| CORS | Origins from `CORS_ORIGINS`; methods GET, POST, PATCH |

## Endpoints

| Method & path | Purpose | Example |
|---|---|---|
| `GET /health` (also `/api/v1/health`) | Liveness, provider modes | [health](examples/health.json) |
| `GET /dashboard/summary` | Totals, pond statuses, recent alerts, cluster signals, ML state | [dashboard_summary](examples/dashboard_summary.json) |
| `GET /ponds` | List ponds | [ponds_list](examples/ponds_list.json) |
| `POST /ponds` | Register a pond (201) | [pond_create](examples/pond_create.json) |
| `GET /ponds/{pond_id}` | Pond with `latest_status` and `calibration` | [pond_get](examples/pond_get.json) |
| `PATCH /ponds/{pond_id}` | Partial update | [pond_update](examples/pond_update.json) |
| `POST /ponds/{pond_id}/forecast` | Run the demo forecast (201). Body optional | [forecast_create](examples/forecast_create.json) |
| `GET /ponds/{pond_id}/forecasts` | Stored forecasts, newest first | — |
| `GET /forecasts/{forecast_id}` | One stored forecast | — |
| `GET /weather/scenarios` | Synthetic scenario presets for the forecast explorer | [weather_scenarios](examples/weather_scenarios.json) |
| `POST /ponds/{pond_id}/water-check` | Run water-quality and symptom rules (201) | [water_check_create](examples/water_check_create.json) |
| `GET /ponds/{pond_id}/water-checks` | Stored checks, newest first | — |
| `POST /ponds/{pond_id}/feedback` | Farmer dawn observation for a forecast. Updates calibration (201) | [feedback_create](examples/feedback_create.json) |
| `GET /ponds/{pond_id}/calibration` | Calibration state and audit trail | [calibration_get](examples/calibration_get.json) |
| `GET /alerts` | Filters: `pond_id`, `status` (`pending`/`sent`/`failed`/`acknowledged`), `severity` | [alerts_list](examples/alerts_list.json) |
| `GET /alerts/{alert_id}` | One alert with delivery history | — |
| `POST /alerts/{alert_id}/simulate-send` | Mock delivery on WhatsApp/SMS/voice. Body optional | [alert_simulate_send](examples/alert_simulate_send.json) |
| `POST /alerts/{alert_id}/acknowledge` | Record acknowledgement. Body optional | [alert_acknowledge](examples/alert_acknowledge.json) |
| `GET /reports`, `POST /reports` | Farmer observation reports | [reports_list](examples/reports_list.json) |
| `GET /cooperative/summary` | Anonymised cluster aggregation. Query `window_days` (1–60, default 7) | [cooperative_summary](examples/cooperative_summary.json) |
| `GET /ml/status` | Dataset availability and experiment results read from disk | [ml_status](examples/ml_status.json) |
| `GET /approach` | Pipeline stages with live implementation status | [approach](examples/approach.json) |
| `POST /demo/reset` | Wipe and re-seed (403 unless `ALLOW_DEMO_RESET=true`) | — |

Error examples: [error_validation](examples/error_validation.json), [error_not_found](examples/error_not_found.json).

## Key request bodies

**Forecast** (`POST /ponds/{id}/forecast`). All fields are optional.

```json
{
  "forecast_date": "2026-10-01",
  "start_hour": 18, "end_hour": 6,
  "scenario": "overcast_still_night",
  "weather": {"wind_speed_ms": 0.4, "cloud_cover_pct": 90},
  "water": {"water_temp_c": 30.1, "dissolved_oxygen_mg_l": 4.2},
  "aerator_planned": false,
  "feeding_plan": "reduced",
  "use_live_weather": false,
  "create_alert": true
}
```

Scenarios: `clear_calm_night`, `overcast_still_night`, `monsoon_heavy_rain`, `windy_clear_night`,
`hot_humid_still`. Weather fields you omit come from the scenario.

**Water check**: give at least one measurement or one symptom. Units: pH; °C; TAN mg/L as N;
nitrite mg/L as NO2-N; DO mg/L. Symptoms: `gasping_at_surface`, `reduced_feeding`, `lethargy`,
`erratic_swimming`, `red_patches_or_lesions`, `white_spots`, `fin_or_tail_rot`,
`cotton_like_growth`, `bloated_abdomen`, `abnormal_mortality`.

**Simulate send**: `{"channels": ["whatsapp","sms","voice"], "language": "kn", "simulate_failure_channels": ["sms"]}`.
Channels default to the pond's `alert_channels` and language to its `preferred_language`. A channel
that already delivered is skipped. A failed channel can be retried up to 3 attempts in total, then
the endpoint returns 409. A send after acknowledgement returns 409.

**Feedback**: `{"forecast_id", "observation": "no_stress_seen" | "fish_gasping_at_dawn" | "fish_mortality_overnight" | "not_checked", "observed_at", "aerator_used", "note"}`.
`observed_at` must fall after the forecast window starts and must not be in the future. One
feedback per forecast is allowed; a second returns 409.

## Frontend display requirements implied by the contract

* Show the forecast as a **relative risk index (0–100)**, never as mg/L. `summary.peak_risk_time` is
  the hour with the highest simulated risk, not a predicted oxygen-crash time.
* Show `disclaimer`, `provenance.simulation` and `provenance.weather_source` near forecast charts.
* Show `threshold_profile.status = demonstration_settings` and `referral` on water-check results.
* Label alert deliveries as simulated (`simulated: true`, `external_request_made: false`).
* Show `template_review_status` (Kannada wording is an unreviewed draft).
* Show ML metrics only from `/ml/status`. `data_origin` is `"synthetic"` (generated here) or `"external"`
  (downloaded third-party data). Show each dataset's `data_nature`: the Mendeley data appears generated,
  so its scores must not be presented as real-world accuracy. `overall_state` is `no_runs`,
  `synthetic_only` or `trained_on_external_data`.
