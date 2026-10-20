/**
 * DEMO SEED DATA — fictional farmers, ponds and phone numbers for mock mode.
 * Village names are real places in Udupi / Dakshina Kannada used only as labels;
 * no coordinates are stored and canal names are invented.
 */
import type { Alert, Forecast, MlStatus, Pond, PondInput, WaterCheck } from "../types";
import { DEMO_SCENARIOS, demoForecast, demoWaterCheck } from "./generators";
import { outbreakNoticeMessage } from "./messages";
import ML from "./ml_results.json";

export interface MockState {
  version: 1;
  seq: number;
  ponds: Pond[];
  forecasts: Forecast[];
  waterChecks: WaterCheck[];
  alerts: Alert[];
  feedback: { id: string; pond_id: string; response: 1 | 2 | 3; created_at: string; before: number; after: number }[];
}

const SEED_PONDS: (PondInput & { id: string })[] = [
  { id: "pond-1", name: "Kere 1", farmer_name: "Ramesh K. (demo)", phone: "+919000000001", village: "Brahmavar", canal: "Canal A (demo)", area_m2: 2000, depth_m: 1.5, species: "rohu", stocking_date: "", fish_count: 6000, has_aerator: true, algae_level: "high" },
  { id: "pond-2", name: "Hosa Kere", farmer_name: "Savitha N. (demo)", phone: "+919000000002", village: "Brahmavar", canal: "Canal A (demo)", area_m2: 1200, depth_m: 1.2, species: "catla", stocking_date: "", fish_count: 3000, has_aerator: false, algae_level: "medium" },
  { id: "pond-3", name: "Temple Tank Pond", farmer_name: "Prakash S. (demo)", phone: "+919000000003", village: "Kota", canal: "Canal B (demo)", area_m2: 3500, depth_m: 1.8, species: "rohu", stocking_date: "", fish_count: 7000, has_aerator: true, algae_level: "medium" },
  { id: "pond-4", name: "Gadde Pond", farmer_name: "Lakshmi P. (demo)", phone: "+919000000004", village: "Kota", canal: "Canal B (demo)", area_m2: 900, depth_m: 1.0, species: "tilapia", stocking_date: "", fish_count: 2500, has_aerator: false, algae_level: "low" },
  { id: "pond-5", name: "Kodi Kere", farmer_name: "Abdul R. (demo)", phone: "+919000000005", village: "Mulki", canal: "Canal C (demo)", area_m2: 1600, depth_m: 1.4, species: "mrigal", stocking_date: "", fish_count: 4000, has_aerator: false, algae_level: "medium" },
  { id: "pond-6", name: "Padubidri Farm 2", farmer_name: "Geetha D. (demo)", phone: "+919000000006", village: "Padubidri", canal: "Canal C (demo)", area_m2: 2400, depth_m: 1.6, species: "catla", stocking_date: "", fish_count: 5000, has_aerator: true, algae_level: "low" },
];

const STOCKED_DAYS_AGO = [150, 120, 170, 90, 140, 110];
const SEED_SCENARIO = ["high_risk", "cloudy_hot", "normal", "normal", "cloudy_hot", "normal"] as const;

function isoDaysAgo(now: Date, days: number, hours = 0): string {
  return new Date(now.getTime() - days * 86_400_000 - hours * 3_600_000).toISOString();
}

function dateDaysAgo(now: Date, days: number): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10);
}

export function createSeedState(now: Date = new Date()): MockState {
  const ponds: Pond[] = SEED_PONDS.map((p, i) => ({
    ...p,
    stocking_date: dateDaysAgo(now, STOCKED_DAYS_AGO[i]),
    created_at: isoDaysAgo(now, 30 - i),
    updated_at: isoDaysAgo(now, 2),
    oxygen_use_factor: i === 0 ? 1.08 : 1,
    feedback_count: i === 0 ? 2 : 0,
    latest_risk: "unknown",
    latest_risk_at: null,
    latest_risk_source: null,
    data_source: "demo",
  }));

  const forecasts = ponds.map((pond, i) => {
    const scenario = DEMO_SCENARIOS.find((s) => s.id === SEED_SCENARIO[i])!;
    const f = demoForecast({ id: `fc-seed-${i + 1}`, pond, scenario, feeding: i === 0, now: new Date(now.getTime() - 40 * 60_000) });
    pond.latest_risk = f.summary.risk_level;
    pond.latest_risk_at = f.created_at;
    pond.latest_risk_source = "forecast";
    return f;
  });

  // Two ponds on Canal B report possible disease signs → a "possible" cluster in the cooperative view.
  const waterChecks: WaterCheck[] = [
    demoWaterCheck({
      id: "wc-seed-1",
      pondId: "pond-3",
      req: { readings: { ph: 8.1, temperature_c: 30, ammonia_mg_l: 0.6, nitrite_mg_l: 0.1 }, symptoms: ["red_spots_or_ulcers", "not_feeding"] },
      now: new Date(isoDaysAgo(now, 1, 5)),
    }),
    demoWaterCheck({
      id: "wc-seed-2",
      pondId: "pond-4",
      req: { readings: { ph: 7.6, temperature_c: 29, ammonia_mg_l: null, nitrite_mg_l: null }, symptoms: ["white_patches_or_fungus"] },
      now: new Date(isoDaysAgo(now, 0, 9)),
    }),
    demoWaterCheck({
      id: "wc-seed-3",
      pondId: "pond-1",
      req: { readings: { ph: 7.9, temperature_c: 31, ammonia_mg_l: 0.3, nitrite_mg_l: 0.1 }, symptoms: [] },
      now: new Date(isoDaysAgo(now, 3, 2)),
    }),
  ];
  for (const wc of waterChecks) {
    const pond = ponds.find((p) => p.id === wc.pond_id)!;
    const severity = { unknown: -1, safe: 0, watch: 1, danger: 2 } as const;
    if (severity[wc.result.risk_level] > severity[pond.latest_risk]) {
      pond.latest_risk = wc.result.risk_level;
      pond.latest_risk_at = wc.created_at;
      pond.latest_risk_source = "water_check";
    }
  }

  const yesterdayAck: Alert = {
    id: "al-seed-1",
    pond_id: "pond-1",
    pond_name: "Kere 1",
    kind: "oxygen_forecast",
    risk_level: "watch",
    title: "Low-oxygen watch — Kere 1",
    source_id: null,
    status: "acknowledged",
    created_at: isoDaysAgo(now, 1, 1),
    acknowledged_at: isoDaysAgo(now, 1, 0.8),
    ack_response: "1",
    message_kn: "ಎಚ್ಚರಿಕೆ: ಇಂದು ರಾತ್ರಿ \"Kere 1\" ಕೊಳದಲ್ಲಿ ಆಮ್ಲಜನಕ ಬೆಳಗಿನ ಜಾವ 4 ಗಂಟೆ ಸುಮಾರಿಗೆ ಕಡಿಮೆಯಾಗಬಹುದು.\nಹೀಗೆ ಮಾಡಿ:\n• ಇಂದು ಸಂಜೆ ಆಹಾರವನ್ನು ಅರ್ಧದಷ್ಟು ಕಡಿಮೆ ಮಾಡಿ\n• ಏರೇಟರ್ ಸಿದ್ಧವಾಗಿಡಿ\n• ಬೆಳಗಿನ ಜಾವ ಮೀನುಗಳನ್ನು ಗಮನಿಸಿ\n1 ಎಂದು ಉತ್ತರಿಸಿ = ಸರಿ",
    message_en: "WATCH tonight for your pond \"Kere 1\". Oxygen may run low around 4 AM.\nDo this:\n• Cut this evening's feed by half\n• Keep the aerator ready\n• Check the fish before dawn\nReply 1 = OK",
    kannada_reviewed: false,
    deliveries: [
      {
        id: "dl-seed-1",
        alert_id: "al-seed-1",
        channel: "whatsapp",
        recipient_masked: "+91 ••••••0001",
        provider: "mock",
        simulated: true,
        status: "delivered",
        error: null,
        created_at: isoDaysAgo(now, 1, 1),
        updated_at: isoDaysAgo(now, 1, 1),
      },
    ],
    data_source: "demo",
  };

  const outbreak: Alert = {
    id: "al-seed-2",
    pond_id: "pond-4",
    pond_name: "Gadde Pond",
    kind: "outbreak_notice",
    risk_level: "watch",
    title: "Possible disease signs on Canal B (demo)",
    source_id: "wc-seed-1",
    status: "draft",
    created_at: isoDaysAgo(now, 0, 8),
    acknowledged_at: null,
    ack_response: null,
    ...outbreakNoticeMessage(),
    deliveries: [],
    data_source: "demo",
  };

  return {
    version: 1,
    seq: 100,
    ponds,
    forecasts,
    waterChecks,
    alerts: [outbreak, yesterdayAck],
    feedback: [
      { id: "fb-seed-1", pond_id: "pond-1", response: 1, created_at: isoDaysAgo(now, 4), before: 1, after: 1.05 },
      { id: "fb-seed-2", pond_id: "pond-1", response: 2, created_at: isoDaysAgo(now, 1), before: 1.05, after: 1.08 },
    ],
  };
}

const pct = (x: number) => Math.round(x * 1000) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;

const WQ_UNITS: Record<string, string | null> = {
  temperature: "°C",
  turbidity: "cm",
  dissolved_oxygen: "mg/L",
  bod: "mg/L",
  co2: "mg/L",
  ph: null,
  alkalinity: "mg/L",
  hardness: "mg/L",
  calcium: "mg/L",
  ammonia: "mg/L",
  nitrite: "mg/L",
  phosphorus: "mg/L",
  h2s: "mg/L",
  plankton: "No./L",
};

/**
 * Demo ML status. Datasets, counts, metrics and sample predictions come from the backend's last
 * real training runs (`ml_results.json`, exported by backend/scripts/export_demo_ml.py, which
 * re-scores each saved model on its test split before writing). Nothing here is filled in by hand.
 */
export function demoMlStatus(now: Date): MlStatus {
  const wq = ML.water_quality;
  const ox = ML.oxygen;
  const lr = wq.compare.logistic_regression;
  const wqSplit = `held-out test set (${wq.n_test} rows)`;
  const oxSplit = "held-out simulated ponds 5 and 6";
  return {
    generated_at: now.toISOString(),
    data_source: "demo",
    datasets: [
      {
        id: "mendeley_wq",
        name: "Aquaculture – Water Quality Dataset (WQD.xlsx)",
        source_url: "https://data.mendeley.com/datasets/y78ty2g293",
        provenance: "Mendeley Data — water-quality samples graded excellent / good / poor. Downloaded, checksum verified and loaded by the backend.",
        license: "CC BY 4.0",
        task: "water_quality_reference",
        status: "loaded",
        record_count: wq.rows,
        feature_schema: wq.features.map((name) => ({ name, type: "float", unit: WQ_UNITS[name] ?? null })),
        last_checked_at: wq.trained_at,
        error: null,
      },
      {
        id: "synthetic_do",
        name: "Simulated pond oxygen series (demo data)",
        source_url: "backend/ml/synthetic.py",
        provenance: "Generated by the backend (ml.synthetic, seed 42): 6 simulated ponds × 21 days of hourly readings with a day–night oxygen cycle. Not measured in real ponds.",
        license: null,
        task: "oxygen_regression",
        status: "loaded",
        record_count: ox.rows,
        feature_schema: [
          { name: "dissolved_oxygen_mg_l", type: "float", unit: "mg/L" },
          { name: "temperature_c", type: "float", unit: "°C" },
          { name: "ph", type: "float", unit: null },
          { name: "turbidity_ntu", type: "float", unit: "NTU" },
          { name: "ammonia_mg_l", type: "float", unit: "mg/L" },
        ],
        last_checked_at: ox.trained_at,
        error: null,
      },
      {
        id: "open_meteo_weather",
        name: "Open-Meteo forecast weather",
        source_url: "https://open-meteo.com",
        provenance: "Open-Meteo API — hourly forecast for each pond's village, fetched live by the 5 PM run and the forecast explorer.",
        license: "CC BY 4.0",
        task: "weather",
        status: "available",
        record_count: null,
        feature_schema: [
          { name: "temperature_2m", type: "float", unit: "°C" },
          { name: "cloud_cover", type: "float", unit: "%" },
          { name: "wind_speed_10m", type: "float", unit: "km/h" },
          { name: "precipitation", type: "float", unit: "mm" },
        ],
        last_checked_at: null,
        error: null,
      },
      {
        id: "kaggle_aquaponics_ponds",
        name: "Sensor Based Aquaponics Fish Pond Datasets",
        source_url: "https://www.kaggle.com/datasets",
        provenance: "Kaggle — IoT sensor readings from aquaponics fish ponds. Next source for the oxygen model: the same pipeline trains on it once the files are added.",
        license: null,
        task: "oxygen_regression",
        status: "not_downloaded",
        record_count: null,
        feature_schema: [],
        last_checked_at: null,
        error: null,
      },
    ],
    models: [
      {
        id: "mendeley_wq",
        name: "Water-quality grade classifier (random forest)",
        task: "water_quality_reference",
        version: `${wq.model_type}-${wq.trained_at.slice(0, 10)}`,
        training_status: "trained",
        trained_at: wq.trained_at,
        dataset_ids: ["mendeley_wq"],
        data_origin: "external",
        metrics: [
          { name: "Accuracy", value: pct(wq.accuracy), unit: "%", split: wqSplit, baseline_value: pct(wq.baseline.accuracy) },
          { name: "Macro F1", value: r2(wq.macro_f1), unit: null, split: wqSplit, baseline_value: r2(wq.baseline.macro_f1) },
          { name: "Accuracy, logistic regression (compared)", value: pct(lr.accuracy), unit: "%", split: wqSplit, baseline_value: pct(wq.baseline.accuracy) },
        ],
        validated_for_karnataka_ponds: false,
        used_in_forecast: false,
        limitations: [...wq.warnings, "Baseline: always predicting the most common grade."],
        results: {
          n_train: wq.n_train,
          n_test: wq.n_test,
          split: wq.split,
          confusion_matrix: { labels: ["excellent", "good", "poor"], matrix: wq.confusion_matrix.matrix },
          samples: wq.samples,
        },
      },
      {
        id: "synthetic_do",
        name: "Next-hour oxygen model (ridge regression)",
        task: "oxygen_regression",
        version: `${ox.model_type}-${ox.trained_at.slice(0, 10)}`,
        training_status: "trained",
        trained_at: ox.trained_at,
        dataset_ids: ["synthetic_do"],
        data_origin: "synthetic",
        metrics: [
          { name: "MAE", value: r2(ox.mae_mg_l), unit: "mg/L", split: oxSplit, baseline_value: r2(ox.baseline.mae_mg_l) },
          { name: "RMSE", value: r2(ox.rmse_mg_l), unit: "mg/L", split: oxSplit, baseline_value: r2(ox.baseline.rmse_mg_l) },
          { name: "R²", value: r2(ox.r2), unit: null, split: oxSplit, baseline_value: r2(ox.baseline.r2) },
          { name: "Error reduction vs baseline (MAE)", value: pct(ox.skill_vs_persistence_mae), unit: "%", split: oxSplit, baseline_value: null },
        ],
        validated_for_karnataka_ponds: false,
        used_in_forecast: false,
        limitations: [...ox.warnings.filter((w) => !w.startsWith("xgboost")), "Baseline: persistence (next hour equals this hour)."],
        results: {
          n_train: ox.n_train,
          n_test: ox.n_test,
          split: ox.split,
          series: {
            label: `Simulated test pond ${Number(ox.series_pond.replace(/\D+/g, ""))}, 36 hours from 7 PM`,
            unit: "mg/L",
            baseline_label: "Persistence baseline",
            points: ox.series.map((p) => ({ hour: p.hour, actual: p.actual, predicted: p.predicted, baseline: p.persistence })),
          },
        },
      },
    ],
    engine_layers: [
      { id: "inputs", status: "implemented", note: "Pond registration form and stored pond profile." },
      { id: "weather", status: "implemented", note: "Live Open-Meteo forecast per village, or scenario presets." },
      { id: "physics", status: "implemented", note: "Baseline oxygen balance (uncalibrated). Mock mode shows a demo fixture curve instead." },
      {
        id: "ml",
        status: "experimental",
        note: `Trained and tested: the oxygen model cuts next-hour error by ${pct(ox.skill_vs_persistence_mae)}% against the baseline on held-out simulated ponds. Not yet applied to the risk score.`,
      },
      { id: "rules", status: "implemented", note: "Test-kit and symptom rules. Mock mode uses a demo stub." },
      { id: "risk", status: "implemented", note: "Safe / Watch / Danger from oxygen thresholds and rules." },
      { id: "delivery", status: "experimental", note: "Simulated only — mock provider, no real WhatsApp/SMS/voice." },
      { id: "feedback", status: "implemented", note: "1 / 2 / 3 morning check-in recorded per pond." },
      { id: "calibration", status: "experimental", note: "Basic per-pond oxygen-use factor nudged by feedback." },
    ],
  };
}
