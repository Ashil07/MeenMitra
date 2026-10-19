"""Registry of datasets referenced by the MeenMitra proposal.

Facts recorded here were checked on 2026-10-19 against the public dataset pages or associated
articles (see docs/DATASETS.md). Where something could not be verified it is stated explicitly.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class DatasetSpec:
    id: str
    title: str
    task: str
    source_url: str
    licence: str
    licence_verified: bool
    access: str
    local_dir: str | None  # sub-directory of ML_DATA_DIR where the user places downloaded files
    file_patterns: tuple[str, ...]
    used_in_pipeline: bool
    data_nature: str
    notes: tuple[str, ...] = field(default_factory=tuple)


AQUAPONICS_DO = DatasetSpec(
    id="aquaponics_do",
    title="Sensor Based Aquaponics Fish Pond Datasets (Kaggle, ogbuokiriblessing)",
    task="Regression: next-hour dissolved oxygen (mg/L) from current sensor readings (experiment)",
    source_url="https://www.kaggle.com/datasets/ogbuokiriblessing/sensor-based-aquaponics-fish-pond-datasets",
    licence="Not verified from the Kaggle page. The associated data article (PMC9253161) is CC BY 4.0.",
    licence_verified=False,
    access="Manual download with a Kaggle account (or the Kaggle CLI with your own token). "
           "Place IoT_pond*.csv files in data/raw/aquaponics_do/.",
    local_dir="aquaponics_do",
    file_patterns=("*.csv",),
    used_in_pipeline=True,
    data_nature="Measured by IoT sensors in aquaponics tanks (per the data article); not verified first-hand",
    notes=(
        "Per the data article: 12 CSV files (IoT_pond1..12), ESP32 sensors sampling every 5 s; columns include "
        "created_at, Temperature (°C), Turbidity (NTU), Dissolved Oxygen (mg/l), pH, Ammonia (mg/l), Nitrate (mg/l), "
        "plus manual fish length/weight.",
        "Collected from aquaponics tanks with African catfish at the University of Nigeria, Nsukka — not coastal "
        "Karnataka earthen ponds. No weather variables, so it cannot train the weather-driven overnight-risk model.",
        "Low-cost DO probes drift; plausibility checks flag out-of-range values rather than silently dropping them.",
    ),
)

MENDELEY_WQ = DatasetSpec(
    id="mendeley_wq",
    title="Aquaculture - Water Quality Dataset (Mendeley Data, DOI 10.17632/y78ty2g293.1)",
    task="Classification: water-quality grade (0 excellent, 1 good, 2 poor) from 14 parameters",
    source_url="https://data.mendeley.com/datasets/y78ty2g293/1",
    licence="CC BY 4.0 (stated on the dataset page)",
    licence_verified=True,
    access="Public download (no login) from Mendeley Data: WQD.xlsx, 925,902 bytes, SHA-256 "
           "5f50c56347c6314e1ac9bd3ce27e7edabd9a005eecd02713ad059cb388ece261. Place it in data/raw/mendeley_wq/.",
    local_dir="mendeley_wq",
    file_patterns=("*.csv", "*.xlsx"),
    used_in_pipeline=True,
    data_nature="Appears generated within threshold ranges (contributors credited with 'Simulation'), not measured",
    notes=(
        "Page states 4,300 samples (1,500 poor, 1,400 excellent, 1,400 good) with 14 inputs: temperature, turbidity, "
        "DO, BOD, CO2, pH, alkalinity, hardness, calcium, ammonia, nitrite, phosphorus, H2S, plankton.",
        "Page says the data was 'prepared based on the threshold values' of each feature, so labels are likely "
        "derived from the features themselves. High scores would reflect recovering those thresholds, not field "
        "validation.",
        "Verified from the downloaded file (2026-10-19): one sheet 'Final_Data', 4,300 rows x 15 columns, label "
        "column 'Water Quality' with 1,400 x 0, 1,400 x 1, 1,500 x 2. Version 2 (2026-08-07) holds the same file "
        "(identical SHA-256) as version 1.",
        "Contributors are credited with 'Simulation', and values span physically implausible ranges for fish ponds "
        "(e.g. temperature 0.2-84 °C, pH 0.004-14.85): the samples appear generated within ranges, not measured.",
        "Turbidity is given in cm (likely Secchi depth), not NTU; several unit labels are informal (e.g. 'pH`').",
        "This is a classification task. It is never merged with DO time series.",
    ),
)

FISH_DISEASE = DatasetSpec(
    id="fish_disease_images",
    title="Freshwater Fish Disease Aquaculture in South Asia (Kaggle, subirbiswas19)",
    task="Image classification of fish diseases (7 classes) — not used by this MVP",
    source_url="https://www.kaggle.com/datasets/subirbiswas19/freshwater-fish-disease-aquaculture-in-south-asia",
    licence="Not verified from the Kaggle page.",
    licence_verified=False,
    access="Manual download with a Kaggle account. Not required for the MVP.",
    local_dir="fish_disease_images",
    file_patterns=("*",),
    used_in_pipeline=False,
    data_nature="Photographs collected from websites and institutes (per secondary sources); not verified",
    notes=(
        "Secondary descriptions report 7 classes (e.g. aeromoniasis, bacterial gill disease, bacterial red disease, "
        "saprolegniasis, parasitic disease, white tail disease, healthy) with roughly 250 images each; counts differ "
        "slightly between sources and were not verified first-hand.",
        "Image data with a different target; kept fully separate from dissolved-oxygen prediction. The MVP's symptom "
        "rules do not use it and do not diagnose disease.",
    ),
)

OPEN_METEO = DatasetSpec(
    id="open_meteo",
    title="Open-Meteo forecast and historical weather API",
    task="Weather inputs for forecasts (optional live input); historical archive for future model training",
    source_url="https://open-meteo.com/en/terms",
    licence="Data under CC BY 4.0; free tier is for non-commercial use with daily/hourly call limits.",
    licence_verified=True,
    access="No API key needed for the free tier. Enabled with WEATHER_PROVIDER=open_meteo; the demo works offline.",
    local_dir=None,
    file_patterns=(),
    used_in_pipeline=False,
    data_nature="Numerical weather model output (forecast/reanalysis), not station observations",
    notes=(
        "Not a training dataset in the MVP: no paired measured pond DO is available for Karnataka ponds.",
        "Commercial deployment would need a paid Open-Meteo plan or another provider.",
    ),
)

SYNTHETIC_DO = DatasetSpec(
    id="synthetic_do",
    title="Synthetic diel DO time series (generated locally by ml.synthetic)",
    task="Exercises the DO regression pipeline end to end",
    source_url="local:ml/synthetic.py",
    licence="Generated by this repository",
    licence_verified=True,
    access="Generated on demand; no download.",
    local_dir=None,
    file_patterns=(),
    used_in_pipeline=True,
    data_nature="Generated by ml/synthetic.py",
    notes=("Synthetic data proves only that the code runs. Its metrics say nothing about real-world accuracy.",),
)

REGISTRY: dict[str, DatasetSpec] = {
    d.id: d for d in (AQUAPONICS_DO, MENDELEY_WQ, FISH_DISEASE, OPEN_METEO, SYNTHETIC_DO)
}
