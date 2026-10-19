"""Locate and load locally downloaded dataset files into canonical column names.

Nothing here downloads data. Users place files under ML_DATA_DIR/<dataset_id>/ (see docs/DATASETS.md).
"""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

import pandas as pd

from ml.datasets import REGISTRY, DatasetSpec

# canonical name -> predicate over a normalised header (lowercase alphanumerics only)
DO_SERIES_ALIASES: dict[str, tuple[str, ...]] = {
    "timestamp": ("createdat", "timestamp", "datetime", "date", "time"),
    "temperature_c": ("temperature", "temp", "watertemperature"),
    "ph": ("ph",),
    "turbidity_ntu": ("turbidity",),
    "dissolved_oxygen_mg_l": ("dissolvedoxygen", "do", "domg"),  # "domg" catches headers like "DO(mg/L)"
    "ammonia_mg_l": ("ammonia",),
    "nitrate_mg_l": ("nitrate",),
}
DO_SERIES_REQUIRED = ("timestamp", "temperature_c", "ph", "dissolved_oxygen_mg_l")

WQ_ALIASES: dict[str, tuple[str, ...]] = {
    "temperature": ("temperature", "temp"),
    "turbidity": ("turbidity",),
    "dissolved_oxygen": ("dissolvedoxygen", "do", "domg"),
    "bod": ("bod", "biochemicaloxygendemand"),
    "co2": ("co2", "carbondioxide"),
    "ph": ("ph",),
    "alkalinity": ("alkalinity",),
    "hardness": ("hardness",),
    "calcium": ("calcium",),
    "ammonia": ("ammonia",),
    "nitrite": ("nitrite",),
    "phosphorus": ("phosphorus", "phosphate"),
    "h2s": ("h2s", "hydrogensulfide", "hydrogensulphide"),
    "plankton": ("plankton",),
    "label": ("label", "grade", "class", "target", "waterquality", "quality"),
}


class DatasetNotAvailable(FileNotFoundError):
    pass


def normalise(header: str) -> str:
    return re.sub(r"[^a-z0-9]", "", header.lower())


def match_columns(columns: list[str], aliases: dict[str, tuple[str, ...]]) -> dict[str, str]:
    """Map canonical names to source columns. Exact normalised matches win over prefix matches."""
    norm = {c: normalise(c) for c in columns}
    mapping: dict[str, str] = {}
    used: set[str] = set()
    for exact in (True, False):
        for canonical, keys in aliases.items():
            if canonical in mapping:
                continue
            for col, n in norm.items():
                if col in used:
                    continue
                hit = n in keys if exact else any(n.startswith(k) for k in keys if len(k) > 2)
                if hit:
                    mapping[canonical] = col
                    used.add(col)
                    break
    return mapping


def dataset_dir(data_dir: Path, spec: DatasetSpec) -> Path | None:
    return None if spec.local_dir is None else data_dir / spec.local_dir


def find_files(data_dir: Path, dataset_id: str) -> list[Path]:
    spec = REGISTRY[dataset_id]
    directory = dataset_dir(data_dir, spec)
    if directory is None or not directory.is_dir():
        return []
    files: list[Path] = []
    for pattern in spec.file_patterns:
        files.extend(p for p in directory.glob(pattern) if p.is_file() and p.name != "README.md")
    return sorted(set(files))


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_table(path: Path) -> pd.DataFrame:
    """Read a CSV, or the first sheet of an .xlsx workbook (needs openpyxl)."""
    if path.suffix.lower() == ".xlsx":
        return pd.read_excel(path, sheet_name=0, engine="openpyxl")
    return pd.read_csv(path)


def fingerprint(files: list[Path]) -> str:
    digest = hashlib.sha256()
    for path in sorted(files):
        digest.update(path.name.encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


def load_do_series(files: list[Path]) -> tuple[pd.DataFrame, dict[str, dict[str, str]]]:
    """Load aquaponics-style CSVs (one file per pond) into canonical columns + pond_id."""
    if not files:
        raise DatasetNotAvailable("no CSV files found")
    frames = []
    mappings: dict[str, dict[str, str]] = {}
    for path in files:
        raw = pd.read_csv(path)
        mapping = match_columns(list(raw.columns), DO_SERIES_ALIASES)
        mappings[path.name] = mapping
        frame = pd.DataFrame({canonical: raw[col] for canonical, col in mapping.items()})
        frame["pond_id"] = path.stem
        frames.append(frame)
    return pd.concat(frames, ignore_index=True), mappings


def load_wq_table(files: list[Path]) -> tuple[pd.DataFrame, dict[str, str]]:
    if not files:
        raise DatasetNotAvailable("no CSV files found")
    raw = pd.concat([read_table(p) for p in files], ignore_index=True)
    mapping = match_columns(list(raw.columns), WQ_ALIASES)
    return pd.DataFrame({canonical: raw[col] for canonical, col in mapping.items()}), mapping
