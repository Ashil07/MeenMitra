"""Evaluation metrics computed from actual predictions."""

from __future__ import annotations

from typing import Any

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)


def regression_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    return {
        "mae_mg_l": round(float(mean_absolute_error(y_true, y_pred)), 4),
        "rmse_mg_l": round(float(np.sqrt(mean_squared_error(y_true, y_pred))), 4),
        "r2": round(float(r2_score(y_true, y_pred)), 4),
    }


def skill_vs_baseline(model_mae: float, baseline_mae: float) -> float | None:
    """1 - MAE_model / MAE_baseline. Positive means better than the baseline."""
    if baseline_mae == 0:
        return None
    return round(1.0 - model_mae / baseline_mae, 4)


def classification_metrics(y_true: np.ndarray, y_pred: np.ndarray, labels: list[Any]) -> dict[str, Any]:
    return {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "macro_f1": round(float(f1_score(y_true, y_pred, average="macro", labels=labels, zero_division=0)), 4),
        "confusion_matrix": {
            "labels": [str(label) for label in labels],
            "matrix": confusion_matrix(y_true, y_pred, labels=labels).tolist(),
        },
    }
