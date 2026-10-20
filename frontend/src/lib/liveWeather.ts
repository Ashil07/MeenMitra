import type { LiveWeatherInfo, WeatherInputs } from "@/api/types";
import { locateVillage, type Place } from "./places";
import { istDateString } from "./time";

/**
 * Tonight's weather for a village from the free Open-Meteo forecast API (CC BY 4.0, no key).
 * Summarised into the five inputs the forecast uses:
 *   cloud & rain   — daytime 06:00–17:00 IST of the evening's date (how much oxygen algae made)
 *   evening temp   — 18:00 IST
 *   overnight low  — minimum 18:00 → 08:00 next morning
 *   night wind     — mean 18:00 → 08:00, m/s
 */
export const OPEN_METEO_ATTRIBUTION = "Weather data by Open-Meteo.com (CC BY 4.0)";

export class LiveWeatherError extends Error {}

export interface LiveWeather {
  weather: WeatherInputs;
  info: LiveWeatherInfo;
}

interface Hourly {
  time: string[];
  temperature_2m: (number | null)[];
  cloud_cover: (number | null)[];
  wind_speed_10m: (number | null)[];
  precipitation: (number | null)[];
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const pad = (n: number) => String(n).padStart(2, "0");

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Pure: turn an Open-Meteo hourly payload into the five forecast inputs for the given evening. */
export function summariseNight(hourly: Hourly, eveningDate: string): WeatherInputs {
  const index = new Map(hourly.time.map((t, i) => [t, i]));
  const at = (date: string, h: number) => {
    const i = index.get(`${date}T${pad(h)}:00`);
    if (i === undefined) throw new LiveWeatherError(`Forecast has no data for ${date} ${pad(h)}:00.`);
    return i;
  };
  const series = (name: keyof Omit<Hourly, "time">, idx: number[]) =>
    idx.map((i) => {
      const v = hourly[name][i];
      if (v === null || v === undefined || !Number.isFinite(v)) throw new LiveWeatherError(`Forecast is missing ${name} values.`);
      return v;
    });

  const next = addDays(eveningDate, 1);
  const day = Array.from({ length: 12 }, (_, k) => at(eveningDate, 6 + k));
  const night = [...Array.from({ length: 6 }, (_, k) => at(eveningDate, 18 + k)), ...Array.from({ length: 9 }, (_, k) => at(next, k))];

  const cloud = series("cloud_cover", day);
  const rain = series("precipitation", day);
  const temps = series("temperature_2m", night);
  const wind = series("wind_speed_10m", night);
  return {
    cloud_cover_pct: Math.round(cloud.reduce((a, b) => a + b, 0) / cloud.length),
    rain_mm: r1(rain.reduce((a, b) => a + b, 0)),
    air_temp_evening_c: r1(temps[0]),
    air_temp_min_c: r1(Math.min(...temps)),
    wind_speed_ms: r1(wind.reduce((a, b) => a + b, 0) / wind.length),
  };
}

/** The evening a forecast run "belongs" to: before 06:00 IST it is still last night. */
export function eveningDateFor(now: Date): string {
  return istDateString(new Date(now.getTime() - 6 * 3_600_000));
}

export async function fetchPlaceWeather(place: Place, now: Date = new Date(), fetchImpl: typeof fetch = fetch): Promise<LiveWeather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
    "&hourly=temperature_2m,cloud_cover,wind_speed_10m,precipitation&wind_speed_unit=ms&timezone=Asia%2FKolkata&past_days=1&forecast_days=2";
  let data: { hourly?: Hourly };
  try {
    const res = await fetchImpl(url);
    if (!res.ok) throw new LiveWeatherError(`Open-Meteo returned HTTP ${res.status}.`);
    data = (await res.json()) as { hourly?: Hourly };
  } catch (e) {
    if (e instanceof LiveWeatherError) throw e;
    throw new LiveWeatherError("Could not reach Open-Meteo. Check the internet connection, or use a weather scenario instead.");
  }
  if (!data.hourly) throw new LiveWeatherError("Open-Meteo returned no hourly forecast.");
  return {
    weather: summariseNight(data.hourly, eveningDateFor(now)),
    info: {
      provider: "open-meteo",
      place: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
      location_source: place.source,
      fetched_at: now.toISOString(),
    },
  };
}

/** Locate the village, then fetch its weather. Results are cached per village for 30 minutes. */
const cache = new Map<string, { at: number; value: Promise<LiveWeather> }>();

/** Test-only: forget cached weather. */
export function clearLiveWeatherCache() {
  cache.clear();
}

export function fetchVillageWeather(village: string, fetchImpl: typeof fetch = fetch): Promise<LiveWeather> {
  const k = village.trim().toLowerCase();
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < 30 * 60_000) return hit.value;
  const value = locateVillage(village, fetchImpl).then((place) => fetchPlaceWeather(place, new Date(), fetchImpl));
  value.catch(() => cache.delete(k)); // never cache a failure
  cache.set(k, { at: Date.now(), value });
  return value;
}
