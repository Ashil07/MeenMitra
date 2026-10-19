"""Feature/target definitions.

DO series (aquaponics_do, synthetic_do)
    unit of analysis : one pond-hour (raw readings averaged per hour)
    target           : dissolved_oxygen_mg_l in the NEXT hour (mg/L)
    features         : current-hour DO, DO 1 h and 2 h earlier, DO change over the last hour,
                       temperature, pH, turbidity/ammonia/nitrate when present, hour-of-day (sin/cos)
    leakage guard    : only values at or before hour t are used to predict t+1; split holds out whole ponds

Water-quality grade (mendeley_wq)
    unit of analysis : one sample row
    target           : label (0 excellent, 1 good, 2 poor)
    features         : the 14 measured parameters that are present
"""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

DO_TARGET = "target_do_next_hour_mg_l"
DO_BASE_FEATURES = ["do_t", "do_lag1", "do_lag2", "do_delta_1h", "temperature_c", "ph", "hour_sin", "hour_cos"]
DO_OPTIONAL_FEATURES = ["turbidity_ntu", "ammonia_mg_l", "nitrate_mg_l"]

WQ_FEATURES = ["temperature", "turbidity", "dissolved_oxygen", "bod", "co2", "ph", "alkalinity",
               "hardness", "calcium", "ammonia", "nitrite", "phosphorus", "h2s", "plankton"]


def hourly_do_frame(df: pd.DataFrame) -> pd.DataFrame:
    """Average raw readings per pond-hour and build lag features and the next-hour target."""
    data = df.copy()
    data["timestamp"] = pd.to_datetime(data["timestamp"], errors="coerce", utc=True)
    data = data.dropna(subset=["timestamp"])
    numeric = [c for c in data.columns if c not in ("timestamp", "pond_id")]
    for col in numeric:
        data[col] = pd.to_numeric(data[col], errors="coerce")
    data["hour"] = data["timestamp"].dt.floor("h")
    hourly = data.groupby(["pond_id", "hour"], as_index=False)[numeric].mean()

    frames = []
    for _, group in hourly.groupby("pond_id", sort=True):
        g = group.sort_values("hour").set_index("hour")
        # Reindex to a complete hourly grid so lags never jump across gaps.
        full = g.reindex(pd.date_range(g.index.min(), g.index.max(), freq="h"))
        full["pond_id"] = group["pond_id"].iloc[0]
        full["do_t"] = full["dissolved_oxygen_mg_l"]
        full["do_lag1"] = full["do_t"].shift(1)
        full["do_lag2"] = full["do_t"].shift(2)
        full["do_delta_1h"] = full["do_t"] - full["do_lag1"]
        full[DO_TARGET] = full["do_t"].shift(-1)
        hours = full.index.hour + full.index.minute / 60.0
        full["hour_sin"] = np.sin(2 * math.pi * hours / 24.0)
        full["hour_cos"] = np.cos(2 * math.pi * hours / 24.0)
        full.index.name = "hour"
        frames.append(full.reset_index())
    if not frames:
        return pd.DataFrame(columns=["pond_id", "hour", *DO_BASE_FEATURES, DO_TARGET])
    out = pd.concat(frames, ignore_index=True)
    return out


def do_feature_columns(frame: pd.DataFrame) -> list[str]:
    optional = [c for c in DO_OPTIONAL_FEATURES if c in frame and frame[c].notna().mean() > 0.5]
    return DO_BASE_FEATURES + optional


def do_model_table(frame: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    features = do_feature_columns(frame)
    table = frame.dropna(subset=[*features, DO_TARGET]).reset_index(drop=True)
    return table, features


def group_holdout_split(table: pd.DataFrame, test_fraction: float = 0.25) -> tuple[pd.Series, str]:
    """Hold out whole ponds (sorted ids, last ones) — deterministic and leakage-safe across ponds.

    With fewer than two ponds, fall back to a chronological split (last 20% of hours for test).
    Returns a boolean mask for test rows and a description of the split.
    """
    ponds = sorted(table["pond_id"].unique().tolist())
    if len(ponds) >= 2:
        n_test = max(1, int(math.ceil(len(ponds) * test_fraction)))
        test_ponds = ponds[-n_test:]
        return table["pond_id"].isin(test_ponds), f"group holdout by pond: test ponds {test_ponds}"
    cutoff = table["hour"].quantile(0.8)
    return table["hour"] > cutoff, f"chronological split within single pond at {cutoff}"
