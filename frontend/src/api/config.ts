export type ApiMode = "mock" | "live";

export interface ApiConfig {
  mode: ApiMode;
  baseUrl: string;
}

const DEFAULT_BASE_URL = "http://localhost:8000";

export function readApiConfig(env: Record<string, string | undefined> = {
  // Next.js inlines NEXT_PUBLIC_* at build time only when referenced literally.
  NEXT_PUBLIC_API_MODE: process.env.NEXT_PUBLIC_API_MODE,
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
}): ApiConfig {
  const rawMode = (env.NEXT_PUBLIC_API_MODE ?? "mock").trim().toLowerCase();
  const mode: ApiMode = rawMode === "live" ? "live" : "mock";
  const baseUrl = (env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_BASE_URL).trim().replace(/\/+$/, "");
  return { mode, baseUrl: baseUrl || DEFAULT_BASE_URL };
}

export const apiConfig = readApiConfig();
