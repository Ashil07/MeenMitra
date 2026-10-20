/**
 * DEMO FIXTURE GENERATORS — used only when NEXT_PUBLIC_API_MODE=mock.
 *
 * These produce plausible-looking, deterministic payloads so every screen can be exercised
 * without the backend. They are NOT the MeenMitra prediction engine or rules engine:
 * the real physics model, thresholds and per-pond calibration live in the backend.
 * Every payload produced here is marked data_source: "demo" and model "demo-fixture".
 */
import type {
  Forecast,
  ForecastFactor,
  ForecastPoint,
  LiveWeatherInfo,
  Pond,
  RiskLevel,
  Scenario,
  Symptom,
  WaterCheck,
  WaterCheckRequest,
  WaterFinding,
  WeatherInputs,
} from "../types";
import { demoBiomassKg, demoFishWeightG } from "@/lib/growth";
import { formatClock, istDateString, istIso } from "@/lib/time";
import { fishValueInr } from "@/lib/value";
import { forecastMessage } from "./messages";

export { demoFishWeightG };

export const DEMO_THRESHOLDS = { danger_below_mg_l: 3, watch_below_mg_l: 5 } as const;

export const DEMO_SCENARIOS: Scenario[] = [
  {
    id: "normal",
    label: "Normal night",
    description: "Partly sunny day with a steady evening breeze.",
    weather: { cloud_cover_pct: 30, air_temp_evening_c: 29, air_temp_min_c: 24, wind_speed_ms: 3, rain_mm: 0 },
  },
  {
    id: "cloudy_hot",
    label: "Cloudy, hot night",
    description: "Overcast, humid day with light wind — less oxygen made by algae during the day.",
    weather: { cloud_cover_pct: 70, air_temp_evening_c: 31, air_temp_min_c: 26, wind_speed_ms: 2, rain_mm: 2 },
  },
  {
    id: "high_risk",
    label: "High-risk night",
    description: "Heavy cloud, hot and almost windless — the classic pre-dawn crash pattern.",
    weather: { cloud_cover_pct: 95, air_temp_evening_c: 33, air_temp_min_c: 28, wind_speed_ms: 0.5, rain_mm: 0 },
  },
];

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function levelFor(doMgL: number): RiskLevel {
  if (doMgL < DEMO_THRESHOLDS.danger_below_mg_l) return "danger";
  if (doMgL < DEMO_THRESHOLDS.watch_below_mg_l) return "watch";
  return "safe";
}

export function demoForecast(opts: {
  id: string;
  pond: Pond;
  scenario: Scenario;
  overrides?: Partial<WeatherInputs>;
  feeding: boolean;
  now: Date;
  liveWeather?: LiveWeatherInfo;
}): Forecast {
  const { pond, scenario, feeding, now } = opts;
  const w: WeatherInputs = { ...scenario.weather, ...(opts.overrides ?? {}) };

  const weightG = demoFishWeightG(pond.species, pond.stocking_date, now);
  const biomassKg = demoBiomassKg(pond.fish_count, weightG);
  const volumeM3 = pond.area_m2 * pond.depth_m;
  const density = clamp(biomassKg / Math.max(volumeM3, 1) / 0.5, 0.5, 1.8);
  const algae = pond.algae_level === "high" ? 1.15 : pond.algae_level === "low" ? 0.9 : 1;
  const use = pond.oxygen_use_factor * density * algae * (feeding ? 1.12 : 1);

  const cloudPenalty = 0.03 * w.cloud_cover_pct;
  const warmPenalty = 0.12 * (w.air_temp_evening_c - 28);
  const start = clamp(9.2 - cloudPenalty - warmPenalty, 4, 10);

  const baseDemand = 2.2 * use;
  const cloudDemand = 0.015 * w.cloud_cover_pct * use;
  const heatDemand = (0.18 * (w.air_temp_evening_c - 28) + 0.1 * (w.air_temp_min_c - 24)) * use;
  const windGain = 0.3 * Math.min(w.wind_speed_ms, 6);
  const drop = Math.max(0.5, baseDemand + cloudDemand + heatDemand - windGain);

  const date = istDateString(new Date(now.getTime() - 6 * 3_600_000)); // before 06:00 IST → previous evening
  const tempStart = w.air_temp_evening_c - 1;
  const tempEnd = Math.min(tempStart, w.air_temp_min_c + 2);

  const points: ForecastPoint[] = [];
  let minAtNoRise = start;
  for (let t = 0; t <= 14; t++) {
    let est: number;
    if (t <= 12) {
      // Night respiration is roughly steady, so the fixture declines almost linearly toward dawn.
      est = start - drop * Math.pow(t / 12, 0.9);
      minAtNoRise = est;
    } else {
      est = minAtNoRise + 0.35 * (t - 12);
    }
    est = clamp(est, 0.2, 14);
    const band = 0.3 + 0.08 * t;
    points.push({
      time: istIso(date, 18 + t),
      estimated_do_mg_l: round(est),
      lower_mg_l: round(Math.max(0, est - band)),
      upper_mg_l: round(est + band),
      water_temp_c: round(tempStart - ((tempStart - tempEnd) * t) / 14, 1),
      risk_level: levelFor(est),
    });
  }

  const min = points.reduce((a, b) => (b.estimated_do_mg_l < a.estimated_do_mg_l ? b : a));
  const firstWatch = points.find((p) => p.risk_level !== "safe") ?? null;
  const firstDanger = points.find((p) => p.risk_level === "danger") ?? null;
  const riskLevel = levelFor(min.estimated_do_mg_l);
  const aeratorIdx = firstDanger ? Math.max(0, points.indexOf(firstDanger) - 1) : -1;
  const aeratorStart = aeratorIdx >= 0 ? points[aeratorIdx].time : null;

  const factors: ForecastFactor[] = [
    {
      key: "fish_respiration",
      label: "Fish breathing",
      effect: "lowers",
      magnitude_mg_l: round(baseDemand * 0.55),
      detail: `About ${biomassKg} kg of fish (estimated ${weightG} g each from the stocking date) use oxygen all night.`,
    },
    {
      key: "plankton_respiration",
      label: "Algae & pond mud at night",
      effect: "lowers",
      magnitude_mg_l: round(baseDemand * 0.45 + cloudDemand),
      detail: `Algae level "${pond.algae_level}". At night algae stop producing oxygen and consume it instead.`,
    },
    {
      key: "low_daytime_sun",
      label: "Cloud cover lowered evening oxygen",
      effect: "lowers",
      magnitude_mg_l: round(cloudPenalty + Math.max(0, warmPenalty)),
      detail: `${w.cloud_cover_pct}% cloud means less oxygen made during the day, so the night starts lower (${round(start, 1)} mg/L est.).`,
    },
    {
      key: "warm_water",
      label: "Warm water",
      effect: heatDemand >= 0 ? "lowers" : "raises",
      magnitude_mg_l: round(Math.abs(heatDemand)),
      detail: `Evening air ${w.air_temp_evening_c} °C, overnight low ${w.air_temp_min_c} °C. Warm water holds less oxygen and fish breathe faster.`,
    },
    {
      key: "wind_reaeration",
      label: "Wind mixing in air",
      effect: "raises",
      magnitude_mg_l: round(windGain),
      detail: `${w.wind_speed_ms} m/s wind ripples the surface and adds some oxygen back.`,
    },
  ];
  if (feeding) {
    factors.push({
      key: "evening_feed",
      label: "Evening feeding",
      effect: "lowers",
      magnitude_mg_l: round(drop - drop / 1.12),
      detail: "Digesting feed raises the fish's oxygen use for several hours.",
    });
  }
  factors.sort((a, b) => b.magnitude_mg_l - a.magnitude_mg_l);

  const actions: string[] =
    riskLevel === "danger"
      ? [
          "Do not feed this evening.",
          pond.has_aerator && aeratorStart
            ? `Start the aerator by ${formatClock(aeratorStart)}.`
            : "No aerator on record — arrange to borrow an aerator or pump before midnight.",
          "Check the pond before dawn for fish gasping at the surface.",
        ]
      : riskLevel === "watch"
        ? ["Cut this evening's feed by half.", "Keep the aerator ready to switch on.", "Check the fish around 4 AM."]
        : ["Normal routine. No extra action needed tonight."];

  return {
    id: opts.id,
    pond_id: pond.id,
    created_at: now.toISOString(),
    scenario_id: scenario.id,
    is_estimate: true,
    data_source: "demo",
    model: {
      name: "demo-fixture",
      version: "mock-0",
      layers_applied: ["demo_fixture_curve", "per_pond_factor"],
      ml_correction_applied: false,
      calibrated: false,
    },
    inputs: {
      weather: w,
      feeding_this_evening: feeding,
      estimated_fish_weight_g: weightG,
      estimated_biomass_kg: biomassKg,
      oxygen_use_factor: pond.oxygen_use_factor,
      live_weather: opts.liveWeather ?? null,
    },
    thresholds: { ...DEMO_THRESHOLDS },
    points,
    summary: {
      risk_level: riskLevel,
      min_estimated_do_mg_l: min.estimated_do_mg_l,
      min_time: min.time,
      first_watch_time: firstWatch?.time ?? null,
      first_danger_time: firstDanger?.time ?? null,
      aerator_start_time: aeratorStart,
    },
    factors,
    actions,
    uncertainty_note:
      "Demo fixture curve. The shaded band is illustrative and widens through the night; it is not a statistical confidence interval.",
    alert_preview: forecastMessage({
      pondName: pond.name,
      risk: riskLevel,
      lowTime: (firstDanger ?? firstWatch ?? min).time,
      aeratorTime: aeratorStart,
      hasAerator: pond.has_aerator,
      valueInr: fishValueInr(pond.species, biomassKg),
    }),
  };
}

// ---------------------------------------------------------------- water-quality rules stub

const DISEASE_SYMPTOMS: Symptom[] = ["red_spots_or_ulcers", "white_patches_or_fungus", "fin_rot"];
const DANGER_SYMPTOMS: Symptom[] = ["gasping_at_surface", "dead_fish"];

export const SYMPTOM_LABELS: Record<Symptom, string> = {
  gasping_at_surface: "Fish gasping at the surface",
  not_feeding: "Fish not feeding",
  erratic_swimming: "Erratic or slow swimming",
  red_spots_or_ulcers: "Red spots or ulcers",
  white_patches_or_fungus: "White patches or cotton-like fungus",
  fin_rot: "Frayed or rotting fins",
  dead_fish: "Dead fish seen",
  foul_smell: "Foul smell from water",
  thick_green_water: "Very thick green water",
};

function band(value: number, safe: [number, number], watch: [number, number]): RiskLevel {
  if (value >= safe[0] && value <= safe[1]) return "safe";
  if (value >= watch[0] && value <= watch[1]) return "watch";
  return "danger";
}

const worst = (levels: RiskLevel[]): RiskLevel =>
  levels.includes("danger") ? "danger" : levels.includes("watch") ? "watch" : "safe";

export function demoWaterCheck(opts: { id: string; pondId: string; req: WaterCheckRequest; now: Date }): WaterCheck {
  const { readings: r, symptoms } = opts.req;
  const findings: WaterFinding[] = [];

  if (r.ph !== null) {
    const level = band(r.ph, [6.5, 8.5], [6.0, 9.0]);
    findings.push({
      parameter: "ph",
      label: "pH",
      value: r.ph,
      unit: null,
      level,
      message: level === "safe" ? "pH is in the usual range for carp ponds (6.5–8.5)." : r.ph < 6.5 ? "Water is too acidic." : "Water is too alkaline; ammonia becomes more toxic at high pH.",
    });
  }
  if (r.temperature_c !== null) {
    const level = band(r.temperature_c, [25, 32], [20, 35]);
    findings.push({
      parameter: "temperature_c",
      label: "Water temperature",
      value: r.temperature_c,
      unit: "°C",
      level,
      message: level === "safe" ? "Temperature is comfortable for warm-water fish." : r.temperature_c > 32 ? "Hot water holds less oxygen — night-time oxygen risk is higher." : "Cool water slows feeding and growth.",
    });
  }
  if (r.ammonia_mg_l !== null) {
    const level: RiskLevel = r.ammonia_mg_l < 0.5 ? "safe" : r.ammonia_mg_l < 1 ? "watch" : "danger";
    findings.push({
      parameter: "ammonia_mg_l",
      label: "Total ammonia",
      value: r.ammonia_mg_l,
      unit: "mg/L",
      level,
      message: level === "safe" ? "Ammonia is low." : "Ammonia is raised — usually from overfeeding or decaying matter.",
    });
  }
  if (r.nitrite_mg_l !== null) {
    const level: RiskLevel = r.nitrite_mg_l < 0.3 ? "safe" : r.nitrite_mg_l < 1 ? "watch" : "danger";
    findings.push({
      parameter: "nitrite_mg_l",
      label: "Nitrite",
      value: r.nitrite_mg_l,
      unit: "mg/L",
      level,
      message: level === "safe" ? "Nitrite is low." : "Nitrite is raised — it reduces the blood's ability to carry oxygen.",
    });
  }
  for (const s of symptoms) {
    const level: RiskLevel = DANGER_SYMPTOMS.includes(s) ? "danger" : "watch";
    findings.push({
      parameter: "symptom",
      label: SYMPTOM_LABELS[s],
      value: s,
      unit: null,
      level,
      message: DISEASE_SYMPTOMS.includes(s)
        ? "Possible sign of infection. This tool cannot diagnose disease."
        : s === "gasping_at_surface"
          ? "Gasping usually means oxygen is too low right now."
          : "Observed sign — keep watching.",
    });
  }

  const missing = (Object.keys(r) as (keyof typeof r)[]).filter((k) => r[k] === null);
  const risk = worst(findings.map((f) => f.level));
  const refer = symptoms.some((s) => DISEASE_SYMPTOMS.includes(s) || s === "dead_fish");

  const actions: string[] = [];
  if (risk === "danger") actions.push("Stop feeding today.");
  else if (risk === "watch") actions.push("Reduce feeding today.");
  if (symptoms.includes("gasping_at_surface") || findings.some((f) => f.parameter === "temperature_c" && f.level !== "safe"))
    actions.push("Run the aerator now, or add fresh water if you have a clean source.");
  if (findings.some((f) => (f.parameter === "ammonia_mg_l" || f.parameter === "nitrite_mg_l") && f.level !== "safe"))
    actions.push("Do a partial water exchange and re-test in 24 hours.");
  if (refer) actions.push("Contact your fisheries extension officer. Do not add medicines without their advice.");
  if (risk === "safe") actions.push("No action needed. Re-test as usual.");
  if (missing.length) actions.push("Test the missing readings when you can for a more complete check.");

  const flagged = findings.filter((f) => f.level !== "safe").map((f) => f.label.toLowerCase());
  const summary =
    risk === "safe"
      ? `All ${findings.length} submitted value${findings.length === 1 ? "" : "s"} are within demo safe limits.`
      : `${risk === "danger" ? "Danger" : "Watch"}: ${flagged.join(", ")}.`;

  return {
    id: opts.id,
    pond_id: opts.pondId,
    created_at: opts.now.toISOString(),
    data_source: "demo",
    readings: { ...r },
    symptoms: [...symptoms],
    result: { risk_level: risk, summary, findings, missing_inputs: missing, actions, refer_to_fisheries_officer: refer },
    rules_version: "demo-rules-stub",
  };
}

export { worst as worstRisk, DISEASE_SYMPTOMS };
