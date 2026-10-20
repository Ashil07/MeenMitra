import type { Species } from "@/api/types";
import { daysBetween } from "./time";

/**
 * DEMO growth model: logistic curve of average fish weight (grams) by days since stocking.
 * Parameters are illustrative, not fitted to Karnataka pond data. The forecast uses the same
 * curve to estimate tonight's biomass, which drives oxygen demand.
 */
export const SPECIES_GROWTH: Record<Species, { winf: number; r: number }> = {
  rohu: { winf: 1500, r: 0.022 },
  catla: { winf: 2000, r: 0.025 },
  mrigal: { winf: 1000, r: 0.02 },
  tilapia: { winf: 600, r: 0.03 },
  pangasius: { winf: 2000, r: 0.03 },
  other: { winf: 1000, r: 0.022 },
};

const STOCKING_WEIGHT_G = 10;

/** Share of stocked fish assumed still alive (demo assumption). */
export const DEMO_SURVIVAL = 0.85;

/** Estimated standing biomass (kg) for a fish count and average weight. */
export function demoBiomassKg(fishCount: number, weightG: number): number {
  return Math.round((fishCount * DEMO_SURVIVAL * weightG) / 1000);
}

/** Estimated average weight (g) after `days` in the pond. */
export function weightAtDay(species: Species, days: number): number {
  const g = SPECIES_GROWTH[species];
  const d = Math.max(0, days);
  return Math.round(g.winf / (1 + ((g.winf - STOCKING_WEIGHT_G) / STOCKING_WEIGHT_G) * Math.exp(-g.r * d)));
}

/** Estimated average weight (g) today, from the stocking date (YYYY-MM-DD). */
export function demoFishWeightG(species: Species, stockingDate: string, now: Date): number {
  return weightAtDay(species, daysBetween(stockingDate, now));
}
