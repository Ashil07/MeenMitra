# Dataset provenance and acquisition

Checked on 2026-10-19. **No dataset is committed to the repository**: `data/raw/` is git-ignored.
The registry in [ml/datasets.py](../ml/datasets.py) mirrors this page and is served by
`GET /api/v1/ml/status` together with local availability.

| Dataset | Use in MVP | Licence | Local path |
|---|---|---|---|
| Kaggle *Sensor Based Aquaponics Fish Pond Datasets* | DO regression experiment | **Unverified** on Kaggle; associated article is CC BY 4.0 | `data/raw/aquaponics_do/*.csv` |
| Mendeley *Aquaculture - Water Quality Dataset* (10.17632/y78ty2g293, v1 = v2 file) | Water-quality grade classification experiment (**run**) | CC BY 4.0 | `data/raw/mendeley_wq/WQD.xlsx` |
| Kaggle *Freshwater Fish Disease Aquaculture in South Asia* | Not used | **Unverified** | — |
| Open-Meteo forecast/historical API | Optional live weather input | CC BY 4.0 data; free tier non-commercial | — (API) |
| Synthetic diel DO (`ml/synthetic.py`) | Pipeline exercise only | Generated here | — |

## 1. Sensor Based Aquaponics Fish Pond Datasets

* Source: <https://www.kaggle.com/datasets/ogbuokiriblessing/sensor-based-aquaponics-fish-pond-datasets>
* Described in an open-access data article (PMC9253161, CC BY 4.0): 12 CSV files (`IoT_pond1.csv`
  … `IoT_pond12.csv`), ESP32 + low-cost sensors uploading every 5 s. Columns: `created_at`,
  `entry_id`, temperature (°C), turbidity (NTU), dissolved oxygen (mg/L per the article), pH,
  ammonia (mg/L), nitrate (mg/L), plus manually measured fish length (cm) and weight (g).
* Context: aquaponics tanks with African catfish (*Clarias gariepinus*) at the University of
  Nigeria, Nsukka. These are **not** earthen ponds in Karnataka, and the data has **no weather
  variables**.
* Not verified first-hand: the Kaggle licence, exact header spelling, units printed in the CSV
  headers, and the collection period. The loader matches columns by name, and
  `validation.column_mapping` shows what it matched.
* Acquire: sign in to Kaggle, accept the dataset terms, download, and place the CSVs in
  `backend/data/raw/aquaponics_do/`. Or, with your own Kaggle API token (never commit it):
  `kaggle datasets download -d ogbuokiriblessing/sensor-based-aquaponics-fish-pond-datasets -p data/raw/aquaponics_do --unzip`.

## 2. Mendeley Aquaculture - Water Quality Dataset

* Source: <https://data.mendeley.com/datasets/y78ty2g293/1>. Licence CC BY 4.0 (stated on the page and in
  the public API's `data_licence` field). Credit: V. Veeramsetty, R. Arabelli, T. Bernatin (SR University).
* Page description: 4,300 samples (1,500 poor, 1,400 excellent, 1,400 good). 14 inputs:
  temperature, turbidity, DO, BOD, CO2, pH, alkalinity, hardness, calcium, ammonia, nitrite,
  phosphorus, H2S, plankton. Label: 0 excellent, 1 good, 2 poor.
* **Verified from the downloaded file (2026-10-19):** `WQD.xlsx`, 925,902 bytes, SHA-256
  `5f50c56347c6314e1ac9bd3ce27e7edabd9a005eecd02713ad059cb388ece261`. Version 2 (published
  2026-08-07) contains the identical file. One sheet, `Final_Data`, with 4,300 rows × 15 columns:
  `Temp`, `Turbidity (cm)`, `DO(mg/L)`, `BOD (mg/L)`, `CO2`, `` pH` ``, `Alkalinity (mg L-1 )`,
  `Hardness (mg L-1 )`, `Calcium (mg L-1 )`, `Ammonia (mg L-1 )`, `Nitrite (mg L-1 )`,
  `Phosphorus (mg L-1 )`, `H2S (mg L-1 )`, `Plankton (No. L-1)`, `Water Quality`. Labels:
  1,400 × 0, 1,400 × 1, 1,500 × 2. No missing values, no duplicate rows.
* **The data appears generated, not measured.** Contributors are credited with "Simulation", the page
  says it was "prepared based on the threshold values", and values fall outside anything a fish pond
  could show: temperature 0.19–84.3 °C (3.4 % of rows outside 5–40 °C) and pH 0.004–14.85 (3.0 % outside
  4–11). Turbidity is in cm (likely Secchi depth), not NTU. Labels are probably a deterministic
  function of the features, so a high-scoring classifier is recovering those thresholds. That is not
  field validation.
* Acquire (public, no login): download `WQD.xlsx` from the dataset page (or the public API
  `https://data.mendeley.com/public-api/datasets/y78ty2g293/files?folder_id=root&version=1`, which lists
  the download URL and hash) into `backend/data/raw/mendeley_wq/`, and check the SHA-256 above.
  Reading `.xlsx` needs `openpyxl` (in `requirements.txt`).

## 3. Freshwater Fish Disease Aquaculture in South Asia

* Source: <https://www.kaggle.com/datasets/subirbiswas19/freshwater-fish-disease-aquaculture-in-south-asia>
* Secondary sources describe an image dataset with 7 classes (bacterial and fungal diseases,
  parasitic disease, white tail disease, healthy) of roughly 250 images each. Counts differ
  slightly between sources and were not verified first-hand. Licence unverified.
* **Not used.** It is an image-classification task with a different target. It is never merged
  with DO data, and the MVP's symptom rules do not diagnose disease.

## 4. Open-Meteo

* Terms: <https://open-meteo.com/en/terms>. Data under CC BY 4.0 (attribution required). The free
  tier is for non-commercial use with call limits (fewer than 10,000/day). Commercial use needs a
  paid plan.
* Used only when `WEATHER_PROVIDER=open_meteo`. The demo runs fully offline without it.
* Not a training dataset in the MVP: there are no paired DO measurements for target ponds.

## 5. Synthetic diel DO

`python -m ml.synthetic --out data/synthetic/synthetic_do.csv` (deterministic for a seed). Each
row carries `data_origin=synthetic`. It exists so the pipeline and tests run without downloads.
Its metrics carry no information about real-world accuracy.

## What is still missing for the real product

A labelled **overnight DO time series from earthen ponds in coastal Karnataka**, paired with local
weather, pond geometry, stocking and aeration logs. Without it, neither the physics baseline nor
an ML correction can be calibrated or validated.
