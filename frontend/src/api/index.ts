import type { MeenMitraApi } from "./client";
import { apiConfig } from "./config";
import { createLiveApi } from "./live";
import { createMockApi } from "./mock";

export type { MeenMitraApi } from "./client";
export { ApiError, describeError } from "./errors";
export { apiConfig } from "./config";

let mock: ReturnType<typeof createMockApi> | null = null;

function getMock() {
  if (!mock) mock = createMockApi({ latencyMs: process.env.NODE_ENV === "test" ? 0 : 250 });
  return mock;
}

/** The single API entry point used by every screen. Mode is chosen by NEXT_PUBLIC_API_MODE. */
export const api: MeenMitraApi =
  apiConfig.mode === "live"
    ? createLiveApi(apiConfig.baseUrl)
    : // Lazy so the mock (and localStorage access) is only created in the browser.
      (new Proxy({} as MeenMitraApi, { get: (_t, key) => (getMock() as unknown as Record<string | symbol, unknown>)[key] }) as MeenMitraApi);

/** Demo-only: restore the seed data. No-op in live mode. */
export function resetDemoData(): boolean {
  if (apiConfig.mode !== "mock") return false;
  getMock().reset();
  return true;
}

/** Test-only: drop the cached mock instance. */
export function __resetMockForTests() {
  mock = null;
}
