import type { Species } from "@/api/types";

/**
 * DEMO farm-gate prices (₹ per kg) used only to show roughly what is at stake in a pond.
 * Round illustrative figures, not market data; replace with local cooperative prices before use.
 */
export const DEMO_PRICE_PER_KG: Record<Species, number> = {
  rohu: 150,
  catla: 160,
  mrigal: 130,
  tilapia: 120,
  pangasius: 100,
  other: 120,
};

export const VALUE_NOTE = "Estimated from fish count, demo growth curve and a demo price per kg; not a valuation.";

/** Rough value of the fish in a pond, rounded to the nearest ₹1,000. */
export function fishValueInr(species: Species, biomassKg: number): number {
  return Math.round((biomassKg * DEMO_PRICE_PER_KG[species]) / 1000) * 1000;
}

/** "₹1,77,000" using Indian digit grouping. */
export function formatInr(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}
