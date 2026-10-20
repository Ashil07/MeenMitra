import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetMockForTests, api } from "@/api";
import { clearLiveWeatherCache } from "@/lib/liveWeather";
import { FarmerHome } from "./farmer/FarmerHome";
import { FarmerShell } from "./farmer/FarmerShell";
import { UI } from "./farmer/strings";
import { NightlyRun } from "./NightlyRun";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

beforeEach(() => {
  window.localStorage.clear();
  __resetMockForTests();
  clearLiveWeatherCache();
});
afterEach(() => vi.unstubAllGlobals());

/** Open-Meteo-shaped hourly data covering yesterday → tomorrow (IST), so any evening date resolves. */
function openMeteoResponse(cloud: number) {
  const time: string[] = [];
  const base = Date.now() - 2 * 86_400_000;
  for (let i = 0; i < 24 * 5; i++) {
    const ist = new Date(base + i * 3_600_000 + 330 * 60_000);
    time.push(ist.toISOString().slice(0, 13) + ":00");
  }
  const n = time.length;
  return {
    ok: true,
    json: async () => ({
      hourly: {
        time,
        temperature_2m: Array(n).fill(31),
        cloud_cover: Array(n).fill(cloud),
        wind_speed_10m: Array(n).fill(0.6),
        precipitation: Array(n).fill(0),
      },
    }),
  };
}

const ponds = () => api.listPonds();

describe("NightlyRun", () => {
  it("forecasts every pond with a scenario and drafts alerts only once", async () => {
    render(<NightlyRun onDone={() => {}} />);
    await userEvent.click(screen.getByRole("radio", { name: "High-risk night" }));
    const button = screen.getByRole("button", { name: /run tonight's 5 pm forecast/i });
    await userEvent.click(button);
    await screen.findByText(/ponds have a Watch or Danger oxygen forecast tonight/i, {}, { timeout: 5000 });
    const total = (await ponds()).length;
    const drafted = screen.getAllByText("Alert drafted").length;
    expect(drafted).toBeGreaterThan(0);
    expect(screen.getByText(/of fish are in those ponds/)).toBeInTheDocument();
    const draftsAfterFirst = (await api.listAlerts({ kind: "oxygen_forecast", status: "draft" })).length;

    await userEvent.click(button);
    await waitFor(() => expect(screen.getAllByText("Alert already drafted").length).toBe(drafted), { timeout: 5000 });
    expect((await api.listAlerts({ kind: "oxygen_forecast", status: "draft" })).length).toBe(draftsAfterFirst);
    expect(screen.getAllByRole("listitem")).toHaveLength(total);
  });

  it("uses live Open-Meteo weather for each village", async () => {
    const fetchMock = vi.fn().mockResolvedValue(openMeteoResponse(95));
    vi.stubGlobal("fetch", fetchMock);
    render(<NightlyRun onDone={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /run tonight's 5 pm forecast/i }));
    await screen.findByText(/ponds have a Watch or Danger oxygen forecast tonight/i, {}, { timeout: 5000 });
    expect(fetchMock.mock.calls.every(([url]) => String(url).startsWith("https://api.open-meteo.com/"))).toBe(true); // demo villages need no geocoding
    const f = await api.getLatestForecast("pond-1");
    expect(f?.inputs.live_weather?.provider).toBe("open-meteo");
    expect(f?.inputs.weather.cloud_cover_pct).toBe(95);
  });

  it("reports a pond whose weather could not be fetched instead of guessing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    render(<NightlyRun onDone={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /run tonight's 5 pm forecast/i }));
    await waitFor(() => expect(screen.getAllByText(/Failed: Could not reach Open-Meteo/).length).toBe(6), { timeout: 5000 });
  });
});

describe("farmer screen PPT features", () => {
  it("shows the value of fish at risk for a Danger forecast", async () => {
    await api.runForecast("pond-1", { scenario_id: "high_risk", feeding_this_evening: true });
    render(<FarmerShell>{(lang) => <FarmerHome pondId="pond-1" lang={lang} />}</FarmerShell>);
    const card = (await screen.findByRole("heading", { level: 1 })).closest("section")!;
    expect(await within(card).findByText(/₹[\d,]+ ಮೌಲ್ಯದ ಮೀನುಗಳು ಅಪಾಯದಲ್ಲಿವೆ/)).toBeInTheDocument();
  });

  it("tells a reporting farmer that canal neighbours will be warned", async () => {
    render(<FarmerShell>{(lang) => <FarmerHome pondId="pond-5" lang={lang} />}</FarmerShell>);
    const section = (await screen.findByRole("heading", { name: UI.reportTitle.kn })).closest("section")!;
    await userEvent.click(within(section).getByRole("button", { name: /ಕೆಂಪು ಕಲೆ/ }));
    await userEvent.click(within(section).getByRole("button", { name: UI.send.kn }));
    expect(await within(section).findByText(UI.canalWarned.kn)).toBeInTheDocument();
  });
});
