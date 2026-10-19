"""Train and evaluate experiments; write model artifacts and machine-readable reports.

Usage (from backend/):
    python -m ml.train --dataset synthetic_do
    python -m ml.train --dataset aquaponics_do     # after placing CSVs in data/raw/aquaponics_do/
    python -m ml.train --dataset mendeley_wq       # after placing the CSV in data/raw/mendeley_wq/

Every run — successful or failed — writes artifacts/reports/<dataset>.json, which GET /api/v1/ml/status
reads. Metrics come only from these actual runs.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import logging
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestClassifier
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from ml import features as F
from ml.datasets import REGISTRY
from ml.evaluate import classification_metrics, regression_metrics, skill_vs_baseline
from ml.ingest import (
    DO_SERIES_REQUIRED,
    DatasetNotAvailable,
    file_sha256,
    find_files,
    fingerprint,
    load_do_series,
    load_wq_table,
)
from ml.synthetic import generate
from ml.validate import validate_do_series, validate_wq_table

logger = logging.getLogger("ml.train")
RANDOM_STATE = 42
MIN_ROWS = 50


class TrainingError(RuntimeError):
    pass


def xgboost_available() -> bool:
    return importlib.util.find_spec("xgboost") is not None


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def train_do_series(frame: pd.DataFrame, *, dataset_id: str, data_origin: str) -> tuple[dict[str, Any], dict[str, Any]]:
    """Returns (report, model_bundle)."""
    hourly = F.hourly_do_frame(frame)
    table, feature_cols = F.do_model_table(hourly)
    if len(table) < MIN_ROWS:
        raise TrainingError(f"only {len(table)} usable pond-hours after cleaning (need {MIN_ROWS})")
    test_mask, split_desc = F.group_holdout_split(table)
    train, test = table[~test_mask], table[test_mask]
    if len(train) < MIN_ROWS // 2 or len(test) < 10:
        raise TrainingError(f"split too small: {len(train)} train / {len(test)} test rows")
    X_train, y_train = train[feature_cols].to_numpy(), train[F.DO_TARGET].to_numpy()
    X_test, y_test = test[feature_cols].to_numpy(), test[F.DO_TARGET].to_numpy()

    persistence = test["do_t"].to_numpy()
    baseline = regression_metrics(y_test, persistence)
    candidates = {
        "ridge": make_pipeline(StandardScaler(), Ridge(alpha=1.0)),
        "hist_gradient_boosting": HistGradientBoostingRegressor(random_state=RANDOM_STATE, max_iter=200),
    }
    warnings: list[str] = []
    if xgboost_available():
        from xgboost import XGBRegressor  # optional; not a required dependency

        candidates["xgboost"] = XGBRegressor(n_estimators=300, max_depth=4, learning_rate=0.05,
                                             random_state=RANDOM_STATE)
    else:
        warnings.append("xgboost not installed; XGBoost experiment skipped.")

    model_metrics: dict[str, Any] = {}
    fitted: dict[str, Any] = {}
    for name, model in candidates.items():
        model.fit(X_train, y_train)
        scores = regression_metrics(y_test, model.predict(X_test))
        m: dict[str, float | None] = {**scores,
                                      "skill_vs_persistence_mae": skill_vs_baseline(scores["mae_mg_l"],
                                                                                    baseline["mae_mg_l"])}
        model_metrics[name] = m
        fitted[name] = model
    best = min(model_metrics, key=lambda k: model_metrics[k]["mae_mg_l"] or 0.0)
    if data_origin == "synthetic":
        warnings.append("Trained and evaluated on synthetic data only; metrics do not indicate real-world accuracy.")
    if model_metrics[best]["skill_vs_persistence_mae"] is not None and model_metrics[best]["skill_vs_persistence_mae"] <= 0:
        warnings.append("Best model does not beat the persistence baseline.")
    warnings.append("Next-hour DO from current sensors is a different task from weather-driven overnight risk; "
                    "this model is not used to correct the demo forecast.")

    report = {
        "task": REGISTRY[dataset_id].task,
        "target": F.DO_TARGET,
        "features": feature_cols,
        "split": split_desc,
        "n_train": int(len(train)),
        "n_test": int(len(test)),
        "model_type": best,
        "metrics": {"baseline_persistence": baseline, "models": model_metrics, "selected_model": best},
        "warnings": warnings,
    }
    return report, {"model": fitted[best], "features": feature_cols, "target": F.DO_TARGET}


def train_wq_table(frame: pd.DataFrame, *, dataset_id: str) -> tuple[dict[str, Any], dict[str, Any]]:
    feature_cols = [c for c in F.WQ_FEATURES if c in frame]
    data = frame[[*feature_cols, "label"]].apply(pd.to_numeric, errors="coerce").dropna()
    if len(data) < MIN_ROWS:
        raise TrainingError(f"only {len(data)} complete rows (need {MIN_ROWS})")
    X, y = data[feature_cols].to_numpy(), data["label"].astype(int).to_numpy()
    labels = sorted(np.unique(y).tolist())
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=RANDOM_STATE, stratify=y
    )
    baseline = DummyClassifier(strategy="most_frequent").fit(X_train, y_train)
    candidates = {
        "logistic_regression": make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000)),
        "random_forest": RandomForestClassifier(n_estimators=300, random_state=RANDOM_STATE),
    }
    model_metrics = {}
    fitted = {}
    for name, model in candidates.items():
        model.fit(X_train, y_train)
        model_metrics[name] = classification_metrics(y_test, model.predict(X_test), labels)
        fitted[name] = model
    best = max(model_metrics, key=lambda k: model_metrics[k]["macro_f1"])
    report = {
        "task": REGISTRY[dataset_id].task,
        "target": "label",
        "features": feature_cols,
        "split": "stratified random 75/25 split (rows are independent samples; no time or group structure documented)",
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
        "model_type": best,
        "metrics": {
            "baseline_majority_class": classification_metrics(y_test, baseline.predict(X_test), labels),
            "models": model_metrics,
            "selected_model": best,
        },
        "warnings": [
            "Labels appear to be derived from feature thresholds; high scores reflect recovering those rules, "
            "not validated field performance.",
            "Classification of water-quality grade only; not used for oxygen forecasting.",
        ],
    }
    return report, {"model": fitted[best], "features": feature_cols, "target": "label"}


def run(dataset_id: str, data_dir: Path, artifacts_dir: Path) -> dict[str, Any]:
    if dataset_id not in ("synthetic_do", "aquaponics_do", "mendeley_wq"):
        raise SystemExit(f"dataset '{dataset_id}' has no training pipeline")
    reports_dir = artifacts_dir / "reports"
    models_dir = artifacts_dir / "models"
    reports_dir.mkdir(parents=True, exist_ok=True)
    models_dir.mkdir(parents=True, exist_ok=True)
    report: dict[str, Any] = {
        "experiment_id": dataset_id,
        "dataset_id": dataset_id,
        "data_origin": "synthetic" if dataset_id == "synthetic_do" else "external",
        "started_at": _now(),
        "library_versions": {"scikit-learn": sklearn.__version__, "pandas": pd.__version__, "numpy": np.__version__},
    }
    try:
        if dataset_id == "synthetic_do":
            frame = generate()
            report["data_fingerprint"] = "synthetic:ml.synthetic.generate(n_ponds=6, days=21, seed=42)"
            report["validation"] = validate_do_series(frame, {"generated": {c: c for c in frame.columns}},
                                                      DO_SERIES_REQUIRED)
            details, bundle = train_do_series(frame, dataset_id=dataset_id, data_origin="synthetic")
        else:
            files = find_files(data_dir, dataset_id)
            if not files:
                raise DatasetNotAvailable(f"no files found in {data_dir / (REGISTRY[dataset_id].local_dir or '')}")
            report["data_fingerprint"] = fingerprint(files)
            report["files"] = [p.name for p in files]
            report["file_sha256"] = {p.name: file_sha256(p) for p in files}
            if dataset_id == "aquaponics_do":
                frame, mappings = load_do_series(files)
                report["validation"] = validate_do_series(frame, mappings, DO_SERIES_REQUIRED)
                if not report["validation"]["schema_ok"]:
                    raise TrainingError("schema validation failed: " + "; ".join(report["validation"]["problems"]))
                details, bundle = train_do_series(frame, dataset_id=dataset_id, data_origin="external")
            else:
                frame, mapping = load_wq_table(files)
                report["validation"] = validate_wq_table(frame, mapping, [*F.WQ_FEATURES, "label"])
                if not report["validation"]["schema_ok"]:
                    raise TrainingError("schema validation failed: "
                                        + "; ".join(report["validation"]["problems"] or ["too few feature columns"]))
                details, bundle = train_wq_table(frame, dataset_id=dataset_id)
                if report["validation"]["missing_expected_columns"]:
                    details["warnings"].append("Expected columns not found and excluded from features: "
                                               + ", ".join(report["validation"]["missing_expected_columns"]))
                flagged = report["validation"].get("outside_pond_plausible_range", {})
                implausible = {c: v["pct_outside"] for c, v in flagged.items() if v["rows_outside"]}
                if implausible:
                    details["warnings"].append(
                        "Values outside pond-plausible ranges (% of rows): "
                        + ", ".join(f"{c} {p}%" for c, p in sorted(implausible.items()))
                        + ". The data looks generated within ranges rather than measured in ponds.")
        model_path = models_dir / f"{dataset_id}.joblib"
        joblib.dump({**bundle, "dataset_id": dataset_id, "data_origin": report["data_origin"]}, model_path)
        report.update(details)
        report.update(status="completed", trained_at=_now(), artifact=str(model_path.name), error=None)
    except (DatasetNotAvailable, TrainingError, ValueError, KeyError, ImportError) as exc:
        logger.error("training failed for %s: %s", dataset_id, exc)
        report.update(status="failed", trained_at=None, error=f"{type(exc).__name__}: {exc}",
                      traceback=traceback.format_exc(limit=3))
    (reports_dir / f"{dataset_id}.json").write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    return report


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    backend = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dataset", required=True, choices=["synthetic_do", "aquaponics_do", "mendeley_wq"])
    parser.add_argument("--data-dir", type=Path, default=backend / "data" / "raw")
    parser.add_argument("--artifacts-dir", type=Path, default=backend / "artifacts")
    args = parser.parse_args(argv)
    report = run(args.dataset, args.data_dir, args.artifacts_dir)
    summary = {k: report.get(k) for k in ("experiment_id", "status", "error", "split", "n_train", "n_test", "model_type")}
    print(json.dumps(summary, indent=2))
    if report["status"] == "completed":
        print(json.dumps(report["metrics"], indent=2))
    return 0 if report["status"] == "completed" else 1


if __name__ == "__main__":
    sys.exit(main())
