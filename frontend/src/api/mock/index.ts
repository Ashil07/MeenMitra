/**
 * Mock implementation of the MeenMitra API (NEXT_PUBLIC_API_MODE=mock).
 *
 * Keeps demo state in memory and, when available, in localStorage so a demo survives reloads.
 * Behaves like the HTTP contract: same payload types, ApiError on validation/404/409.
 * Messaging is always simulated; nothing leaves the browser.
 */
import type { MeenMitraApi } from "../client";
import { ApiError } from "../errors";
import type {
  Alert,
  CooperativeOverview,
  DashboardSummary,
  Delivery,
  FarmerReport,
  OutbreakCluster,
  Pond,
  PondInput,
  PondRiskLevel,
  PondSummary,
  RiskLevel,
  Symptom,
} from "../types";
import { SYMPTOMS } from "../types";
import { DEMO_SCENARIOS, DISEASE_SYMPTOMS, demoForecast, demoWaterCheck } from "./generators";
import { waterCheckMessage } from "./messages";
import { createSeedState, demoMlStatus, type MockState } from "./seed";

export const MOCK_STORAGE_KEY = "meenmitra.mock.v1";

export interface MockOptions {
  latencyMs?: number;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  now?: () => Date;
}

const SEVERITY: Record<PondRiskLevel, number> = { unknown: -1, safe: 0, watch: 1, danger: 2 };

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function defaultStorage(): MockOptions["storage"] {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function summary(p: Pond): PondSummary {
  const { id, name, farmer_name, village, canal, species, area_m2, fish_count, latest_risk, latest_risk_at, latest_risk_source, data_source } = p;
  return { id, name, farmer_name, village, canal, species, area_m2, fish_count, latest_risk, latest_risk_at, latest_risk_source, data_source };
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? `+${digits.slice(0, 2)} ••••••${digits.slice(-4)}` : "••••";
}

/** Contract-level validation (field presence/ranges). Mirrors what the backend's Pydantic model should enforce. */
function validatePond(input: Partial<PondInput>, partial: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  const req = (k: keyof PondInput) => !partial || input[k] !== undefined;
  if (req("name") && !input.name?.trim()) e.name = "Pond name is required.";
  if (req("farmer_name") && !input.farmer_name?.trim()) e.farmer_name = "Farmer name is required.";
  if (req("village") && !input.village?.trim()) e.village = "Village is required.";
  if (req("canal") && !input.canal?.trim()) e.canal = "Canal / water source is required.";
  if (req("phone") && !/^\+91[6-9]\d{9}$/.test(input.phone ?? "")) e.phone = "Enter an Indian mobile number like +919876543210.";
  if (req("area_m2") && !(Number(input.area_m2) >= 50 && Number(input.area_m2) <= 200_000)) e.area_m2 = "Area must be between 50 and 200,000 m².";
  if (req("depth_m") && !(Number(input.depth_m) >= 0.3 && Number(input.depth_m) <= 5)) e.depth_m = "Depth must be between 0.3 and 5 m.";
  if (req("fish_count") && !(Number.isInteger(input.fish_count) && Number(input.fish_count) >= 1 && Number(input.fish_count) <= 1_000_000))
    e.fish_count = "Fish count must be a whole number from 1 to 1,000,000.";
  if (req("stocking_date")) {
    const d = input.stocking_date ?? "";
    const t = Date.parse(d);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(t)) e.stocking_date = "Enter a valid stocking date.";
    else if (t > Date.now()) e.stocking_date = "Stocking date cannot be in the future.";
  }
  return e;
}

export function createMockApi(opts: MockOptions = {}): MeenMitraApi & { reset(): void } {
  const latency = opts.latencyMs ?? 250;
  const storage = opts.storage === undefined ? defaultStorage() : opts.storage;
  const now = opts.now ?? (() => new Date());

  let state: MockState = load();

  function load(): MockState {
    try {
      const raw = storage?.getItem(MOCK_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MockState;
        if (parsed.version === 1) return parsed;
      }
    } catch {
      /* corrupted or blocked storage — fall back to fresh seed */
    }
    return createSeedState(now());
  }

  function persist() {
    try {
      storage?.setItem(MOCK_STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or blocked: demo continues in memory only */
    }
  }

  const nextId = (prefix: string) => `${prefix}-${++state.seq}`;

  async function respond<T>(fn: () => T): Promise<T> {
    if (latency > 0) await new Promise((r) => setTimeout(r, latency));
    const out = fn();
    persist();
    return clone(out);
  }

  function pondOr404(id: string): Pond {
    const p = state.ponds.find((x) => x.id === id);
    if (!p) throw new ApiError({ kind: "not_found", message: "Pond not found.", path: `/ponds/${id}`, status: 404 });
    return p;
  }

  function alertOr404(id: string): Alert {
    const a = state.alerts.find((x) => x.id === id);
    if (!a) throw new ApiError({ kind: "not_found", message: "Alert not found.", path: `/alerts/${id}`, status: 404 });
    return a;
  }

  function setRisk(p: Pond, level: RiskLevel, at: string, source: "forecast" | "water_check") {
    p.latest_risk = level;
    p.latest_risk_at = at;
    p.latest_risk_source = source;
  }

  function counts(): Record<PondRiskLevel, number> {
    const c: Record<PondRiskLevel, number> = { safe: 0, watch: 0, danger: 0, unknown: 0 };
    for (const p of state.ponds) c[p.latest_risk]++;
    return c;
  }

  const bySeverity = (a: PondSummary, b: PondSummary) => SEVERITY[b.latest_risk] - SEVERITY[a.latest_risk];
  const newestFirst = <T extends { created_at: string }>(a: T, b: T) => b.created_at.localeCompare(a.created_at);

  return {
    reset() {
      state = createSeedState(now());
      try {
        storage?.removeItem(MOCK_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      persist();
    },

    health: () => respond(() => ({ status: "ok" as const, version: "mock", messaging_provider: "mock", messaging_simulated: true })),

    getDashboard: () =>
      respond((): DashboardSummary => {
        const attention = state.ponds.filter((p) => p.latest_risk === "watch" || p.latest_risk === "danger").map(summary).sort(bySeverity);
        const latestByPond = new Map<string, (typeof state.forecasts)[number]>();
        for (const f of [...state.forecasts].sort(newestFirst)) if (!latestByPond.has(f.pond_id)) latestByPond.set(f.pond_id, f);
        const featured =
          [...latestByPond.values()].sort(
            (a, b) => SEVERITY[b.summary.risk_level] - SEVERITY[a.summary.risk_level] || a.summary.min_estimated_do_mg_l - b.summary.min_estimated_do_mg_l,
          )[0] ?? null;
        const c = counts();
        // Demo trend: fixed illustrative history ending with today's actual counts.
        const trendShape = [
          [5, 1, 0],
          [4, 2, 0],
          [5, 1, 0],
          [3, 2, 1],
          [4, 1, 1],
          [4, 2, 0],
        ];
        const trend = trendShape.map(([safe, watch, danger], i) => ({
          date: new Date(now().getTime() - (6 - i) * 86_400_000).toISOString().slice(0, 10),
          safe,
          watch,
          danger,
        }));
        trend.push({ date: now().toISOString().slice(0, 10), safe: c.safe, watch: c.watch, danger: c.danger });
        return {
          generated_at: now().toISOString(),
          data_source: "demo",
          total_ponds: state.ponds.length,
          counts: c,
          attention,
          recent_alerts: [...state.alerts].sort(newestFirst).slice(0, 5),
          featured_forecast: featured,
          trend,
        };
      }),

    listPonds: (q) =>
      respond(() => {
        const s = q?.search?.trim().toLowerCase();
        return state.ponds
          .filter((p) => !q?.risk || p.latest_risk === q.risk)
          .filter((p) => !s || [p.name, p.farmer_name, p.village, p.canal].some((v) => v.toLowerCase().includes(s)))
          .map(summary);
      }),

    getPond: (id) => respond(() => pondOr404(id)),

    createPond: (input) =>
      respond(() => {
        const errors = validatePond(input, false);
        if (Object.keys(errors).length)
          throw new ApiError({ kind: "validation", message: "Some fields are invalid. Please correct them and try again.", path: "/ponds", status: 422, fieldErrors: errors });
        const t = now().toISOString();
        const pond: Pond = {
          ...input,
          name: input.name.trim(),
          id: nextId("pond"),
          created_at: t,
          updated_at: t,
          oxygen_use_factor: 1,
          feedback_count: 0,
          latest_risk: "unknown",
          latest_risk_at: null,
          latest_risk_source: null,
          data_source: "demo",
        };
        state.ponds.push(pond);
        return pond;
      }),

    updatePond: (id, input) =>
      respond(() => {
        const pond = pondOr404(id);
        const errors = validatePond(input, true);
        if (Object.keys(errors).length)
          throw new ApiError({ kind: "validation", message: "Some fields are invalid. Please correct them and try again.", path: `/ponds/${id}`, status: 422, fieldErrors: errors });
        Object.assign(pond, input, { updated_at: now().toISOString() });
        for (const a of state.alerts) if (a.pond_id === id) a.pond_name = pond.name;
        return pond;
      }),

    listScenarios: () => respond(() => DEMO_SCENARIOS),

    runForecast: (pondId, req) =>
      respond(() => {
        const pond = pondOr404(pondId);
        const scenario = DEMO_SCENARIOS.find((s) => s.id === req.scenario_id);
        if (!scenario)
          throw new ApiError({ kind: "validation", message: "Unknown scenario.", path: `/ponds/${pondId}/forecasts`, status: 422, fieldErrors: { scenario_id: "Unknown scenario." } });
        const f = demoForecast({ id: nextId("fc"), pond, scenario, overrides: req.weather_overrides, feeding: req.feeding_this_evening, now: now() });
        state.forecasts.push(f);
        setRisk(pond, f.summary.risk_level, f.created_at, "forecast");
        return f;
      }),

    getLatestForecast: (pondId) =>
      respond(() => {
        pondOr404(pondId);
        return [...state.forecasts].filter((f) => f.pond_id === pondId).sort(newestFirst)[0] ?? null;
      }),

    listWaterChecks: (pondId) =>
      respond(() => {
        pondOr404(pondId);
        return state.waterChecks.filter((w) => w.pond_id === pondId).sort(newestFirst);
      }),

    submitWaterCheck: (pondId, req) =>
      respond(() => {
        const pond = pondOr404(pondId);
        const path = `/ponds/${pondId}/water-checks`;
        const r = req.readings;
        const fieldErrors: Record<string, string> = {};
        const range = (k: keyof typeof r, lo: number, hi: number, label: string) => {
          const v = r[k];
          if (v !== null && !(v >= lo && v <= hi)) fieldErrors[k] = `${label} must be between ${lo} and ${hi}.`;
        };
        range("ph", 0, 14, "pH");
        range("temperature_c", 0, 45, "Temperature");
        range("ammonia_mg_l", 0, 20, "Ammonia");
        range("nitrite_mg_l", 0, 20, "Nitrite");
        if (req.symptoms.some((s) => !(SYMPTOMS as readonly string[]).includes(s))) fieldErrors.symptoms = "Unknown symptom.";
        if (Object.keys(fieldErrors).length)
          throw new ApiError({ kind: "validation", message: "Some readings are out of range.", path, status: 422, fieldErrors });
        if (Object.values(r).every((v) => v === null) && req.symptoms.length === 0)
          throw new ApiError({ kind: "validation", message: "Enter at least one reading or tick a symptom.", path, status: 422 });
        const wc = demoWaterCheck({ id: nextId("wc"), pondId, req, now: now() });
        state.waterChecks.push(wc);
        setRisk(pond, wc.result.risk_level, wc.created_at, "water_check");
        return wc;
      }),

    submitFeedback: (pondId, response) =>
      respond(() => {
        const pond = pondOr404(pondId);
        if (![1, 2, 3].includes(response))
          throw new ApiError({ kind: "validation", message: "Response must be 1, 2 or 3.", path: `/ponds/${pondId}/feedback`, status: 422 });
        const before = pond.oxygen_use_factor;
        const delta = response === 1 ? 0.05 : response === 3 ? -0.03 : 0;
        const after = Math.round(Math.min(1.5, Math.max(0.7, before + delta)) * 100) / 100;
        pond.oxygen_use_factor = after;
        pond.feedback_count += 1;
        const created_at = now().toISOString();
        state.feedback.push({ id: nextId("fb"), pond_id: pondId, response, created_at, before, after });
        return { pond_id: pondId, response, oxygen_use_factor_before: before, oxygen_use_factor_after: after, created_at };
      }),

    listAlerts: (q) =>
      respond(() =>
        state.alerts
          .filter((a) => !q?.pond_id || a.pond_id === q.pond_id)
          .filter((a) => !q?.status || a.status === q.status)
          .filter((a) => !q?.risk || a.risk_level === q.risk)
          .filter((a) => !q?.kind || a.kind === q.kind)
          .sort(newestFirst),
      ),

    getAlert: (id) => respond(() => alertOr404(id)),

    createAlert: (req) =>
      respond(() => {
        const pond = pondOr404(req.pond_id);
        const t = now().toISOString();
        if (req.source === "forecast") {
          const f = state.forecasts.find((x) => x.id === req.source_id && x.pond_id === pond.id);
          if (!f || !f.alert_preview)
            throw new ApiError({ kind: "not_found", message: "Forecast not found for this pond.", path: "/alerts", status: 404 });
          const label = f.summary.risk_level === "danger" ? "Low-oxygen danger" : f.summary.risk_level === "watch" ? "Low-oxygen watch" : "Oxygen safe";
          const alert: Alert = {
            id: nextId("al"),
            pond_id: pond.id,
            pond_name: pond.name,
            kind: "oxygen_forecast",
            risk_level: f.summary.risk_level,
            title: `${label} — ${pond.name}`,
            source_id: f.id,
            status: "draft",
            created_at: t,
            acknowledged_at: null,
            ack_response: null,
            ...f.alert_preview,
            deliveries: [],
            data_source: "demo",
          };
          state.alerts.push(alert);
          return alert;
        }
        const wc = state.waterChecks.find((x) => x.id === req.source_id && x.pond_id === pond.id);
        if (!wc) throw new ApiError({ kind: "not_found", message: "Water check not found for this pond.", path: "/alerts", status: 404 });
        const msg = waterCheckMessage({ pondName: pond.name, risk: wc.result.risk_level, findings: wc.result.findings, refer: wc.result.refer_to_fisheries_officer });
        const alert: Alert = {
          id: nextId("al"),
          pond_id: pond.id,
          pond_name: pond.name,
          kind: "water_quality",
          risk_level: wc.result.risk_level,
          title: `Water check ${wc.result.risk_level} — ${pond.name}`,
          source_id: wc.id,
          status: "draft",
          created_at: t,
          acknowledged_at: null,
          ack_response: null,
          ...msg,
          deliveries: [],
          data_source: "demo",
        };
        state.alerts.push(alert);
        return alert;
      }),

    sendAlert: (id, req) =>
      respond((): Delivery => {
        const alert = alertOr404(id);
        if (!["whatsapp", "sms", "voice"].includes(req.channel))
          throw new ApiError({ kind: "validation", message: "Unknown channel.", path: `/alerts/${id}/deliveries`, status: 422 });
        const pond = state.ponds.find((p) => p.id === alert.pond_id);
        const t = now().toISOString();
        const phoneOk = !!pond && /^\+91[6-9]\d{9}$/.test(pond.phone);
        const failed = req.simulate_failure || !phoneOk;
        const delivery: Delivery = {
          id: nextId("dl"),
          alert_id: id,
          channel: req.channel,
          recipient_masked: pond ? maskPhone(pond.phone) : "unknown",
          provider: "mock",
          simulated: true,
          status: failed ? "failed" : "delivered",
          error: failed ? (req.simulate_failure ? "Simulated provider failure (demo)." : "Farmer phone number is missing or invalid.") : null,
          created_at: t,
          updated_at: t,
        };
        alert.deliveries.push(delivery);
        if (alert.status !== "acknowledged") {
          alert.status = alert.deliveries.some((d) => d.status === "delivered") ? "sent" : "send_failed";
        }
        return delivery;
      }),

    acknowledgeAlert: (id, req) =>
      respond(() => {
        const alert = alertOr404(id);
        if (!alert.deliveries.some((d) => d.status === "delivered"))
          throw new ApiError({ kind: "http", message: "This alert has not been delivered yet, so the farmer cannot have replied.", path: `/alerts/${id}/acknowledge`, status: 409 });
        if (!req.response.trim())
          throw new ApiError({ kind: "validation", message: "Reply is required.", path: `/alerts/${id}/acknowledge`, status: 422 });
        alert.status = "acknowledged";
        alert.acknowledged_at = now().toISOString();
        alert.ack_response = req.response.trim();
        return alert;
      }),

    getCooperative: () =>
      respond((): CooperativeOverview => {
        const canalNames = [...new Set(state.ponds.map((p) => p.canal))].sort();
        const canals = canalNames.map((canal) => ({
          canal,
          ponds: state.ponds.filter((p) => p.canal === canal).map(summary).sort(bySeverity),
        }));
        const pondById = new Map(state.ponds.map((p) => [p.id, p]));
        const reports: FarmerReport[] = [
          ...state.waterChecks.map((w) => ({
            id: w.id,
            pond_id: w.pond_id,
            canal: pondById.get(w.pond_id)?.canal ?? "Unknown",
            village: pondById.get(w.pond_id)?.village ?? "Unknown",
            created_at: w.created_at,
            kind: "water_check" as const,
            risk_level: w.result.risk_level,
            summary: w.symptoms.length ? `Water check with ${w.symptoms.length} symptom(s) reported.` : "Water check — test-kit readings only.",
          })),
          ...state.feedback.map((f) => ({
            id: f.id,
            pond_id: f.pond_id,
            canal: pondById.get(f.pond_id)?.canal ?? "Unknown",
            village: pondById.get(f.pond_id)?.village ?? "Unknown",
            created_at: f.created_at,
            kind: "feedback" as const,
            risk_level: (f.response === 1 ? "watch" : "safe") as RiskLevel,
            summary: f.response === 1 ? "Morning check-in: fish were gasping." : f.response === 2 ? "Morning check-in: not sure." : "Morning check-in: fish were fine.",
          })),
        ]
          .sort(newestFirst)
          .slice(0, 12);

        const weekAgo = now().getTime() - 7 * 86_400_000;
        const clusters: OutbreakCluster[] = [];
        for (const canal of canalNames) {
          const hits = state.waterChecks.filter(
            (w) => pondById.get(w.pond_id)?.canal === canal && Date.parse(w.created_at) >= weekAgo && w.symptoms.some((s) => DISEASE_SYMPTOMS.includes(s)),
          );
          const pondsHit = new Set(hits.map((h) => h.pond_id));
          if (pondsHit.size >= 2) {
            const sorted = hits.map((h) => h.created_at).sort();
            clusters.push({
              id: `cl-${canal}`,
              canal,
              report_count: hits.length,
              pond_count: pondsHit.size,
              first_reported_at: sorted[0],
              last_reported_at: sorted[sorted.length - 1],
              symptoms: [...new Set(hits.flatMap((h) => h.symptoms.filter((s): s is Symptom => DISEASE_SYMPTOMS.includes(s))))],
              status: "possible",
              note: "Two or more ponds on the same canal reported possible disease signs within 7 days. Not confirmed — needs a fisheries officer visit.",
            });
          }
        }

        const priority = state.ponds
          .filter((p) => p.latest_risk === "danger" || p.latest_risk === "watch")
          .map(summary)
          .sort(bySeverity)
          .map((p) => {
            const full = pondById.get(p.id)!;
            const reason =
              p.latest_risk_source === "forecast"
                ? `${p.latest_risk === "danger" ? "Danger" : "Watch"} oxygen forecast tonight${full.has_aerator ? "" : " · no aerator"}`
                : `Water check flagged ${p.latest_risk}${clusters.some((c) => c.canal === p.canal) ? " · on a canal with a possible cluster" : ""}`;
            return { ...p, reason };
          });

        return { generated_at: now().toISOString(), data_source: "demo", counts: counts(), canals, recent_reports: reports, clusters, priority };
      }),

    getMlStatus: () => respond(() => demoMlStatus(now())),
  };
}
