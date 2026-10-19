import type { MeenMitraApi } from "./client";
import { ApiError, errorFromResponse } from "./errors";

const TIMEOUT_MS = 15_000;

type Query = Record<string, string | number | boolean | undefined | null>;

function buildUrl(baseUrl: string, path: string, query?: Query): string {
  const url = new URL(`${baseUrl}/api/v1${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export function createLiveApi(baseUrl: string, fetchImpl: typeof fetch = (...a) => fetch(...a)): MeenMitraApi {
  async function request<T>(method: string, path: string, opts: { body?: unknown; query?: Query } = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetchImpl(buildUrl(baseUrl, path, opts.query), {
        method,
        headers: opts.body !== undefined ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError";
      throw new ApiError({
        kind: aborted ? "timeout" : "network",
        message: aborted ? "Request timed out." : "Network error.",
        path,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) throw await errorFromResponse(res, path);
    if (res.status === 204) return undefined as T;
    try {
      return (await res.json()) as T;
    } catch {
      throw new ApiError({ kind: "server", message: "The backend returned a response that is not valid JSON.", path, status: res.status });
    }
  }

  const enc = encodeURIComponent;

  return {
    health: () => request("GET", "/health"),
    getDashboard: () => request("GET", "/dashboard/summary"),

    listPonds: (q) => request("GET", "/ponds", { query: { search: q?.search, risk: q?.risk } }),
    getPond: (id) => request("GET", `/ponds/${enc(id)}`),
    createPond: (input) => request("POST", "/ponds", { body: input }),
    updatePond: (id, input) => request("PATCH", `/ponds/${enc(id)}`, { body: input }),

    listScenarios: () => request("GET", "/forecast/scenarios"),
    runForecast: (pondId, req) => request("POST", `/ponds/${enc(pondId)}/forecasts`, { body: req }),
    // Contract: 200 with JSON `null` when the pond has no forecast yet; 404 only when the pond is missing.
    getLatestForecast: (pondId) => request("GET", `/ponds/${enc(pondId)}/forecasts/latest`),

    listWaterChecks: (pondId) => request("GET", `/ponds/${enc(pondId)}/water-checks`),
    submitWaterCheck: (pondId, req) => request("POST", `/ponds/${enc(pondId)}/water-checks`, { body: req }),

    submitFeedback: (pondId, response) => request("POST", `/ponds/${enc(pondId)}/feedback`, { body: { response } }),

    listAlerts: (q) =>
      request("GET", "/alerts", { query: { pond_id: q?.pond_id, status: q?.status, risk: q?.risk, kind: q?.kind } }),
    getAlert: (id) => request("GET", `/alerts/${enc(id)}`),
    createAlert: (req) => request("POST", "/alerts", { body: req }),
    sendAlert: (id, req) => request("POST", `/alerts/${enc(id)}/deliveries`, { body: req }),
    acknowledgeAlert: (id, req) => request("POST", `/alerts/${enc(id)}/acknowledge`, { body: req }),

    getCooperative: () => request("GET", "/cooperative/overview"),
    getMlStatus: () => request("GET", "/ml/status"),
  };
}
