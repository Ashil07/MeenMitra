from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from ml import features as F
from ml.inference import ModelNotAvailable, load_bundle, predict
from ml.ingest import DO_SERIES_ALIASES, WQ_ALIASES, match_columns
from ml.status import collect_status
from ml.synthetic import generate
from ml.train import run, train_do_series


def test_status_when_datasets_missing(tmp_path: Path) -> None:
    status = collect_status(tmp_path / "raw", tmp_path / "artifacts")
    assert status["overall_state"] == "no_runs"
    assert status["experiments"] == []
    by_id = {d["id"]: d for d in status["datasets"]}
    assert by_id["aquaponics_do"]["local_status"] == "missing"
    assert by_id["mendeley_wq"]["local_status"] == "missing"
    assert by_id["open_meteo"]["local_status"] == "not_applicable"
    assert by_id["aquaponics_do"]["licence_verified"] is False
    assert status["ml_correction_in_forecast"]["applied"] is False


def test_ml_status_endpoint_reflects_disk(client: TestClient) -> None:
    data = client.get("/api/v1/ml/status").json()["data"]
    assert data["overall_state"] == "no_runs"
    assert "accuracy" not in json.dumps(data["experiments"])


def test_synthetic_generator_is_reproducible_and_labelled() -> None:
    a, b = generate(n_ponds=2, days=2, seed=7), generate(n_ponds=2, days=2, seed=7)
    pd.testing.assert_frame_equal(a, b)
    assert set(a["data_origin"]) == {"synthetic"}
    assert len(a) == 2 * 2 * 24
    assert not a.equals(generate(n_ponds=2, days=2, seed=8))


def test_features_use_only_past_values_and_next_hour_target() -> None:
    frame = generate(n_ponds=1, days=2, seed=1)
    hourly = F.hourly_do_frame(frame)
    table, features = F.do_model_table(hourly)
    row = table.iloc[5]
    following = hourly[hourly["hour"] == row["hour"] + pd.Timedelta(hours=1)].iloc[0]
    previous = hourly[hourly["hour"] == row["hour"] - pd.Timedelta(hours=1)].iloc[0]
    assert row[F.DO_TARGET] == pytest.approx(following["do_t"])
    assert row["do_lag1"] == pytest.approx(previous["do_t"])
    assert F.DO_TARGET not in features


def test_group_split_keeps_ponds_disjoint() -> None:
    table, _ = F.do_model_table(F.hourly_do_frame(generate(n_ponds=4, days=3, seed=3)))
    test_mask, description = F.group_holdout_split(table)
    train_ponds = set(table[~test_mask]["pond_id"])
    test_ponds = set(table[test_mask]["pond_id"])
    assert train_ponds and test_ponds and not train_ponds & test_ponds
    assert "group holdout" in description


def test_hourly_resampling_handles_gaps_without_leaking_lags() -> None:
    frame = pd.DataFrame({
        "pond_id": ["p"] * 4,
        "timestamp": ["2026-01-01T00:10Z", "2026-01-01T00:40Z", "2026-01-01T01:15Z", "2026-01-01T04:00Z"],
        "temperature_c": [28, 28, 28, 28], "ph": [7.5] * 4, "dissolved_oxygen_mg_l": [6.0, 8.0, 5.0, 4.0],
    })
    hourly = F.hourly_do_frame(frame)
    assert hourly.loc[0, "do_t"] == pytest.approx(7.0)  # mean of the two 00:xx readings
    gap_row = hourly[hourly["hour"] == pd.Timestamp("2026-01-01T04:00Z")].iloc[0]
    assert np.isnan(gap_row["do_lag1"])  # 03:00 missing → no fabricated lag


def test_column_matching_for_published_headers() -> None:
    kaggle_like = ["created_at", "entry_id", "Temperature (C)", "Turbidity(NTU)", "Dissolved Oxygen(g/ml)",
                   "PH", "Ammonia(g/ml)", "Nitrate(g/ml)", "Fish_Length(cm)"]
    mapping = match_columns(kaggle_like, DO_SERIES_ALIASES)
    assert mapping["timestamp"] == "created_at"
    assert mapping["dissolved_oxygen_mg_l"] == "Dissolved Oxygen(g/ml)"
    assert mapping["ph"] == "PH"
    wq = match_columns(["Temp", "pH", "Phosphorus", "H2S", "DO", "Label"], WQ_ALIASES)
    assert wq["ph"] == "pH" and wq["phosphorus"] == "Phosphorus" and wq["label"] == "Label"


def test_column_matching_for_mendeley_wqd_headers() -> None:
    """Headers exactly as found in WQD.xlsx (Mendeley y78ty2g293), including the 'pH`' typo."""
    headers = ["Temp", "Turbidity (cm)", "DO(mg/L)", "BOD (mg/L)", "CO2", "pH`", "Alkalinity (mg L-1 )",
               "Hardness (mg L-1 )", "Calcium (mg L-1 )", "Ammonia (mg L-1 )", "Nitrite (mg L-1 )",
               "Phosphorus (mg L-1 )", "H2S (mg L-1 )", "Plankton (No. L-1)", "Water Quality"]
    mapping = match_columns(headers, WQ_ALIASES)
    assert set(mapping) == set(F.WQ_FEATURES) | {"label"}
    assert mapping["dissolved_oxygen"] == "DO(mg/L)"
    assert mapping["ph"] == "pH`" and mapping["label"] == "Water Quality"


def test_train_on_synthetic_reports_real_metrics_with_warning() -> None:
    report, bundle = train_do_series(generate(n_ponds=3, days=4, seed=5), dataset_id="synthetic_do",
                                     data_origin="synthetic")
    metrics = report["metrics"]
    assert set(metrics["baseline_persistence"]) == {"mae_mg_l", "rmse_mg_l", "r2"}
    assert metrics["selected_model"] in metrics["models"]
    assert any("synthetic" in w for w in report["warnings"])
    assert report["n_train"] > 0 and report["n_test"] > 0
    assert bundle["features"] == report["features"]


def test_missing_real_dataset_writes_failed_report(tmp_path: Path) -> None:
    report = run("aquaponics_do", tmp_path / "raw", tmp_path / "artifacts")
    assert report["status"] == "failed"
    assert "DatasetNotAvailable" in report["error"]
    status = collect_status(tmp_path / "raw", tmp_path / "artifacts")
    assert status["overall_state"] == "no_runs"
    assert status["experiments"][0]["status"] == "failed"


def test_pipeline_runs_on_small_aquaponics_format_fixture(tmp_path: Path) -> None:
    """Format-only fixture (generated values) shaped like the Kaggle CSVs, written to a temp dir."""
    raw = tmp_path / "raw" / "aquaponics_do"
    raw.mkdir(parents=True)
    synthetic = generate(n_ponds=3, days=3, seed=11, freq_minutes=20)
    for pond, frame in synthetic.groupby("pond_id"):
        pd.DataFrame({
            "created_at": frame["timestamp"], "entry_id": range(len(frame)),
            "Temperature (C)": frame["temperature_c"], "Turbidity(NTU)": frame["turbidity_ntu"],
            "Dissolved Oxygen(g/ml)": frame["dissolved_oxygen_mg_l"], "PH": frame["ph"],
            "Ammonia(g/ml)": frame["ammonia_mg_l"], "Nitrate(g/ml)": 1.0,
        }).to_csv(raw / f"IoT_{pond}.csv", index=False)
    report = run("aquaponics_do", tmp_path / "raw", tmp_path / "artifacts")
    assert report["status"] == "completed", report.get("error")
    assert report["validation"]["schema_ok"] is True
    assert "missing" in report["validation"]
    bundle = load_bundle(tmp_path / "artifacts", "aquaponics_do")
    table, _ = F.do_model_table(F.hourly_do_frame(synthetic.assign(nitrate_mg_l=1.0)))
    assert len(predict(bundle, table.head(3))) == 3
    status = collect_status(tmp_path / "raw", tmp_path / "artifacts")
    assert {d["id"]: d["local_status"] for d in status["datasets"]}["aquaponics_do"] == "present"


def test_wq_schema_failure_is_reported(tmp_path: Path) -> None:
    raw = tmp_path / "raw" / "mendeley_wq"
    raw.mkdir(parents=True)
    pd.DataFrame({"foo": [1, 2], "bar": [3, 4]}).to_csv(raw / "wq.csv", index=False)
    report = run("mendeley_wq", tmp_path / "raw", tmp_path / "artifacts")
    assert report["status"] == "failed" and "schema validation failed" in report["error"]
    status = collect_status(tmp_path / "raw", tmp_path / "artifacts")
    assert {d["id"]: d["local_status"] for d in status["datasets"]}["mendeley_wq"] == "invalid"


def test_wq_classification_on_small_fixture(tmp_path: Path) -> None:
    raw = tmp_path / "raw" / "mendeley_wq"
    raw.mkdir(parents=True)
    rng = np.random.default_rng(0)
    n = 240
    frame = pd.DataFrame({name: rng.uniform(0, 10, n) for name in
                          ["Temperature", "Turbidity", "DO", "BOD", "CO2", "pH", "Ammonia", "Nitrite"]})
    frame["Label"] = np.where(frame["DO"] > 6, 0, np.where(frame["DO"] > 3, 1, 2))
    frame.to_csv(raw / "wq.csv", index=False)
    report = run("mendeley_wq", tmp_path / "raw", tmp_path / "artifacts")
    assert report["status"] == "completed", report.get("error")
    assert "macro_f1" in report["metrics"]["models"][report["model_type"]]
    assert "baseline_majority_class" in report["metrics"]
    assert any("thresholds" in w for w in report["warnings"])


def test_wq_xlsx_loading_plausibility_and_missing_columns(tmp_path: Path) -> None:
    raw = tmp_path / "raw" / "mendeley_wq"
    raw.mkdir(parents=True)
    rng = np.random.default_rng(1)
    n = 200
    frame = pd.DataFrame({"Temp": rng.uniform(0, 80, n), "DO(mg/L)": rng.uniform(0, 14, n), "pH`": rng.uniform(5, 9, n),
                          "BOD (mg/L)": rng.uniform(1, 10, n), "CO2": rng.uniform(0, 10, n),
                          "Ammonia (mg L-1 )": rng.uniform(0, 1, n)})
    frame["Water Quality"] = np.where(frame["DO(mg/L)"] > 6, 0, np.where(frame["DO(mg/L)"] > 3, 1, 2))
    frame.to_excel(raw / "WQD.xlsx", sheet_name="Final_Data", index=False)
    report = run("mendeley_wq", tmp_path / "raw", tmp_path / "artifacts")
    assert report["status"] == "completed", report.get("error")
    assert report["files"] == ["WQD.xlsx"] and len(report["file_sha256"]["WQD.xlsx"]) == 64
    flagged = report["validation"]["outside_pond_plausible_range"]
    assert flagged["temperature"]["rows_outside"] > 0 and flagged["ph"]["rows_outside"] == 0
    assert any("pond-plausible" in w for w in report["warnings"])
    assert any("Expected columns not found" in w and "plankton" in w for w in report["warnings"])
    status = collect_status(tmp_path / "raw", tmp_path / "artifacts")
    assert status["overall_state"] == "trained_on_external_data"
    assert status["experiments"][0]["data_origin"] == "external"
    assert "generated" in {d["id"]: d for d in status["datasets"]}["mendeley_wq"]["data_nature"]


def test_status_maps_legacy_real_origin(tmp_path: Path) -> None:
    reports = tmp_path / "artifacts" / "reports"
    reports.mkdir(parents=True)
    (reports / "mendeley_wq.json").write_text(json.dumps(
        {"experiment_id": "mendeley_wq", "dataset_id": "mendeley_wq", "data_origin": "real", "status": "completed"}))
    status = collect_status(tmp_path / "raw", tmp_path / "artifacts")
    assert status["experiments"][0]["data_origin"] == "external"


def test_inference_without_artifact(tmp_path: Path) -> None:
    with pytest.raises(ModelNotAvailable):
        load_bundle(tmp_path, "synthetic_do")
