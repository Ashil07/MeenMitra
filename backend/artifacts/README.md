# Training outputs (git-ignored)

Written by `python -m ml.train --dataset <id>`:

* `reports/<id>.json`: machine-readable evaluation report (failed runs included)
* `models/<id>.joblib`: trained model with its feature list (successful runs only)

`GET /api/v1/ml/status` reads this folder. See [../docs/ML.md](../docs/ML.md).
