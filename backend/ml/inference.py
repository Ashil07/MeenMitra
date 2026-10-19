"""Load a trained experiment artifact and run predictions on its own feature set.

The backend forecast does NOT use these models: none is trained on features compatible with the
weather-driven overnight-risk engine. This module exists so trained experiments can be exercised.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import pandas as pd


class ModelNotAvailable(FileNotFoundError):
    pass


def load_bundle(artifacts_dir: Path, experiment_id: str) -> dict[str, Any]:
    path = artifacts_dir / "models" / f"{experiment_id}.joblib"
    if not path.is_file():
        raise ModelNotAvailable(f"no trained artifact at {path}; run `python -m ml.train --dataset {experiment_id}`")
    bundle: dict[str, Any] = joblib.load(path)
    return bundle


def predict(bundle: dict[str, Any], rows: pd.DataFrame) -> list[float]:
    missing = [c for c in bundle["features"] if c not in rows]
    if missing:
        raise ValueError(f"input is missing feature columns: {missing}")
    return [float(v) for v in bundle["model"].predict(rows[bundle["features"]].to_numpy())]


def forecast_correction_available(artifacts_dir: Path) -> bool:
    """True only if a model trained for the forecast's own feature set exists. None does in this MVP."""
    return (artifacts_dir / "models" / "forecast_correction.joblib").is_file()
