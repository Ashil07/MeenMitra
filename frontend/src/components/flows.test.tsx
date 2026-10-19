import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetMockForTests, api } from "@/api";
import type { Alert } from "@/api/types";
import { AlertDetail } from "./AlertDetail";
import { ForecastExplorer } from "./ForecastExplorer";
import { PondForm } from "./PondForm";
import { WaterCheckForm } from "./WaterCheck";

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
});

describe("PondForm", () => {
  it("blocks submission and explains invalid fields", async () => {
    const onSubmit = vi.fn();
    render(<PondForm submitLabel="Register pond" onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: /register pond/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Pond name is required.")).toBeInTheDocument();
    expect(screen.getByLabelText("Pond name")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Pond name")).toHaveFocus();
  });

  it("submits typed values and shows backend field errors", async () => {
    const { ApiError } = await import("@/api");
    const onSubmit = vi.fn().mockRejectedValue(
      new ApiError({ kind: "validation", message: "Some fields are invalid.", path: "/ponds", status: 422, fieldErrors: { village: "Village not recognised." } }),
    );
    render(<PondForm submitLabel="Register pond" onSubmit={onSubmit} />);
    const u = userEvent.setup();
    await u.type(screen.getByLabelText("Pond name"), "Kere 9");
    await u.type(screen.getByLabelText("Farmer name"), "Demo Farmer");
    await u.clear(screen.getByLabelText(/mobile number/i));
    await u.type(screen.getByLabelText(/mobile number/i), "+919812345678");
    await u.type(screen.getByLabelText("Village"), "Kota");
    await u.type(screen.getByLabelText(/canal/i), "Canal B");
    await u.type(screen.getByLabelText("Water area"), "1200");
    await u.type(screen.getByLabelText("Stocking date"), "2026-05-01");
    await u.type(screen.getByLabelText("Fish stocked"), "3000");
    await u.click(screen.getByRole("button", { name: /register pond/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ name: "Kere 9", area_m2: 1200, depth_m: 1.5, fish_count: 3000, species: "rohu", has_aerator: false });
    expect(await screen.findByText("Village not recognised.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/could not save/i);
  });
});

describe("ForecastExplorer", () => {
  it("runs a scenario and updates the visible forecast on rerun", async () => {
    const pond = await api.getPond("pond-3");
    const u = userEvent.setup();
    render(<ForecastExplorer pond={pond} />);

    const normal = await screen.findByRole("radio", { name: "Normal night" });
    expect(normal).toBeChecked();
    // Seeded latest forecast for pond-3 is a normal night.
    expect(await screen.findByRole("heading", { name: /safe tonight/i })).toBeInTheDocument();

    await u.click(screen.getByRole("radio", { name: "High-risk night" }));
    await u.click(screen.getByRole("button", { name: /rerun forecast/i }));

    expect(await screen.findByRole("heading", { name: /danger tonight/i })).toBeInTheDocument();
    expect(screen.getByText(/forecast updated/i)).toBeInTheDocument();
    expect(screen.getAllByText("Model estimate").length).toBeGreaterThan(0);
    expect(screen.getByText(/these are estimates, not measurements/i)).toBeInTheDocument();
    expect(screen.getByText("Demo guidance")).toBeInTheDocument();

    await u.click(screen.getByRole("button", { name: /create alert from this forecast/i }));
    expect(await screen.findByText(/alert drafted/i)).toBeInTheDocument();
  });
});

describe("WaterCheckForm", () => {
  it("requires input, then shows the rules result with referral warning", async () => {
    const pond = await api.getPond("pond-2");
    const u = userEvent.setup();
    render(<WaterCheckForm pond={pond} />);

    await u.click(screen.getByRole("button", { name: /check water/i }));
    expect(screen.getByText(/enter at least one test-kit reading/i)).toBeInTheDocument();

    await u.type(screen.getByLabelText("pH"), "15");
    await u.click(screen.getByRole("button", { name: /check water/i }));
    expect(screen.getByText(/pH must be a number between 0 and 14/i)).toBeInTheDocument();

    await u.clear(screen.getByLabelText("pH"));
    await u.type(screen.getByLabelText("pH"), "7.2");
    await u.type(screen.getByLabelText("Total ammonia"), "1.4");
    await u.click(screen.getByRole("checkbox", { name: "Red spots or ulcers" }));
    await u.click(screen.getByRole("button", { name: /check water/i }));

    const result = await screen.findByRole("region", { name: /rules engine result/i });
    expect(within(result).getAllByText("Danger").length).toBeGreaterThan(0);
    expect(within(result).getByText(/not provided: water temperature, nitrite/i)).toBeInTheDocument();
    expect(within(result).getByText(/cannot diagnose fish disease/i)).toBeInTheDocument();
  });
});

describe("AlertDetail", () => {
  it("simulates a failed send, a successful send and the farmer reply", async () => {
    const pond = await api.getPond("pond-1");
    const f = await api.runForecast(pond.id, { scenario_id: "high_risk", feeding_this_evening: true });
    let alert: Alert = await api.createAlert({ pond_id: pond.id, source: "forecast", source_id: f.id });
    const u = userEvent.setup();
    const { rerender } = render(<AlertDetail alert={alert} onUpdated={(a) => (alert = a)} />);
    const sync = () => rerender(<AlertDetail alert={alert} onUpdated={(a) => (alert = a)} />);

    const firstLine = alert.message_kn.split("\n")[0];
    expect(screen.getByText((_, el) => !!el?.classList.contains("bubble") && !!el.textContent?.startsWith(firstLine))).toBeInTheDocument();
    const replyBtn = screen.getByRole("button", { name: /record reply/i });
    expect(replyBtn).toBeDisabled();

    await u.click(screen.getByRole("checkbox", { name: /simulate a provider failure/i }));
    await u.click(screen.getByRole("radio", { name: /sms/i }));
    await u.click(screen.getByRole("button", { name: /simulate send via sms/i }));
    expect(await screen.findByText(/sms delivery failed/i)).toBeInTheDocument();
    sync();
    expect(alert.status).toBe("send_failed");
    expect(screen.getByRole("button", { name: /record reply/i })).toBeDisabled();

    await u.click(screen.getByRole("checkbox", { name: /simulate a provider failure/i }));
    await u.click(screen.getByRole("radio", { name: /whatsapp/i }));
    await u.click(screen.getByRole("button", { name: /simulate send via whatsapp/i }));
    expect(await screen.findByText(/no real message was sent/i)).toBeInTheDocument();
    sync();
    expect(alert.status).toBe("sent");
    expect(alert.deliveries.every((d) => d.simulated && d.provider === "mock")).toBe(true);

    await u.click(screen.getByRole("button", { name: /record reply/i }));
    await waitFor(() => expect(alert.status).toBe("acknowledged"));
    sync();
    expect(screen.getByText(/farmer replied “1”/i)).toBeInTheDocument();
    expect((await api.getAlert(alert.id)).status).toBe("acknowledged");
  });
});
