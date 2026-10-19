/**
 * DEMO SEED DATA — fictional farmers, ponds and phone numbers for mock mode.
 * Village names are real places in Udupi / Dakshina Kannada used only as labels;
 * no coordinates are stored and canal names are invented.
 */
import type { Alert, Forecast, MlStatus, Pond, PondInput, WaterCheck } from "../types";
import { DEMO_SCENARIOS, demoForecast, demoWaterCheck } from "./generators";
import { outbreakNoticeMessage } from "./messages";

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

/**
 * Demo ML status. Mirrors the presentation's plan; it deliberately reports
 * nothing as downloaded or trained and contains no record counts or metrics.
 */
export function demoMlStatus(now: Date): MlStatus {
  return {
    generated_at: now.toISOString(),
    data_source: "demo",
    datasets: [
      {
        id: "kaggle_aquaponics_ponds",
        name: "Sensor Based Aquaponics Fish Pond Datasets",
        source_url: "https://www.kaggle.com/datasets",
        provenance: "Kaggle — IoT sensor readings from aquaponics fish ponds (not Karnataka earthen ponds).",
        license: null,
        task: "oxygen_regression",
        status: "not_downloaded",
        record_count: null,
        feature_schema: [],
        last_checked_at: null,
        error: null,
      },
      {
        id: "open_meteo_weather",
        name: "Open-Meteo forecast & historical weather",
        source_url: "https://open-meteo.com",
        provenance: "Open-Meteo API — hourly weather for the pond's village.",
        license: "CC BY 4.0",
        task: "weather",
        status: "not_downloaded",
        record_count: null,
        feature_schema: [
          { name: "temperature_2m", type: "float", unit: "°C" },
          { name: "cloud_cover", type: "float", unit: "%" },
          { name: "wind_speed_10m", type: "float", unit: "km/h" },
          { name: "shortwave_radiation", type: "float", unit: "W/m²" },
          { name: "precipitation", type: "float", unit: "mm" },
        ],
        last_checked_at: null,
        error: null,
      },
      {
        id: "mendeley_water_quality",
        name: "Aquaculture – Water Quality Dataset",
        source_url: "https://data.mendeley.com",
        provenance: "Mendeley Data — water-quality readings; planned as a reference for rule thresholds.",
        license: null,
        task: "water_quality_reference",
        status: "not_downloaded",
        record_count: null,
        feature_schema: [],
        last_checked_at: null,
        error: null,
      },
      {
        id: "kaggle_fish_disease_south_asia",
        name: "Freshwater Fish Disease Aquaculture in South Asia",
        source_url: "https://www.kaggle.com/datasets",
        provenance: "Kaggle — fish-disease data. A separate classification task; not used for oxygen prediction.",
        license: null,
        task: "disease_classification",
        status: "not_downloaded",
        record_count: null,
        feature_schema: [],
        last_checked_at: null,
        error: null,
      },
    ],
    models: [
      {
        id: "oxygen_ml_correction",
        name: "Oxygen ML correction (XGBoost, planned)",
        task: "oxygen_regression",
        version: null,
        training_status: "not_started",
        trained_at: null,
        dataset_ids: ["kaggle_aquaponics_ponds", "open_meteo_weather"],
        metrics: [],
        validated_for_karnataka_ponds: false,
        used_in_forecast: false,
        limitations: [
          "Training data comes from aquaponics ponds, not small earthen ponds in coastal Karnataka.",
          "No local dissolved-oxygen measurements exist yet to validate against.",
        ],
      },
      {
        id: "fish_disease_classifier",
        name: "Fish disease classifier (planned)",
        task: "disease_classification",
        version: null,
        training_status: "not_started",
        trained_at: null,
        dataset_ids: ["kaggle_fish_disease_south_asia"],
        metrics: [],
        validated_for_karnataka_ponds: false,
        used_in_forecast: false,
        limitations: [
          "Would only flag possible disease for referral — never a diagnosis or treatment advice.",
          "Unrelated to oxygen forecasting.",
        ],
      },
    ],
    engine_layers: [
      { id: "inputs", status: "implemented", note: "Pond registration form and stored pond profile." },
      { id: "weather", status: "planned", note: "Demo uses scenario presets; live Open-Meteo fetch is planned." },
      { id: "physics", status: "implemented", note: "Baseline oxygen balance (uncalibrated). Mock mode shows a demo fixture curve instead." },
      { id: "ml", status: "planned", note: "Not trained. No ML correction is applied to any forecast." },
      { id: "rules", status: "implemented", note: "Test-kit and symptom rules. Mock mode uses a demo stub." },
      { id: "risk", status: "implemented", note: "Safe / Watch / Danger from oxygen thresholds and rules." },
      { id: "delivery", status: "experimental", note: "Simulated only — mock provider, no real WhatsApp/SMS/voice." },
      { id: "feedback", status: "implemented", note: "1 / 2 / 3 morning check-in recorded per pond." },
      { id: "calibration", status: "experimental", note: "Basic per-pond oxygen-use factor nudged by feedback." },
    ],
  };
}
