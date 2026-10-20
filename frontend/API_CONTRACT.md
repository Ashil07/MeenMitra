# MeenMitra API contract — DRAFT v1 (frontend proposal)

**Status: proposal from the frontend owner, not yet agreed.** No backend existed when the frontend
was built, so this is the contract the frontend currently calls. The backend owner should review it.
Any change goes into `src/api/types.ts`, this file and the tests together.

The TypeScript source of truth for every payload is [`src/api/types.ts`](src/api/types.ts).

## Conventions

- Base path: `{NEXT_PUBLIC_API_BASE_URL}/api/v1`. JSON in and out, with `snake_case` fields (Pydantic defaults).
- Times are ISO 8601. Forecast points carry the IST offset (`+05:30`). Dates are `YYYY-MM-DD`.
- Errors use FastAPI's shape:
  - `{"detail": "message"}`, shown to the user as is.
  - `{"detail": [{loc, msg, type}]}` for 422, mapped onto form fields by the last `loc` segment.
- 404 with a specific `detail` means a missing resource. FastAPI's generic `{"detail":"Not Found"}` is shown as "endpoint not implemented yet".
- Every top-level resource has `data_source: "live" | "demo"`, and the UI labels anything that is not `live`.
- CORS: allow the frontend origin (default `http://localhost:3000`) for `GET, POST, PATCH`, with the `Content-Type` header.

## Endpoints

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| GET | `/health` | – | `HealthResponse` | Must report `messaging_provider` and `messaging_simulated`. |
| GET | `/dashboard/summary` | – | `DashboardSummary` | `featured_forecast` may be `null`. |
| GET | `/ponds` | `?search=&risk=safe\|watch\|danger\|unknown` | `PondSummary[]` | Search over name, farmer, village and canal. |
| POST | `/ponds` | `PondInput` | `Pond` (201) | 422 with field errors on invalid input. |
| GET | `/ponds/{id}` | – | `Pond` | 404 `{"detail":"Pond not found"}`. |
| PATCH | `/ponds/{id}` | `Partial<PondInput>` | `Pond` | |
| GET | `/forecast/scenarios` | – | `Scenario[]` | ids: `normal`, `cloudy_hot`, `high_risk`. |
| POST | `/ponds/{id}/forecasts` | `ForecastRequest` | `Forecast` | Persists and updates the pond's `latest_risk`. Optional `live_weather` (provider, place, coordinates, fetched_at) marks `weather_overrides` as a live Open-Meteo forecast; it is echoed in `inputs.live_weather`. |
| GET | `/ponds/{id}/forecasts/latest` | – | `Forecast \| null` | **200 with `null`** when there is no forecast yet. |
| GET | `/ponds/{id}/water-checks` | – | `WaterCheck[]` | Newest first. |
| POST | `/ponds/{id}/water-checks` | `WaterCheckRequest` | `WaterCheck` | 422 if no readings and no symptoms. |
| POST | `/ponds/{id}/feedback` | `{ response: 1\|2\|3 }` | `FeedbackResult` | Updates `oxygen_use_factor`. |
| GET | `/alerts` | `?pond_id=&status=&risk=&kind=` | `Alert[]` | Newest first, with `deliveries` embedded. |
| GET | `/alerts/{id}` | – | `Alert` | |
| POST | `/alerts` | `AlertCreateRequest` | `Alert` (status `draft`) | Backend renders `message_kn` and `message_en`. |
| POST | `/alerts/{id}/deliveries` | `DeliveryRequest` | `Delivery` | Mock provider by default. `simulate_failure` is for demo only. |
| POST | `/alerts/{id}/acknowledge` | `{ response: "1" }` | `Alert` | 409 if nothing has been delivered yet. |
| GET | `/cooperative/overview` | – | `CooperativeOverview` | Reports are anonymised. Clusters are `possible` until an officer confirms. |
| GET | `/ml/status` | – | `MlStatus` | Only real counts and metrics. Use `null` or `[]` when unknown. Optional per model: `data_origin` (`external`/`synthetic`) and `results` (the saved model's real predictions on held-out test rows). Demo mode reads them from `api/mock/ml_results.json`, written by `backend/scripts/export_demo_ml.py`. |

## Semantics the UI relies on

- **Forecast**
  - `points` are hourly from 18:00 to 08:00 IST (15 points).
  - `estimated_do_mg_l` is a model estimate, never a measurement.
  - `risk_level` must match `thresholds`: danger below `danger_below_mg_l`, otherwise watch below `watch_below_mg_l`.
  - `factors[].magnitude_mg_l` must come from the actual calculation.
  - `model.ml_correction_applied` and `model.calibrated` must be truthful.
- **Water check**
  - `readings` echo exactly what the farmer entered.
  - `missing_inputs` lists the readings left empty.
  - `refer_to_fisheries_officer` is true for disease signs. The UI always shows a "cannot diagnose" warning.
- **Alerts**
  - `status` moves through: `draft` → `sent` / `send_failed` → `acknowledged`.
  - `kannada_reviewed` stays `false` until a native speaker approves the template.
  - `Delivery.simulated` must be `true` whenever no real provider sent anything.
- **ML status**
  - `engine_layers[].id` must use these ids: `inputs`, `weather`, `physics`, `ml`, `rules`, `risk`, `delivery`, `feedback`, `calibration`. The Approach explorer reads its statuses from them.
  - `models[].validated_for_karnataka_ponds` and `used_in_forecast` gate what the UI claims.
- **Symptoms enum**
  - `gasping_at_surface`, `not_feeding`, `erratic_swimming`, `red_spots_or_ulcers`, `white_patches_or_fungus`, `fin_rot`, `dead_fish`, `foul_smell`, `thick_green_water`.

## Open questions for the backend owner

1. Should outbreak notices be created automatically when a cluster is detected, or only drafted by cooperative staff?
2. Should a `voice` delivery report a status beyond `delivered` (answered / no answer) for escalation?
3. Should `/dashboard/summary.trend` come from stored daily snapshots? In demo mode the trend is illustrative and labelled that way.
