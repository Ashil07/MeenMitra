"""Schema validation, missing-value and plausibility reports (machine-readable dicts)."""

from __future__ import annotations

from typing import Any

import pandas as pd

# Physical plausibility ranges used only to FLAG values for review (not to define water quality).
PLAUSIBLE_RANGES: dict[str, tuple[float, float]] = {
    "temperature_c": (0.0, 45.0),
    "ph": (0.0, 14.0),
    "turbidity_ntu": (0.0, 3000.0),
    "dissolved_oxygen_mg_l": (0.0, 20.0),
    "ammonia_mg_l": (0.0, 100.0),
    "nitrate_mg_l": (0.0, 1000.0),
}


# Ranges a fish-pond sample could plausibly show; values outside are FLAGGED, never silently dropped.
WQ_PLAUSIBLE_RANGES: dict[str, tuple[float, float]] = {
    "temperature": (5.0, 40.0),
    "ph": (4.0, 11.0),
    "dissolved_oxygen": (0.0, 20.0),
    "ammonia": (0.0, 10.0),
    "nitrite": (0.0, 10.0),
}


def missing_report(df: pd.DataFrame) -> dict[str, dict[str, float]]:
    return {
        col: {"missing": int(df[col].isna().sum()), "missing_pct": round(float(df[col].isna().mean()) * 100, 2)}
        for col in df.columns
    }


def validate_do_series(df: pd.DataFrame, mappings: dict[str, dict[str, str]], required: tuple[str, ...]) -> dict[str, Any]:
    problems: list[str] = []
    for file_name, mapping in mappings.items():
        absent = [c for c in required if c not in mapping]
        if absent:
            problems.append(f"{file_name}: required columns not found: {absent}")
    report: dict[str, Any] = {
        "rows": int(len(df)),
        "ponds": sorted(df["pond_id"].unique().tolist()) if "pond_id" in df else [],
        "column_mapping": mappings,
        "schema_ok": not problems,
        "problems": problems,
    }
    if problems:
        return report

    numeric = [c for c in df.columns if c not in ("timestamp", "pond_id")]
    coerced = df.copy()
    for col in numeric:
        coerced[col] = pd.to_numeric(coerced[col], errors="coerce")
    timestamps = pd.to_datetime(coerced["timestamp"], errors="coerce", utc=True)
    report["unparseable_timestamps"] = int(timestamps.isna().sum() - df["timestamp"].isna().sum())
    report["missing"] = missing_report(coerced)
    out_of_range = {}
    for col, (low, high) in PLAUSIBLE_RANGES.items():
        if col in coerced:
            series = coerced[col].dropna()
            out_of_range[col] = int(((series < low) | (series > high)).sum())
    report["out_of_plausible_range"] = out_of_range
    report["duplicate_rows"] = int(coerced.duplicated().sum())
    if timestamps.notna().any():
        report["time_span"] = {"start": str(timestamps.min()), "end": str(timestamps.max())}
    return report


def validate_wq_table(df: pd.DataFrame, mapping: dict[str, str], expected: list[str]) -> dict[str, Any]:
    absent = [c for c in expected if c not in mapping]
    report: dict[str, Any] = {
        "rows": int(len(df)),
        "column_mapping": mapping,
        "missing_expected_columns": absent,
        "schema_ok": "label" in mapping and len([c for c in expected if c in mapping and c != "label"]) >= 5,
        "problems": [] if "label" in mapping else ["label column not found"],
    }
    if "label" in mapping:
        report["label_counts"] = {str(k): int(v) for k, v in df["label"].value_counts(dropna=False).items()}
    report["missing"] = missing_report(df)
    report["duplicate_rows"] = int(df.duplicated().sum())
    flagged: dict[str, dict[str, float]] = {}
    for col, (low, high) in WQ_PLAUSIBLE_RANGES.items():
        if col in df:
            series = pd.to_numeric(df[col], errors="coerce").dropna()
            outside = int(((series < low) | (series > high)).sum())
            flagged[col] = {"plausible_min": low, "plausible_max": high, "observed_min": round(float(series.min()), 4),
                            "observed_max": round(float(series.max()), 4), "rows_outside": outside,
                            "pct_outside": round(100.0 * outside / max(len(series), 1), 2)}
    report["outside_pond_plausible_range"] = flagged
    return report
