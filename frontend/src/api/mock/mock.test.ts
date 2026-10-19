import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "../errors";
import type { PondInput } from "../types";
import { createMockApi } from "./index";

const NOW = new Date("2026-10-19T11:30:00Z"); // 5:00 PM IST

const validPond: PondInput = {
  name: "Test Kere",
  farmer_name: "Test Farmer",
  phone: "+919876543210",
  village: "Kota",
  canal: "Canal B (demo)",
  area_m2: 1500,
  depth_m: 1.4,
  species: "rohu",
  stocking_date: "2026-06-01",
  fish_count: 4000,
  has_aerator: true,
  algae_level: "medium",
};

let api: ReturnType<typeof createMockApi>;

beforeEach(() => {
  api = createMockApi({ latencyMs: 0, storage: null, now: () => NOW });
});

describe("mock API — ponds", () => {
  it("seeds labelled demo ponds", async () => {
    const ponds = await api.listPonds();
    expect(ponds.length).toBeGreaterThan(0);
    expect(ponds.every((p) => p.data_source === "demo")).toBe(true);
  });

  it("rejects invalid pond input with field errors", async () => {
    const err = (await api.createPond({ ...validPond, phone: "12345", area_m2: 10 }).catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(Object.keys(err.fieldErrors).sort()).toEqual(["area_m2", "phone"]);
  });

  it("creates, lists, filters and edits a pond", async () => {
    const pond = await api.createPond(validPond);
    expect(pond.latest_risk).toBe("unknown");
    expect((await api.listPonds({ search: "test kere" })).map((p) => p.id)).toEqual([pond.id]);
    expect((await api.listPonds({ risk: "unknown" })).some((p) => p.id === pond.id)).toBe(true);
    const updated = await api.updatePond(pond.id, { fish_count: 4500 });
    expect(updated.fish_count).toBe(4500);
    expect((await api.getPond(pond.id)).fish_count).toBe(4500);
  });

  it("404s for an unknown pond", async () => {
    const err = (await api.getPond("nope").catch((e: unknown) => e)) as ApiError;
    expect(err.kind).toBe("not_found");
  });
});

describe("mock API — forecast", () => {
  it("is reproducible, hourly from 18:00 to 08:00 IST, and responds to scenario and inputs", async () => {
    const pond = await api.createPond(validPond);
    const a = await api.runForecast(pond.id, { scenario_id: "normal", feeding_this_evening: false });
    const b = await api.runForecast(pond.id, { scenario_id: "normal", feeding_this_evening: false });
    expect(b.points).toEqual(a.points);

    expect(a.points).toHaveLength(15);
    expect(a.points[0].time).toBe("2026-10-19T18:00:00+05:30");
    expect(a.points[14].time).toBe("2026-10-20T08:00:00+05:30");
    for (let i = 1; i < a.points.length; i++) {
      expect(Date.parse(a.points[i].time) - Date.parse(a.points[i - 1].time)).toBe(3_600_000);
    }

    const high = await api.runForecast(pond.id, { scenario_id: "high_risk", feeding_this_evening: false });
    expect(high.summary.min_estimated_do_mg_l).toBeLessThan(a.summary.min_estimated_do_mg_l);
    expect(high.summary.risk_level).toBe("danger");
    expect(high.summary.aerator_start_time).not.toBeNull();

    const windy = await api.runForecast(pond.id, { scenario_id: "high_risk", weather_overrides: { wind_speed_ms: 6 }, feeding_this_evening: false });
    expect(windy.summary.min_estimated_do_mg_l).toBeGreaterThan(high.summary.min_estimated_do_mg_l);
  });

  it("labels output as an uncalibrated demo estimate with no ML correction", async () => {
    const [p] = await api.listPonds();
    const f = await api.runForecast(p.id, { scenario_id: "cloudy_hot", feeding_this_evening: true });
    expect(f.is_estimate).toBe(true);
    expect(f.data_source).toBe("demo");
    expect(f.model.calibrated).toBe(false);
    expect(f.model.ml_correction_applied).toBe(false);
  });

  it("classifies every point consistently with the returned thresholds", async () => {
    const [p] = await api.listPonds();
    const f = await api.runForecast(p.id, { scenario_id: "high_risk", feeding_this_evening: true });
    for (const pt of f.points) {
      const expected = pt.estimated_do_mg_l < f.thresholds.danger_below_mg_l ? "danger" : pt.estimated_do_mg_l < f.thresholds.watch_below_mg_l ? "watch" : "safe";
      expect(pt.risk_level).toBe(expected);
    }
  });

  it("updates the pond's latest risk", async () => {
    const pond = await api.createPond(validPond);
    await api.runForecast(pond.id, { scenario_id: "high_risk", feeding_this_evening: true });
    expect((await api.getPond(pond.id)).latest_risk).toBe("danger");
    expect((await api.getLatestForecast(pond.id))?.summary.risk_level).toBe("danger");
  });

  it("returns null for a pond with no forecast", async () => {
    const pond = await api.createPond(validPond);
    expect(await api.getLatestForecast(pond.id)).toBeNull();
  });
});

describe("mock API — water checks", () => {
  it("requires at least one reading or symptom", async () => {
    const [p] = await api.listPonds();
    const err = (await api
      .submitWaterCheck(p.id, { readings: { ph: null, temperature_c: null, ammonia_mg_l: null, nitrite_mg_l: null }, symptoms: [] })
      .catch((e: unknown) => e)) as ApiError;
    expect(err.kind).toBe("validation");
  });

  it("reports missing inputs and refers disease signs to an officer", async () => {
    const [p] = await api.listPonds();
    const wc = await api.submitWaterCheck(p.id, { readings: { ph: 7.5, temperature_c: null, ammonia_mg_l: 1.5, nitrite_mg_l: null }, symptoms: ["red_spots_or_ulcers"] });
    expect(wc.result.risk_level).toBe("danger");
    expect(wc.result.missing_inputs.sort()).toEqual(["nitrite_mg_l", "temperature_c"]);
    expect(wc.result.refer_to_fisheries_officer).toBe(true);
    expect(wc.readings.ph).toBe(7.5);
    expect((await api.listWaterChecks(p.id))[0].id).toBe(wc.id);
  });
});

describe("mock API — alerts", () => {
  it("drafts, fails, delivers and acknowledges an alert — all simulated", async () => {
    const pond = await api.createPond(validPond);
    const f = await api.runForecast(pond.id, { scenario_id: "high_risk", feeding_this_evening: true });
    const alert = await api.createAlert({ pond_id: pond.id, source: "forecast", source_id: f.id });
    expect(alert.status).toBe("draft");
    expect(alert.message_kn).toMatch(/ಅಪಾಯ/);
    expect(alert.message_en).toMatch(/DANGER/);

    const early = (await api.acknowledgeAlert(alert.id, { response: "1" }).catch((e: unknown) => e)) as ApiError;
    expect(early.status).toBe(409);

    const failed = await api.sendAlert(alert.id, { channel: "sms", simulate_failure: true });
    expect(failed.status).toBe("failed");
    expect(failed.simulated).toBe(true);
    expect((await api.getAlert(alert.id)).status).toBe("send_failed");

    const ok = await api.sendAlert(alert.id, { channel: "whatsapp" });
    expect(ok).toMatchObject({ status: "delivered", provider: "mock", simulated: true });
    expect(ok.recipient_masked).not.toContain("9876543210");
    expect((await api.getAlert(alert.id)).status).toBe("sent");

    const acked = await api.acknowledgeAlert(alert.id, { response: "1" });
    expect(acked.status).toBe("acknowledged");
    expect(acked.acknowledged_at).not.toBeNull();
    expect((await api.listAlerts({ status: "acknowledged", pond_id: pond.id })).map((a) => a.id)).toEqual([alert.id]);
  });
});

describe("mock API — feedback, cooperative, ML status", () => {
  it("nudges the oxygen-use factor within bounds", async () => {
    const pond = await api.createPond(validPond);
    const r = await api.submitFeedback(pond.id, 1);
    expect(r.oxygen_use_factor_after).toBeGreaterThan(r.oxygen_use_factor_before);
    expect((await api.getPond(pond.id)).feedback_count).toBe(1);
  });

  it("marks outbreak clusters as possible, never confirmed", async () => {
    const coop = await api.getCooperative();
    expect(coop.clusters.length).toBeGreaterThan(0);
    expect(coop.clusters.every((c) => c.status === "possible")).toBe(true);
    expect(coop.recent_reports.every((r) => !("farmer_name" in r))).toBe(true);
  });

  it("reports no invented record counts or metrics in demo ML status", async () => {
    const s = await api.getMlStatus();
    expect(s.datasets.every((d) => d.record_count === null && d.status === "not_downloaded")).toBe(true);
    expect(s.models.every((m) => m.metrics.length === 0 && m.training_status === "not_started" && !m.validated_for_karnataka_ponds)).toBe(true);
    const ml = s.engine_layers.find((l) => l.id === "ml");
    expect(ml?.status).toBe("planned");
  });
});
