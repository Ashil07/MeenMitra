"""Collect the real ML execution state for GET /api/v1/ml/status.

Everything reported here is read from disk at request time: which dataset files exist, and which
experiment reports were written by ml.train. Nothing is hardcoded.
"""

from __future__ import annotations

import importlib.util
import json
import logging
from pathlib import Path
from typing import Any

from ml.datasets import REGISTRY
from ml.inference import forecast_correction_available
from ml.ingest import dataset_dir, find_files

logger = logging.getLogger(__name__)

HOW_TO_RUN = [
    "cd backend",
    "python -m ml.train --dataset synthetic_do   # exercises the pipeline; synthetic metrics only",
    "python -m ml.train --dataset aquaponics_do  # after downloading the Kaggle CSVs (see docs/DATASETS.md)",
    "python -m ml.train --dataset mendeley_wq    # after downloading WQD.xlsx (see docs/DATASETS.md)",
]


def _read_report(path: Path) -> dict[str, Any] | None:
    try:
        data: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
        return data
    except (OSError, json.JSONDecodeError) as exc:
        logger.error("could not read experiment report %s: %s", path, exc)
        return None


def collect_status(data_dir: Path, artifacts_dir: Path) -> dict[str, Any]:
    reports: dict[str, dict[str, Any]] = {}
    reports_dir = artifacts_dir / "reports"
    if reports_dir.is_dir():
        for path in sorted(reports_dir.glob("*.json")):
            report = _read_report(path)
            if report is not None:
                reports[report.get("dataset_id", path.stem)] = report

    datasets = []
    for spec in REGISTRY.values():
        files = find_files(data_dir, spec.id)
        directory = dataset_dir(data_dir, spec)
        if spec.local_dir is None:
            local_status = "not_applicable"
        elif not files:
            local_status = "missing"
        else:
            report = reports.get(spec.id)
            invalid = bool(report and report.get("validation") and not report["validation"].get("schema_ok", True))
            local_status = "invalid" if invalid else "present"
        report = reports.get(spec.id)
        datasets.append({
            "id": spec.id,
            "title": spec.title,
            "task": spec.task,
            "source_url": spec.source_url,
            "licence": spec.licence,
            "licence_verified": spec.licence_verified,
            "access": spec.access,
            "local_status": local_status,
            "local_path": None if directory is None else str(directory),
            "files_found": [p.name for p in files],
            "validation": report.get("validation") if report else None,
            "used_in_pipeline": spec.used_in_pipeline,
            "data_nature": spec.data_nature,
            "notes": list(spec.notes),
        })

    experiments = []
    for dataset_id, report in sorted(reports.items()):
        experiments.append({
            "experiment_id": report.get("experiment_id", dataset_id),
            "dataset_id": dataset_id,
            "data_origin": "synthetic" if report.get("data_origin") == "synthetic" else "external",  # legacy "real" → external
            "status": report.get("status", "failed"),
            "trained_at": report.get("trained_at"),
            "task": report.get("task", REGISTRY[dataset_id].task if dataset_id in REGISTRY else ""),
            "target": report.get("target", ""),
            "split": report.get("split", ""),
            "n_train": report.get("n_train"),
            "n_test": report.get("n_test"),
            "model_type": report.get("model_type"),
            "metrics": report.get("metrics", {}),
            "artifact_available": (artifacts_dir / "models" / f"{dataset_id}.joblib").is_file(),
            "warnings": report.get("warnings", []),
            "error": report.get("error"),
        })

    completed = [e for e in experiments if e["status"] == "completed"]
    external = [e for e in completed if e["data_origin"] == "external"]
    if external:
        state = "trained_on_external_data"
        natures = "; ".join(f"{e['dataset_id']}: {REGISTRY[e['dataset_id']].data_nature}" for e in external
                            if e["dataset_id"] in REGISTRY)
        summary = ("Offline experiments have run on downloaded third-party datasets (" + natures + "). None was "
                   "collected from the target ponds, and none is used to correct the demo forecast.")
    elif completed:
        state = "synthetic_only"
        summary = ("Only synthetic-data experiments have run. They show the pipeline works; they say nothing about "
                   "real-world accuracy. Real datasets are not present locally.")
    else:
        state = "no_runs"
        summary = "No training run has completed yet. Real datasets are not present locally."

    correction = forecast_correction_available(artifacts_dir)
    return {
        "overall_state": state,
        "summary": summary,
        "datasets": datasets,
        "experiments": experiments,
        "ml_correction_in_forecast": {
            "applied": False,
            "model_available": correction,
            "reason": "No model has been trained on features compatible with the demo forecast "
                      "(pond profile + weather → overnight oxygen), because no labelled overnight DO series "
                      "with matching weather is available for the target ponds.",
        },
        "optional_libraries": {"xgboost": importlib.util.find_spec("xgboost") is not None},
        "how_to_run": HOW_TO_RUN,
    }
