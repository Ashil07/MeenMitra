import { describe, expect, it } from "vitest";
import type { LiveWeatherInfo } from "../types";
import { createMockApi } from "./index";

const NOW = new Date("2026-10-20T11:30:00Z"); // 5:00 PM IST
const mock = () => createMockApi({ latencyMs: 0, storage: null, now: () => NOW });

const LIVE: LiveWeatherInfo = {
  provider: "open-meteo",
  place: "Brahmavar",
  latitude: 13.437,
  longitude: 74.744,
  location_source: "village_table",
  fetched_at: NOW.toISOString(),
};

describe("canal outbreak notices", () => {
  it("drafts an anonymous notice for every other pond on the same canal", async () => {
    const api = mock();
    const before = await api.listAlerts({ kind: "outbreak_notice" });
    const wc = await api.submitWaterCheck("pond-5", { readings: { ph: null, temperature_c: null, ammonia_mg_l: null, nitrite_mg_l: null }, symptoms: ["red_spots_or_ulcers"] });
    const notices = (await api.listAlerts({ kind: "outbreak_notice" })).filter((a) => a.source_id === wc.id);
    expect(notices.map((a) => a.pond_id)).toEqual(["pond-6"]); // Canal C, excluding the reporter
    expect(notices[0].status).toBe("draft");
    expect(notices[0].message_en).not.toContain("Kodi Kere"); // reporter's pond is not named
    expect(notices[0].message_en).not.toContain("Abdul");
    expect((await api.listAlerts({ kind: "outbreak_notice" })).length).toBe(before.length + 1);
  });

  it("does not repeat a notice within 7 days, and ignores non-disease symptoms", async () => {
    const api = mock();
    const empty = { ph: null, temperature_c: null, ammonia_mg_l: null, nitrite_mg_l: null };
    await api.submitWaterCheck("pond-5", { readings: empty, symptoms: ["dead_fish"] });
    const count = (await api.listAlerts({ kind: "outbreak_notice" })).length;
    await api.submitWaterCheck("pond-5", { readings: empty, symptoms: ["white_patches_or_fungus"] });
    await api.submitWaterCheck("pond-2", { readings: empty, symptoms: ["not_feeding", "gasping_at_surface"] });
    expect((await api.listAlerts({ kind: "outbreak_notice" })).length).toBe(count);
  });
});

describe("pond status", () => {
  it("is the worse of the latest forecast and latest water check", async () => {
    const api = mock();
    const f = await api.runForecast("pond-1", { scenario_id: "high_risk", feeding_this_evening: true });
    expect(f.summary.risk_level).toBe("danger");
    await api.submitWaterCheck("pond-1", { readings: { ph: null, temperature_c: null, ammonia_mg_l: null, nitrite_mg_l: null }, symptoms: ["not_feeding"] });
    const pond = await api.getPond("pond-1");
    expect(pond.latest_risk).toBe("danger"); // a minor symptom report must not hide tonight's danger forecast
    expect(pond.latest_risk_source).toBe("forecast");
  });
});

describe("live weather forecasts", () => {
  const weather = { cloud_cover_pct: 58, air_temp_evening_c: 28.5, air_temp_min_c: 25.1, wind_speed_ms: 1.8, rain_mm: 0 };

  it("records where live weather came from", async () => {
    const f = await mock().runForecast("pond-1", { scenario_id: "normal", weather_overrides: weather, feeding_this_evening: true, live_weather: LIVE });
    expect(f.inputs.live_weather).toEqual(LIVE);
    expect(f.inputs.weather).toEqual(weather);
  });

  it("rejects live weather with missing values", async () => {
    await expect(
      mock().runForecast("pond-1", { scenario_id: "normal", weather_overrides: { cloud_cover_pct: 50 }, feeding_this_evening: true, live_weather: LIVE }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("marks scenario forecasts as not live", async () => {
    const f = await mock().runForecast("pond-1", { scenario_id: "normal", feeding_this_evening: true });
    expect(f.inputs.live_weather).toBeNull();
  });
});

describe("value at risk in alerts", () => {
  it("adds the fish value to Watch and Danger messages only", async () => {
    const api = mock();
    const danger = await api.runForecast("pond-1", { scenario_id: "high_risk", feeding_this_evening: true });
    expect(danger.alert_preview!.message_en).toMatch(/Fish worth about ₹[\d,]+ are at risk\./);
    expect(danger.alert_preview!.message_kn).toMatch(/₹[\d,]+ ಮೌಲ್ಯದ/);
    const safe = await api.runForecast("pond-6", { scenario_id: "normal", feeding_this_evening: false });
    expect(safe.summary.risk_level).toBe("safe");
    expect(safe.alert_preview!.message_en).not.toContain("₹");
  });
});
