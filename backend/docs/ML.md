# ML methodology and evaluation limitations

Workspace: [backend/ml/](../ml/). Modules: `datasets` (registry), `ingest` (load + column
matching), `validate` (schema, missing values, plausibility), `features` (feature/target
definitions and split), `synthetic` (generator), `train` (CLI), `evaluate` (metrics),
`inference` (load artifact + predict), `status` (what `/ml/status` serves).

## Experiments

### A. Next-hour dissolved oxygen (`aquaponics_do`, `synthetic_do`)

| Item | Definition |
|---|---|
| Unit | One pond-hour: raw readings averaged per hour on a complete hourly grid, so gaps stay gaps |
| Target | DO in the next hour (mg/L) |
| Features | DO now, DO 1 h and 2 h ago, 1 h DO change, temperature, pH, hour-of-day sin/cos, and turbidity/ammonia/nitrate when more than 50 % present |
| Split | Hold out whole ponds: sorted IDs, last ⌈25 %⌉ go to test. Falls back to a chronological 80/20 split when there is one pond |
| Baseline | Persistence (next hour = this hour) |
| Models | Ridge (scaled), HistGradientBoosting. XGBoost only if installed (it is not a required dependency, and runs record when it is skipped) |
| Metrics | MAE, RMSE (mg/L), R², and MAE skill vs persistence (`1 − MAE_model / MAE_persistence`) |

Leakage guards: features use only values at or before hour *t*, lags never cross gaps, and test
ponds are never seen in training. Ponds measured at the same time share weather, so pond holdout
is not fully independent in time. With real data, also report a time-blocked split.

**Not used by the forecast.** Next-hour DO from live sensors is a different task from
weather-driven overnight risk without sensors. The aquaponics data comes from catfish tanks in
Nigeria, not Karnataka earthen ponds.

### B. Water-quality grade (`mendeley_wq`)

| Item | Definition |
|---|---|
| Target | `label` (0 excellent, 1 good, 2 poor) |
| Features | The 14 measured parameters that are present |
| Split | Stratified random 75/25 (seed 42). Rows are documented as independent samples |
| Baseline | Majority class |
| Models | Logistic regression (scaled), random forest |
| Metrics | Accuracy, macro-F1, confusion matrix |

Labels appear to be derived from thresholds on the features, so high scores mean the model
recovered those rules, not that it was validated in the field.

**Run on 2026-10-19** (`python -m ml.train --dataset mendeley_wq`, `WQD.xlsx` SHA-256 `5f50c563…ece261`,
scikit-learn 1.8.0). Split: 3,225 train / 1,075 test rows, all 14 features:

| Model | Accuracy | Macro-F1 |
|---|---|---|
| Majority-class baseline | 0.349 | 0.172 |
| Logistic regression | 0.816 | 0.810 |
| Random forest (selected) | 0.994 | 0.995 |

The near-perfect random-forest score is what you would expect if the labels are a threshold
function of the inputs. It says nothing about classifying real pond samples. The validation report
also flags implausible inputs (3.4 % of rows with temperature outside 5–40 °C, 3.0 % with pH
outside 4–11), which is consistent with generated data. The full report, including confusion
matrices, is in `artifacts/reports/mendeley_wq.json` (local, git-ignored); re-running reproduces it
exactly.

## Reports and artifacts

`python -m ml.train --dataset <id>` writes:

* `artifacts/reports/<id>.json`: status (`completed`/`failed`), error, data fingerprint (SHA-256
  of the input files), validation report, features, split, sizes, metrics per model and baseline,
  warnings and library versions.
* `artifacts/models/<id>.joblib`: the selected model with its feature list (successful runs only).

`GET /api/v1/ml/status` reads these files at request time. Nothing is hardcoded. A fresh clone
reports `no_runs`.

## Honest-reporting rules

* Synthetic-data runs are labelled `data_origin: synthetic` with an explicit warning. Downloaded
  third-party datasets are `data_origin: external`; each dataset's `data_nature` says whether its
  records were measured or generated.
* Expected columns that could not be matched are reported as warnings, never dropped silently.
* Failed runs (missing data, schema mismatch) are reported as failed, with the reason.
* A model that does not beat its baseline gets a warning.
* No experiment is applied to live forecasts (`ml_correction_in_forecast.applied: false`).

## Not done / next steps

* Download and run the Kaggle aquaponics dataset (needs a Kaggle account), then review its validation
  report (units, sensor drift, out-of-range values) before trusting any metric.
* Collect Karnataka pond DO + weather data (see [DATASETS.md](DATASETS.md)) for the real
  correction model.
* No hyper-parameter search or uncertainty estimates have been done yet.
