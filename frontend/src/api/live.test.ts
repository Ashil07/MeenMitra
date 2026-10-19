import { describe, expect, it, vi } from "vitest";
import { readApiConfig } from "./config";
import { ApiError, describeError } from "./errors";
import { createLiveApi } from "./live";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("readApiConfig", () => {
  it("defaults to mock mode and localhost", () => {
    expect(readApiConfig({})).toEqual({ mode: "mock", baseUrl: "http://localhost:8000" });
  });
  it("reads live mode and strips trailing slashes", () => {
    expect(readApiConfig({ NEXT_PUBLIC_API_MODE: "LIVE", NEXT_PUBLIC_API_BASE_URL: "http://api.local:9000///" })).toEqual({
      mode: "live",
      baseUrl: "http://api.local:9000",
    });
  });
  it("treats unknown modes as mock", () => {
    expect(readApiConfig({ NEXT_PUBLIC_API_MODE: "production" }).mode).toBe("mock");
  });
});

describe("live API client", () => {
  it("calls /api/v1 paths with the right method, query and JSON body", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(200, { id: "f1" }));
    const api = createLiveApi("http://backend:8000", fetchMock as unknown as typeof fetch);

    await api.runForecast("pond 1", { scenario_id: "high_risk", feeding_this_evening: false });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://backend:8000/api/v1/ponds/pond%201/forecasts");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ scenario_id: "high_risk", feeding_this_evening: false });
    expect(init.headers["Content-Type"]).toBe("application/json");

    await api.listPonds({ search: "kere", risk: "danger" });
    expect(fetchMock.mock.calls[1][0]).toBe("http://backend:8000/api/v1/ponds?search=kere&risk=danger");
    expect(fetchMock.mock.calls[1][1].method).toBe("GET");

    await api.listAlerts({});
    expect(fetchMock.mock.calls[2][0]).toBe("http://backend:8000/api/v1/alerts");
  });

  it("maps FastAPI 422 detail arrays to field errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(422, { detail: [{ loc: ["body", "area_m2"], msg: "Input should be greater than 50", type: "greater_than" }] }),
    );
    const api = createLiveApi("http://b", fetchMock as unknown as typeof fetch);
    const err = await api.createPond({} as never).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).kind).toBe("validation");
    expect((err as ApiError).fieldErrors).toEqual({ area_m2: "Input should be greater than 50" });
  });

  it("reports a missing endpoint clearly instead of inventing data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("Not Found", { status: 404 }));
    const api = createLiveApi("http://b", fetchMock as unknown as typeof fetch);
    const err = (await api.getMlStatus().catch((e: unknown) => e)) as ApiError;
    expect(err.kind).toBe("not_found");
    expect(err.message).toMatch(/\/ml\/status/);
  });

  it("treats FastAPI's generic route 404 as a missing endpoint, but keeps specific 404 messages", async () => {
    const generic = createLiveApi("http://b", vi.fn().mockResolvedValue(jsonResponse(404, { detail: "Not Found" })) as unknown as typeof fetch);
    expect(((await generic.getDashboard().catch((e: unknown) => e)) as ApiError).message).toMatch(/does not provide \/dashboard\/summary/);
    const specific = createLiveApi("http://b", vi.fn().mockResolvedValue(jsonResponse(404, { detail: "Pond not found" })) as unknown as typeof fetch);
    expect(((await specific.getPond("x").catch((e: unknown) => e)) as ApiError).message).toBe("Pond not found");
  });

  it("uses the backend's string detail as the message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(409, { detail: "Alert not delivered yet" }));
    const api = createLiveApi("http://b", fetchMock as unknown as typeof fetch);
    const err = (await api.acknowledgeAlert("a1", { response: "1" }).catch((e: unknown) => e)) as ApiError;
    expect(err.status).toBe(409);
    expect(err.message).toBe("Alert not delivered yet");
  });

  it("turns fetch failures into a network error with guidance", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const api = createLiveApi("http://b", fetchMock as unknown as typeof fetch);
    const err = (await api.health().catch((e: unknown) => e)) as ApiError;
    expect(err.kind).toBe("network");
    expect(describeError(err)).toMatch(/Could not reach the MeenMitra backend/);
  });

  it("returns null when the backend reports no latest forecast", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, null));
    const api = createLiveApi("http://b", fetchMock as unknown as typeof fetch);
    expect(await api.getLatestForecast("p1")).toBeNull();
  });
});
