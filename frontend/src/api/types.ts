/**
 * MeenMitra API payload types — DRAFT /api/v1 contract.
 *
 * These types are the frontend's proposal (see frontend/API_CONTRACT.md).
 * They must be confirmed with the backend owner before being treated as agreed.
 * Field names are snake_case to match FastAPI/Pydantic defaults.
 */

export type RiskLevel = "safe" | "watch" | "danger";
/** "unknown" = no forecast or check exists yet for this pond. */
export type PondRiskLevel = RiskLevel | "unknown";

/** Where a payload came from. The UI labels anything that is not "live". */
export type DataSource = "live" | "demo";

export type Species = "rohu" | "catla" | "mrigal" | "tilapia" | "pangasius" | "other";
export type AlgaeLevel = "low" | "medium" | "high";
export type Channel = "whatsapp" | "sms" | "voice";

// ---------------------------------------------------------------- health

export interface HealthResponse {
  status: "ok" | "degraded";
  version: string;
  messaging_provider: string; // "mock" unless a real provider is configured
  messaging_simulated: boolean;
}

// ---------------------------------------------------------------- ponds

export interface PondInput {
  name: string;
  farmer_name: string;
  phone: string; // E.164, e.g. +919000000001
  village: string;
  canal: string; // shared canal / water source name used for outbreak grouping
  area_m2: number;
  depth_m: number;
  species: Species;
  stocking_date: string; // YYYY-MM-DD
  fish_count: number;
  has_aerator: boolean;
  algae_level: AlgaeLevel;
}

export interface Pond extends PondInput {
  id: string;
  created_at: string; // ISO 8601
  updated_at: string;
  /** Per-pond oxygen-use calibration factor learned from farmer feedback (1.0 = default). */
  oxygen_use_factor: number;
  feedback_count: number;
  latest_risk: PondRiskLevel;
  latest_risk_at: string | null;
  latest_risk_source: "forecast" | "water_check" | null;
  data_source: DataSource;
}

export type PondSummary = Pick<
  Pond,
  | "id"
  | "name"
  | "farmer_name"
  | "village"
  | "canal"
  | "species"
  | "area_m2"
  | "fish_count"
  | "latest_risk"
  | "latest_risk_at"
  | "latest_risk_source"
  | "data_source"
>;

export interface PondListQuery {
  search?: string;
  risk?: PondRiskLevel;
}

// ---------------------------------------------------------------- forecast

export type ScenarioId = "normal" | "cloudy_hot" | "high_risk";

export interface WeatherInputs {
  cloud_cover_pct: number; // daytime mean, 0–100
  air_temp_evening_c: number;
  air_temp_min_c: number; // overnight minimum
  wind_speed_ms: number; // overnight mean, m/s
  rain_mm: number; // daytime total
}

export interface Scenario {
  id: ScenarioId;
  label: string;
  description: string;
  weather: WeatherInputs;
}

/** Where tonight's weather came from when it was fetched live rather than taken from a scenario. */
export interface LiveWeatherInfo {
  provider: "open-meteo";
  /** Place the weather was fetched for, e.g. "Brahmavar". */
  place: string;
  latitude: number;
  longitude: number;
  /** "geocoded" = located by name via Open-Meteo geocoding; "village_table" = built-in approximate village point. */
  location_source: "geocoded" | "village_table" | "district_default";
  fetched_at: string; // ISO 8601
}

export interface ForecastRequest {
  scenario_id: ScenarioId;
  /** Optional overrides of the scenario weather. */
  weather_overrides?: Partial<WeatherInputs>;
  feeding_this_evening: boolean;
  /** Set when weather_overrides hold a live Open-Meteo forecast (all five fields). */
  live_weather?: LiveWeatherInfo;
}

export interface ForecastPoint {
  time: string; // ISO 8601 with offset, hourly 18:00 → 08:00 local
  /** Model ESTIMATE of dissolved oxygen. Never a measurement. */
  estimated_do_mg_l: number;
  /** Optional uncertainty band around the estimate. */
  lower_mg_l: number | null;
  upper_mg_l: number | null;
  water_temp_c: number;
  risk_level: RiskLevel;
}

export interface ForecastFactor {
  key: string;
  label: string;
  /** "lowers" = pushes oxygen down / risk up. */
  effect: "lowers" | "raises";
  /** Total overnight contribution in mg/L, as computed by the engine. */
  magnitude_mg_l: number;
  detail: string;
}

export interface ModelInfo {
  name: string;
  version: string;
  layers_applied: string[];
  ml_correction_applied: boolean;
  calibrated: boolean; // false until validated against real pond DO measurements
}

export interface Forecast {
  id: string;
  pond_id: string;
  created_at: string;
  scenario_id: ScenarioId;
  is_estimate: true;
  data_source: DataSource;
  model: ModelInfo;
  inputs: {
    weather: WeatherInputs;
    feeding_this_evening: boolean;
    estimated_fish_weight_g: number;
    estimated_biomass_kg: number;
    oxygen_use_factor: number;
    /** Present when the weather came from a live forecast instead of a scenario. */
    live_weather?: LiveWeatherInfo | null;
  };
  thresholds: { danger_below_mg_l: number; watch_below_mg_l: number };
  points: ForecastPoint[];
  summary: {
    risk_level: RiskLevel;
    min_estimated_do_mg_l: number;
    min_time: string;
    first_watch_time: string | null;
    first_danger_time: string | null;
    aerator_start_time: string | null;
  };
  factors: ForecastFactor[];
  actions: string[];
  uncertainty_note: string;
  alert_preview: AlertMessage | null;
}

// ---------------------------------------------------------------- water quality

export const SYMPTOMS = [
  "gasping_at_surface",
  "not_feeding",
  "erratic_swimming",
  "red_spots_or_ulcers",
  "white_patches_or_fungus",
  "fin_rot",
  "dead_fish",
  "foul_smell",
  "thick_green_water",
] as const;
export type Symptom = (typeof SYMPTOMS)[number];

export interface WaterReadings {
  ph: number | null;
  temperature_c: number | null;
  ammonia_mg_l: number | null; // total ammonia nitrogen (TAN) from test kit
  nitrite_mg_l: number | null;
}

export interface WaterCheckRequest {
  readings: WaterReadings;
  symptoms: Symptom[];
  notes?: string;
}

export interface WaterFinding {
  parameter: keyof WaterReadings | "symptom";
  label: string;
  value: number | string | null;
  unit: string | null;
  level: RiskLevel;
  message: string;
}

export interface WaterCheck {
  id: string;
  pond_id: string;
  created_at: string;
  data_source: DataSource;
  /** Values exactly as submitted — these ARE farmer measurements (test kit). */
  readings: WaterReadings;
  symptoms: Symptom[];
  result: {
    risk_level: RiskLevel;
    summary: string;
    findings: WaterFinding[];
    missing_inputs: (keyof WaterReadings)[];
    actions: string[];
    refer_to_fisheries_officer: boolean;
  };
  rules_version: string;
}

// ---------------------------------------------------------------- feedback

export type FeedbackResponse = 1 | 2 | 3; // 1 = fish were gasping, 2 = not sure, 3 = fish were fine

export interface FeedbackResult {
  pond_id: string;
  response: FeedbackResponse;
  oxygen_use_factor_before: number;
  oxygen_use_factor_after: number;
  created_at: string;
}

// ---------------------------------------------------------------- alerts

export type AlertKind = "oxygen_forecast" | "water_quality" | "outbreak_notice";
export type AlertStatus = "draft" | "sent" | "send_failed" | "acknowledged";
export type DeliveryStatus = "queued" | "delivered" | "failed";

export interface AlertMessage {
  message_kn: string;
  message_en: string;
  /** false until a native Kannada speaker has reviewed the template. */
  kannada_reviewed: boolean;
}

export interface Delivery {
  id: string;
  alert_id: string;
  channel: Channel;
  recipient_masked: string;
  provider: string; // "mock" in demo
  simulated: boolean;
  status: DeliveryStatus;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface Alert extends AlertMessage {
  id: string;
  pond_id: string;
  pond_name: string;
  kind: AlertKind;
  risk_level: RiskLevel;
  title: string;
  source_id: string | null;
  status: AlertStatus;
  created_at: string;
  acknowledged_at: string | null;
  ack_response: string | null;
  deliveries: Delivery[];
  data_source: DataSource;
}

export interface AlertCreateRequest {
  pond_id: string;
  source: "forecast" | "water_check";
  source_id: string;
}

export interface AlertListQuery {
  pond_id?: string;
  status?: AlertStatus;
  risk?: RiskLevel;
  kind?: AlertKind;
}

export interface DeliveryRequest {
  channel: Channel;
  /** Demo-only: ask the mock provider to fail, to exercise error handling. */
  simulate_failure?: boolean;
}

export interface AcknowledgeRequest {
  response: string; // e.g. "1" = OK, will do
}

// ---------------------------------------------------------------- dashboard

export interface DashboardSummary {
  generated_at: string;
  data_source: DataSource;
  total_ponds: number;
  counts: Record<PondRiskLevel, number>;
  attention: PondSummary[]; // watch/danger ponds, most severe first
  recent_alerts: Alert[];
  /** Tonight's forecast for the highest-risk pond, if any. */
  featured_forecast: Forecast | null;
  /** Daily count of ponds per risk level for recent days. */
  trend: { date: string; safe: number; watch: number; danger: number }[];
}

// ---------------------------------------------------------------- cooperative

export interface FarmerReport {
  id: string;
  pond_id: string;
  canal: string;
  village: string;
  created_at: string;
  kind: "water_check" | "feedback";
  risk_level: RiskLevel;
  summary: string; // anonymised: no farmer name
}

export interface OutbreakCluster {
  id: string;
  canal: string;
  report_count: number;
  pond_count: number;
  first_reported_at: string;
  last_reported_at: string;
  symptoms: Symptom[];
  /** Always "possible" until a fisheries officer confirms. */
  status: "possible" | "confirmed" | "dismissed";
  note: string;
}

export interface CooperativeOverview {
  generated_at: string;
  data_source: DataSource;
  counts: Record<PondRiskLevel, number>;
  canals: { canal: string; ponds: PondSummary[] }[];
  recent_reports: FarmerReport[];
  clusters: OutbreakCluster[];
  priority: (PondSummary & { reason: string })[];
}

// ---------------------------------------------------------------- ML / datasets

export type DatasetStatus = "not_downloaded" | "available" | "loaded" | "error";
export type TrainingStatus = "not_started" | "running" | "trained" | "failed";
export type ImplementationStatus = "implemented" | "experimental" | "planned";

export interface DatasetInfo {
  id: string;
  name: string;
  source_url: string;
  provenance: string;
  license: string | null;
  task: "oxygen_regression" | "disease_classification" | "water_quality_reference" | "weather";
  status: DatasetStatus;
  /** Only present when the backend actually loaded the files. */
  record_count: number | null;
  feature_schema: { name: string; type: string; unit: string | null }[];
  last_checked_at: string | null;
  error: string | null;
}

export interface ModelMetric {
  name: string; // e.g. "MAE"
  value: number;
  unit: string | null;
  split: string; // e.g. "time-based holdout"
  baseline_value: number | null;
}

export interface ModelInfoStatus {
  id: string;
  name: string;
  task: DatasetInfo["task"];
  version: string | null;
  training_status: TrainingStatus;
  trained_at: string | null;
  dataset_ids: string[];
  /** Only metrics computed by a real evaluation run. Empty otherwise. */
  metrics: ModelMetric[];
  validated_for_karnataka_ponds: boolean;
  used_in_forecast: boolean;
  limitations: string[];
  /** Whether training data was real external data or simulated. Optional. */
  data_origin?: "external" | "synthetic";
  /** The saved model's actual outputs on held-out test rows, from the last training run. Optional. */
  results?: ModelResults;
}

export interface ClassificationSample {
  inputs: Record<string, number>;
  actual: string;
  predicted: string;
  /** Model probability of the predicted class, 0–1. */
  confidence: number;
}

export interface SeriesPoint {
  hour: string; // ISO time of the predicted hour
  actual: number;
  predicted: number;
  baseline: number;
}

export interface ModelResults {
  n_train: number;
  n_test: number;
  split: string;
  confusion_matrix?: { labels: string[]; matrix: number[][] };
  samples?: ClassificationSample[];
  series?: { label: string; unit: string; baseline_label: string; points: SeriesPoint[] };
}

export interface EngineLayerStatus {
  id: string; // matches approach layer ids
  status: ImplementationStatus;
  note: string;
}

export interface MlStatus {
  generated_at: string;
  data_source: DataSource;
  datasets: DatasetInfo[];
  models: ModelInfoStatus[];
  engine_layers: EngineLayerStatus[];
}

// ---------------------------------------------------------------- errors

export interface ApiErrorBody {
  detail: string | { loc: (string | number)[]; msg: string; type: string }[];
}
