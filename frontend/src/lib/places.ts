/**
 * Approximate village points for weather lookups and the cooperative map.
 * These are public village locations, not pond or farmer locations. Brahmavar and Kota are not
 * in the Open-Meteo geocoder (and "Kota" resolves to Rajasthan), so the demo villages live here;
 * other villages are geocoded by name, restricted to Karnataka.
 */
export interface Place {
  name: string;
  latitude: number;
  longitude: number;
  source: "village_table" | "geocoded" | "district_default";
}

export const VILLAGE_POINTS: Record<string, { latitude: number; longitude: number }> = {
  brahmavar: { latitude: 13.437, longitude: 74.744 },
  brahmavara: { latitude: 13.437, longitude: 74.744 },
  kota: { latitude: 13.515, longitude: 74.705 }, // Kota, Udupi district (approximate)
  mulki: { latitude: 13.091, longitude: 74.794 },
  padubidri: { latitude: 13.138, longitude: 74.771 },
  udupi: { latitude: 13.335, longitude: 74.746 },
};

/** Used only if a village cannot be located at all; clearly reported as a district default. */
export const DISTRICT_DEFAULT: Place = { name: "Udupi (district default)", latitude: 13.335, longitude: 74.746, source: "district_default" };

const key = (village: string) => village.trim().toLowerCase().replace(/\s+/g, " ");

export function knownVillage(village: string): Place | null {
  const p = VILLAGE_POINTS[key(village)];
  return p ? { name: village.trim(), ...p, source: "village_table" } : null;
}

const geocodeCache = new Map<string, Promise<Place>>();

/** Built-in point first, then Open-Meteo geocoding (Karnataka only), then the district default. */
export function locateVillage(village: string, fetchImpl: typeof fetch = fetch): Promise<Place> {
  const known = knownVillage(village);
  if (known) return Promise.resolve(known);
  const k = key(village);
  let pending = geocodeCache.get(k);
  if (!pending) {
    pending = geocode(village, fetchImpl);
    geocodeCache.set(k, pending);
    // A fallback may come from a temporary network problem; let the next call try again.
    void pending.then((p) => p.source === "district_default" && geocodeCache.delete(k));
  }
  return pending;
}

async function geocode(village: string, fetchImpl: typeof fetch): Promise<Place> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(village.trim())}&count=10&language=en&format=json&countryCode=IN`;
  try {
    const res = await fetchImpl(url);
    if (!res.ok) return DISTRICT_DEFAULT;
    const data = (await res.json()) as { results?: { name: string; latitude: number; longitude: number; admin1?: string }[] };
    const hit = data.results?.find((r) => r.admin1 === "Karnataka");
    return hit ? { name: hit.name, latitude: hit.latitude, longitude: hit.longitude, source: "geocoded" } : DISTRICT_DEFAULT;
  } catch {
    return DISTRICT_DEFAULT;
  }
}
