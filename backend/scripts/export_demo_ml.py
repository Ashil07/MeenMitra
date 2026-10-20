"""Export the real results of the last training runs for the frontend demo.

Reads artifacts/reports/*.json and artifacts/models/*.joblib, reproduces each experiment's held-out
test split, and writes the saved model's actual predictions on a few test rows. Nothing is invented:
the script re-scores the whole test set and stops if the result differs from the stored report.

    python -m scripts.export_demo_ml [--out ../frontend/src/api/mock/ml_results.json]
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

from ml import features as F
from ml.evaluate import classification_metrics, regression_metrics
from ml.ingest import find_files, load_wq_table
from ml.inference import load_bundle
from ml.synthetic import generate
from ml.train import RANDOM_STATE

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"
DATA = ROOT / "data" / "raw"
DEFAULT_OUT = ROOT.parent / "frontend" / "src" / "api" / "mock" / "ml_results.json"

GRADE = {0: "excellent", 1: "good", 2: "poor"}
WQ_SHOWN = ["dissolved_oxygen", "ph", "ammonia", "temperature", "turbidity"]
SAMPLES_PER_GRADE = 2
DO_HOURS = 36


def _report(experiment_id: str) -> dict[str, Any]:
    report = json.loads((ARTIFACTS / "reports" / f"{experiment_id}.json").read_text(encoding="utf-8"))
    if report.get("status") != "completed":
        raise SystemExit(f"{experiment_id}: last training run did not complete ({report.get('error')})")
    return report


def _check(name: str, got: float, stored: float) -> None:
    if not math.isclose(got, stored, abs_tol=1e-4):
        raise SystemExit(f"{name}: re-scored {got} but the report says {stored}; retrain before exporting")


def water_quality() -> dict[str, Any]:
    report = _report("mendeley_wq")
    bundle = load_bundle(ARTIFACTS, "mendeley_wq")
    frame, _ = load_wq_table(find_files(DATA, "mendeley_wq"))
    cols = bundle["features"]
    data = frame[[*cols, "label"]].apply(pd.to_numeric, errors="coerce").dropna()
    X, y = data[cols].to_numpy(), data["label"].astype(int).to_numpy()
    _, X_test, _, y_test = train_test_split(X, y, test_size=0.25, random_state=RANDOM_STATE, stratify=y)
    model = bundle["model"]
    pred = model.predict(X_test)
    proba = model.predict_proba(X_test)
    labels = sorted(np.unique(y).tolist())
    rescored = classification_metrics(y_test, pred, labels)
    best = report["metrics"]["models"][report["model_type"]]
    _check("mendeley_wq accuracy", rescored["accuracy"], best["accuracy"])

    classes = list(model.classes_)
    samples = []
    for grade in labels:
        for i in np.flatnonzero(y_test == grade)[:SAMPLES_PER_GRADE]:
            row = dict(zip(cols, X_test[i]))
            samples.append({
                "inputs": {k: round(float(row[k]), 2) for k in WQ_SHOWN if k in row},
                "actual": GRADE[int(y_test[i])],
                "predicted": GRADE[int(pred[i])],
                "confidence": round(float(proba[i][classes.index(pred[i])]), 2),
            })
    m = report["metrics"]
    return {
        "trained_at": report["trained_at"],
        "rows": report["validation"]["rows"],
        "n_train": report["n_train"],
        "n_test": report["n_test"],
        "features": cols,
        "split": report["split"],
        "model_type": report["model_type"],
        "accuracy": best["accuracy"],
        "macro_f1": best["macro_f1"],
        "compare": {
            name: {"accuracy": v["accuracy"], "macro_f1": v["macro_f1"]}
            for name, v in m["models"].items() if name != report["model_type"]
        },
        "baseline": {"accuracy": m["baseline_majority_class"]["accuracy"], "macro_f1": m["baseline_majority_class"]["macro_f1"]},
        "confusion_matrix": best["confusion_matrix"],
        "samples": samples,
        "warnings": report["warnings"],
    }


def oxygen() -> dict[str, Any]:
    report = _report("synthetic_do")
    bundle = load_bundle(ARTIFACTS, "synthetic_do")
    table, cols = F.do_model_table(F.hourly_do_frame(generate()))
    test_mask, _ = F.group_holdout_split(table)
    test = table[test_mask]
    pred = bundle["model"].predict(test[cols].to_numpy())
    rescored = regression_metrics(test[F.DO_TARGET].to_numpy(), pred)
    best = report["metrics"]["models"][report["model_type"]]
    _check("synthetic_do MAE", rescored["mae_mg_l"], best["mae_mg_l"])

    pond = sorted(test["pond_id"].unique())[0]
    one = test.assign(pred=pred)[test["pond_id"] == pond].sort_values("hour")
    # Start at 6 PM so the window covers one evening and night.
    start = one.index[(one["hour"].dt.hour == 18)][0]
    window = one.loc[start:].head(DO_HOURS)
    series = [{
        "hour": (h + pd.Timedelta(hours=1)).isoformat(),
        "actual": round(float(a), 2),
        "predicted": round(float(p), 2),
        "persistence": round(float(d), 2),
    } for h, a, p, d in zip(window["hour"], window[F.DO_TARGET], window["pred"], window["do_t"])]
    m = report["metrics"]
    return {
        "trained_at": report["trained_at"],
        "rows": report["validation"]["rows"],
        "n_train": report["n_train"],
        "n_test": report["n_test"],
        "features": cols,
        "split": report["split"],
        "model_type": report["model_type"],
        "mae_mg_l": best["mae_mg_l"],
        "rmse_mg_l": best["rmse_mg_l"],
        "r2": best["r2"],
        "skill_vs_persistence_mae": best["skill_vs_persistence_mae"],
        "baseline": m["baseline_persistence"],
        "compare": {name: v for name, v in m["models"].items() if name != report["model_type"]},
        "series_pond": pond,
        "series": series,
        "warnings": report["warnings"],
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args(argv)
    payload = {"water_quality": water_quality(), "oxygen": oxygen()}
    args.out.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
