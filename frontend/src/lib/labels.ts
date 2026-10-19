import type { AlertKind, AlertStatus, AlgaeLevel, Channel, DatasetStatus, DeliveryStatus, Species, Symptom, TrainingStatus } from "@/api/types";

export const SPECIES_LABEL: Record<Species, string> = {
  rohu: "Rohu",
  catla: "Catla",
  mrigal: "Mrigal",
  tilapia: "Tilapia",
  pangasius: "Pangasius",
  other: "Other",
};

export const ALGAE_LABEL: Record<AlgaeLevel, string> = {
  low: "Low (clear water)",
  medium: "Medium (light green)",
  high: "High (dark green)",
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  whatsapp: "WhatsApp",
  sms: "SMS",
  voice: "Voice call",
};

export const ALERT_KIND_LABEL: Record<AlertKind, string> = {
  oxygen_forecast: "Oxygen forecast",
  water_quality: "Water check",
  outbreak_notice: "Outbreak notice",
};

export const ALERT_STATUS_LABEL: Record<AlertStatus, string> = {
  draft: "Draft — not sent",
  sent: "Delivered (simulated)",
  send_failed: "Send failed",
  acknowledged: "Farmer replied",
};

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  queued: "Queued",
  delivered: "Delivered",
  failed: "Failed",
};

/** Symptom display labels. Keys are the shared contract enum. */
export const SYMPTOM_LABEL: Record<Symptom, string> = {
  gasping_at_surface: "Fish gasping at the surface",
  not_feeding: "Fish not feeding",
  erratic_swimming: "Erratic or slow swimming",
  red_spots_or_ulcers: "Red spots or ulcers",
  white_patches_or_fungus: "White patches / cotton-like fungus",
  fin_rot: "Frayed or rotting fins",
  dead_fish: "Dead fish seen",
  foul_smell: "Foul smell from water",
  thick_green_water: "Very thick green water",
};

export const DATASET_STATUS_LABEL: Record<DatasetStatus, string> = {
  not_downloaded: "Not downloaded",
  available: "Files present",
  loaded: "Loaded",
  error: "Error",
};

export const TRAINING_STATUS_LABEL: Record<TrainingStatus, string> = {
  not_started: "Not trained",
  running: "Training…",
  trained: "Trained",
  failed: "Training failed",
};

export const fmtInt = (n: number) => n.toLocaleString("en-IN");

/** "+91 ••••••0001" — never show a full farmer number on shared screens. */
export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.length >= 4 ? `+${d.slice(0, 2)} ••••••${d.slice(-4)}` : "••••";
}
