"""Synthetic diel dissolved-oxygen series for development and pipeline tests.

Every row is labelled data_origin='synthetic'. The generator encodes textbook qualitative behaviour
(DO peaks in late afternoon, falls overnight, cloudy days have smaller swings, warm water holds less
oxygen). It is NOT a model of any real pond and its metrics prove nothing about real accuracy.

Usage:  python -m ml.synthetic --out data/synthetic/synthetic_do.csv
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

import numpy as np
import pandas as pd


def generate(n_ponds: int = 6, days: int = 21, seed: int = 42, freq_minutes: int = 60) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    start = pd.Timestamp("2026-01-01T00:00:00Z")
    steps = days * 24 * 60 // freq_minutes
    times = pd.date_range(start, periods=steps, freq=f"{freq_minutes}min")
    hours = times.hour + times.minute / 60.0
    day_index = (times - start).days

    rows = []
    for p in range(n_ponds):
        stocking = rng.uniform(0.6, 1.4)  # relative demand
        cloud_by_day = rng.uniform(0, 1, size=days)
        noise = 0.0
        for i, ts in enumerate(times):
            cloud = cloud_by_day[day_index[i]]
            temp = 28 + 2.5 * math.sin(2 * math.pi * (hours[i] - 9) / 24) + rng.normal(0, 0.3)
            saturation = 14.6 - 0.39 * temp + 0.007 * temp**2  # rough freshwater saturation curve, mg/L
            amplitude = (2.5 - 1.6 * cloud) * (1.1 - 0.3 * (stocking - 1))
            mean_level = 0.75 * saturation - 1.2 * (stocking - 1)
            diel = amplitude * math.sin(2 * math.pi * (hours[i] - 10) / 24)
            noise = 0.7 * noise + rng.normal(0, 0.15)
            do = max(0.2, mean_level + diel + noise)
            ph = 7.4 + 0.25 * diel / max(amplitude, 0.1) + rng.normal(0, 0.05)
            rows.append({
                "pond_id": f"synthetic_pond_{p + 1:02d}",
                "timestamp": ts.isoformat(),
                "temperature_c": round(temp, 2),
                "ph": round(ph, 2),
                "turbidity_ntu": round(abs(rng.normal(30 + 20 * stocking, 5)), 1),
                "ammonia_mg_l": round(abs(rng.normal(0.3 * stocking, 0.05)), 3),
                "dissolved_oxygen_mg_l": round(do, 2),
                "data_origin": "synthetic",
            })
    return pd.DataFrame(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--ponds", type=int, default=6)
    parser.add_argument("--days", type=int, default=21)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    frame = generate(args.ponds, args.days, args.seed)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(args.out, index=False)
    print(f"wrote {len(frame)} synthetic rows to {args.out}")


if __name__ == "__main__":
    main()
