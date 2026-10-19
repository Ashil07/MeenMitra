# MeenMitra backend (FastAPI + ML workspace)

Backend for the MeenMitra hackathon MVP: early oxygen-risk and water-quality alerts for small
aquaculture farms in coastal Karnataka.

> **Demo mode, always.** Forecasts are a *relative demo risk index* from an uncalibrated,
> physics-inspired model. They are not dissolved-oxygen measurements or predictions of when oxygen
> will crash. Water-quality thresholds are unvalidated demonstration settings. Alerts go only
> through an offline mock provider: no real WhatsApp message, SMS or call is ever sent. Seeded
> ponds, readings, reports and alerts are synthetic.

## Quick start

Requires Python 3.11+. No API keys, paid services or network access are needed for the demo.

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env            # optional; the defaults already work
uvicorn app.main:app --reload --port 8000
```

* API: <http://localhost:8000/api/v1>
* Interactive docs (Swagger UI): <http://localhost:8000/docs>
* Health: <http://localhost:8000/health>

On first start, the app creates `data/meenmitra_demo.db` (SQLite) and seeds six synthetic ponds
with forecasts, water checks, farmer reports, alerts and one calibration event.

### Reset the demo data

```bash
python -m app.storage.seed --reset
```

`POST /api/v1/demo/reset` does the same, but only when `ALLOW_DEMO_RESET=true` is set. It is
disabled by default.

## Configuration

All settings are environment variables. See [.env.example](.env.example).

| Variable | Default | Purpose |
|---|---|---|
| `CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Explicit browser origins; `*` is rejected |
| `DATABASE_PATH` | `data/meenmitra_demo.db` | SQLite file (relative to `backend/`) |
| `SEED_ON_STARTUP` | `true` | Seed when the database is empty |
| `ALLOW_DEMO_RESET` | `false` | Enables `POST /api/v1/demo/reset` |
| `WEATHER_PROVIDER` | `demo` | `demo` (offline presets) or `open_meteo` (optional live lookup with fallback) |
| `ALERT_PROVIDER` | `mock` | Only `mock` exists; any other value fails at startup |
| `RISK_WATCH_THRESHOLD` / `RISK_DANGER_THRESHOLD` | `40` / `70` | Demo classification boundaries on the 0–100 index |
| `ML_DATA_DIR` / `ML_ARTIFACTS_DIR` | `data/raw` / `artifacts` | Downloaded datasets and training outputs |

## Checks

```bash
python -m pytest        # backend test suite
python -m mypy          # static type check (app + ml)
```

## ML workspace

```bash
python -m ml.train --dataset synthetic_do   # exercises the pipeline end to end (synthetic metrics only)
python -m ml.train --dataset aquaponics_do  # after downloading the Kaggle CSVs
python -m ml.train --dataset mendeley_wq    # after downloading WQD.xlsx from Mendeley
```

Every run writes `artifacts/reports/<dataset>.json`, failed runs included. `GET /api/v1/ml/status`
reads those reports from disk, so the dashboard shows only what actually ran. No dataset is
committed; see [docs/DATASETS.md](docs/DATASETS.md) for sources, licences and where to place the
files.

## Layout

```
app/
  main.py, factory.py        ASGI entry point and app factory (CORS, error envelope, routers)
  config.py, context.py      settings from env; dependency container injected into routes/tests
  api/routes/                thin HTTP handlers (ponds, alerts, insights/system)
  schemas/                   Pydantic request/response models (the API contract)
  services/                  business logic
    forecast_engine.py       pure deterministic demo engine (relative risk index)
    forecasts.py             orchestration, explanations, actions, feedback intake
    weather.py               scenario presets + optional Open-Meteo adapter
    water_rules.py           transparent threshold + symptom rules (pure)
    calibration.py           bounded per-pond demand-multiplier adjustment
    alerts.py                alert creation, simulated delivery, acknowledgement
    reports.py               farmer reports + anonymised cluster summary
    insights.py              dashboard, ML status, technical-approach views
  providers/                 alert provider interface + offline mock
  storage/                   SQLite document store + reproducible seed
  config_data/               water thresholds (demo settings) and alert templates (en/kn)
ml/                          datasets registry, ingest, validate, features, synthetic, train, evaluate, inference, status
scripts/export_api_docs.py   regenerates docs/openapi.json and docs/examples/*.json
tests/                       pytest suite (uses temp databases; no network)
docs/                        API contract and methodology documents
```

## Documentation

* [docs/API.md](docs/API.md): API contract, envelope and endpoint list (frontend integration guide)
* [docs/openapi.json](docs/openapi.json) and [docs/examples/](docs/examples/): generated schema and real example payloads
* [docs/FORECAST_MODEL.md](docs/FORECAST_MODEL.md): demo engine assumptions and limitations
* [docs/WATER_RULES.md](docs/WATER_RULES.md): thresholds, units and sources
* [docs/DATASETS.md](docs/DATASETS.md): dataset provenance and acquisition
* [docs/ML.md](docs/ML.md): ML methodology and evaluation limitations
* [docs/ALERTS.md](docs/ALERTS.md): provider abstraction and what production messaging would need

Regenerate the schema and examples after changing the API:

```bash
python -m scripts.export_api_docs
```

## Known limitations

* The forecast is an uncalibrated relative index. Its constants are demonstration settings, and
  no measured overnight DO data from the target ponds exists to calibrate or validate it.
* No ML model corrects the forecast. The offline experiments use other tasks/datasets or synthetic data.
* Water thresholds are generic warm-water settings, not species- or region-specific, and are unvalidated.
* Kannada alert templates are unreviewed drafts.
* No authentication or authorisation. Do not expose this backend publicly with real farmer data.
* SQLite document storage suits a single-instance demo, not concurrent production use.
