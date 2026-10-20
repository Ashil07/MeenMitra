import { describe, expect, it, vi } from "vitest";
import { demoBiomassKg, weightAtDay } from "./growth";
import { LiveWeatherError, eveningDateFor, fetchPlaceWeather, summariseNight } from "./liveWeather";
import { DISTRICT_DEFAULT, knownVillage, locateVillage } from "./places";
import { fishValueInr, formatInr } from "./value";

/** Hourly payload for 2026-10-20 and 2026-10-21 (IST), shaped like Open-Meteo's response. */
function hourly(over: Partial<Record<"temperature_2m" | "cloud_cover" | "wind_speed_10m" | "precipitation", (h: number, day: number) => number | null>> = {}) {
  const time: string[] = [];
  const t: (number | null)[] = [];
  const c: (number | null)[] = [];
  const w: (number | null)[] = [];
  const p: (number | null)[] = [];
  ["2026-10-20", "2026-10-21"].forEach((date, day) => {
    for (let h = 0; h < 24; h++) {
      time.push(`${date}T${String(h).padStart(2, "0")}:00`);
      t.push(over.temperature_2m ? over.temperature_2m(h, day) : 30 - (day * 24 + h - 18) * 0.25);
      c.push(over.cloud_cover ? over.cloud_cover(h, day) : 60);
      w.push(over.wind_speed_10m ? over.wind_speed_10m(h, day) : 2);
      p.push(over.precipitation ? over.precipitation(h, day) : h === 14 && day === 0 ? 3.5 : 0);
    }
  });
  return { time, temperature_2m: t, cloud_cover: c, wind_speed_10m: w, precipitation: p };
}

describe("live weather summary", () => {
  it("summarises daytime cloud/rain and the 6 PM → 8 AM night", () => {
    const s = summariseNight(hourly(), "2026-10-20");
    expect(s.cloud_cover_pct).toBe(60);
    expect(s.rain_mm).toBe(3.5);
    expect(s.air_temp_evening_c).toBe(30);
    expect(s.air_temp_min_c).toBe(26.5); // 08:00 next day is 14 h after 18:00 → 30 − 14 × 0.25
    expect(s.wind_speed_ms).toBe(2);
  });

  it("refuses incomplete data instead of guessing", () => {
    expect(() => summariseNight(hourly({ wind_speed_10m: (h, d) => (d === 1 && h === 3 ? null : 2) }), "2026-10-20")).toThrow(LiveWeatherError);
    expect(() => summariseNight(hourly(), "2026-10-25")).toThrow(LiveWeatherError);
  });

  it("treats the small hours as part of the previous evening", () => {
    expect(eveningDateFor(new Date("2026-10-20T13:00:00Z"))).toBe("2026-10-20"); // 6:30 PM IST
    expect(eveningDateFor(new Date("2026-10-20T22:00:00Z"))).toBe("2026-10-20"); // 3:30 AM IST next day
  });

  it("fetches and reports where the weather came from", async () => {
    const fake = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ hourly: hourly() }) });
    const place = knownVillage("Brahmavar")!;
    const r = await fetchPlaceWeather(place, new Date("2026-10-20T11:30:00Z"), fake as unknown as typeof fetch);
    expect(fake.mock.calls[0][0]).toContain("latitude=13.437");
    expect(r.info).toMatchObject({ provider: "open-meteo", place: "Brahmavar", location_source: "village_table" });
    expect(r.weather.cloud_cover_pct).toBe(60);
  });

  it("reports network and HTTP failures clearly", async () => {
    const place = knownVillage("Mulki")!;
    await expect(fetchPlaceWeather(place, new Date(), vi.fn().mockRejectedValue(new TypeError("offline")) as unknown as typeof fetch)).rejects.toThrow(/Could not reach Open-Meteo/);
    await expect(fetchPlaceWeather(place, new Date(), vi.fn().mockResolvedValue({ ok: false, status: 503 }) as unknown as typeof fetch)).rejects.toThrow(/HTTP 503/);
  });
});

describe("village locations", () => {
  it("uses the built-in point for demo villages without calling the geocoder", async () => {
    const fake = vi.fn();
    const p = await locateVillage("Kota", fake as unknown as typeof fetch);
    expect(p.source).toBe("village_table");
    expect(p.latitude).toBeCloseTo(13.5, 1); // Kota in Udupi, not Kota in Rajasthan
    expect(fake).not.toHaveBeenCalled();
  });

  it("geocodes other villages but only accepts Karnataka matches", async () => {
    const fake = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { name: "Hebri", latitude: 25.1, longitude: 75.8, admin1: "Rajasthan" },
          { name: "Hebri", latitude: 13.46, longitude: 74.98, admin1: "Karnataka" },
        ],
      }),
    });
    const p = await locateVillage("Hebri", fake as unknown as typeof fetch);
    expect(p).toMatchObject({ source: "geocoded", latitude: 13.46 });
  });

  it("falls back to the district default, and does not cache that fallback", async () => {
    const failing = vi.fn().mockRejectedValue(new TypeError("offline"));
    expect(await locateVillage("Nowhereville", failing as unknown as typeof fetch)).toEqual(DISTRICT_DEFAULT);
    const working = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [{ name: "Nowhereville", latitude: 13.2, longitude: 74.8, admin1: "Karnataka" }] }) });
    await Promise.resolve();
    expect((await locateVillage("Nowhereville", working as unknown as typeof fetch)).source).toBe("geocoded");
  });
});

describe("growth and value", () => {
  it("grows along the curve and estimates biomass", () => {
    expect(weightAtDay("rohu", 0)).toBe(10);
    expect(weightAtDay("rohu", 150)).toBeGreaterThan(weightAtDay("rohu", 60));
    expect(weightAtDay("rohu", 2000)).toBeLessThanOrEqual(1500);
    expect(demoBiomassKg(1000, 200)).toBe(170); // 85% survival
  });

  it("values fish with Indian digit grouping", () => {
    expect(fishValueInr("rohu", 1178)).toBe(177_000);
    expect(formatInr(177_000)).toBe("₹1,77,000");
  });
});
