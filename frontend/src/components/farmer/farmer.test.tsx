import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetMockForTests, api } from "@/api";
import type { Alert } from "@/api/types";
import { FarmerHome, latestMessage } from "./FarmerHome";
import { FarmerPicker } from "./FarmerPicker";
import { FarmerShell } from "./FarmerShell";
import { STATUS_WORD, STEP_TEXT, UI, relativeTime, stepsFor } from "./strings";

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

function renderPond(id = "pond-1") {
  return render(<FarmerShell>{(lang) => <FarmerHome pondId={id} lang={lang} />}</FarmerShell>);
}

describe("farmer copy rules", () => {
  it("gives at most three steps and adapts to aerators", () => {
    for (const level of ["safe", "watch", "danger", "unknown"] as const) {
      expect(stepsFor(level, true).length).toBeLessThanOrEqual(3);
    }
    expect(stepsFor("danger", true)[0]).toBe("aerator_all_night");
    expect(stepsFor("danger", false)[0]).toBe("fresh_water");
  });

  it("never mentions units or exact oxygen values", () => {
    const all = [...Object.values(UI), ...Object.values(STEP_TEXT)].flatMap((t) => [t.kn, t.en]).join(" ");
    expect(all).not.toMatch(/mg\/L|ppm|\d+(\.\d+)?\s?%/);
  });

  it("formats relative time in Kannada and English", () => {
    const now = new Date("2026-10-20T06:00:00Z");
    expect(relativeTime("2026-10-20T05:20:00Z", "kn", now)).toBe("40 ನಿಮಿಷ ಹಿಂದೆ");
    expect(relativeTime("2026-10-19T18:00:00Z", "en", now)).toBe("12 h ago");
    expect(relativeTime(null, "en", now)).toBe("never");
  });

  it("only shows recent messages the farmer could have received", () => {
    const now = new Date("2026-10-20T06:00:00Z").getTime();
    const base = { status: "sent", created_at: "2026-10-20T01:00:00Z" } as Alert;
    expect(latestMessage([{ ...base, id: "a", status: "draft" } as Alert], now)).toBeNull();
    expect(latestMessage([{ ...base, id: "b", created_at: "2026-10-17T01:00:00Z" } as Alert], now)).toBeNull();
    expect(latestMessage([{ ...base, id: "c" } as Alert], now)?.id).toBe("c");
  });
});

describe("FarmerHome", () => {
  it("shows the pond status in Kannada first, then switches to English", async () => {
    renderPond();
    const status = await screen.findByRole("heading", { level: 1 });
    const pond = await api.getPond("pond-1");
    expect(status).toHaveTextContent(STATUS_WORD[pond.latest_risk].kn);
    expect(screen.getByText(UI.todoTitle.kn)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/mg\/L/);

    await userEvent.click(screen.getByRole("button", { name: UI.switchToLabel.kn }));
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(STATUS_WORD[pond.latest_risk].en);
    expect(window.localStorage.getItem("meenmitra.farmer.lang")).toBe("en");
  });

  it("records the morning check-in with one tap", async () => {
    const before = (await api.getPond("pond-1")).feedback_count;
    renderPond();
    const section = (await screen.findByRole("heading", { name: UI.morningTitle.kn })).closest("section")!;
    await userEvent.click(within(section).getByRole("button", { name: /ಉಸಿರಿಗಾಗಿ/ }));
    expect(await within(section).findByText(UI.thanks.kn)).toBeInTheDocument();
    expect((await api.getPond("pond-1")).feedback_count).toBe(before + 1);
    expect(within(section).getByText(UI.thanksGasping.kn)).toBeInTheDocument();
  });

  it("requires a symptom before sending a problem report, then refers to an officer", async () => {
    const checksBefore = (await api.listWaterChecks("pond-5")).length;
    renderPond("pond-5");
    const section = (await screen.findByRole("heading", { name: UI.reportTitle.kn })).closest("section")!;
    await userEvent.click(within(section).getByRole("button", { name: UI.send.kn }));
    expect(within(section).getByRole("alert")).toHaveTextContent(UI.pickOne.kn);
    expect(await api.listWaterChecks("pond-5")).toHaveLength(checksBefore);

    const tile = within(section).getByRole("button", { name: /ಸತ್ತ ಮೀನು/ });
    await userEvent.click(tile);
    expect(tile).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(within(section).getByRole("button", { name: UI.send.kn }));
    expect(await within(section).findByText(UI.medicine.kn)).toBeInTheDocument();
    const checks = await api.listWaterChecks("pond-5");
    expect(checks).toHaveLength(checksBefore + 1);
    expect(checks[0].symptoms).toEqual(["dead_fish"]);
    expect(within(section).getByText(UI.notDiagnosis.kn)).toBeInTheDocument();
  });

  it("lets the farmer acknowledge a delivered message", async () => {
    const forecast = await api.getLatestForecast("pond-3");
    expect(forecast).not.toBeNull();
    const alert = await api.createAlert({ pond_id: "pond-3", source: "forecast", source_id: forecast!.id });
    await api.sendAlert(alert.id, { channel: "whatsapp" });

    renderPond("pond-3");
    const section = (await screen.findByRole("heading", { name: UI.messageTitle.kn })).closest("section")!;
    expect(within(section).getByText(new RegExp(UI.demoMessage.kn))).toBeInTheDocument();
    await userEvent.click(within(section).getByRole("button", { name: UI.ack.kn }));
    expect(await within(section).findByText(new RegExp(UI.acked.kn))).toBeInTheDocument();
    expect((await api.getAlert(alert.id)).status).toBe("acknowledged");
  });

  it("hides the message card when nothing was delivered", async () => {
    renderPond("pond-6");
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("heading", { name: UI.messageTitle.kn })).not.toBeInTheDocument();
  });

  it("explains that read-aloud is unavailable when the device cannot speak", async () => {
    renderPond();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("button", { name: UI.listen.kn })).not.toBeInTheDocument();
    expect(screen.getByText(UI.noVoice.kn)).toBeInTheDocument();
  });

  it("uses only a matching voice: note in Kannada, working button in English", async () => {
    const speak = vi.fn();
    const englishOnly = [{ name: "Microsoft Heera", lang: "en-IN", localService: true, default: true, voiceURI: "heera" }];
    vi.stubGlobal("speechSynthesis", {
      getVoices: () => englishOnly,
      speak,
      cancel: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        text: string;
        lang = "";
        voice: unknown = null;
        rate = 1;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(text: string) {
          this.text = text;
        }
      },
    );
    try {
      renderPond();
      await screen.findByRole("heading", { level: 1 });
      expect(screen.getByText(UI.noVoice.kn)).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: UI.switchToLabel.kn }));
      const listen = await screen.findByRole("button", { name: UI.listen.en });
      await userEvent.click(listen);
      expect(speak).toHaveBeenCalledTimes(1);
      expect(speak.mock.calls[0][0].lang).toBe("en-IN");
      expect(speak.mock.calls[0][0].text).toMatch(/Danger|Be careful|Safe|No check yet/);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("shows a clear message for an unknown pond", async () => {
    renderPond("pond-missing");
    expect(await screen.findByText(UI.pondNotFound.kn)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: UI.changePond.kn })[0]).toHaveAttribute("href", "/farmer");
  });

  it("remembers the pond for the next visit", async () => {
    renderPond("pond-2");
    await screen.findByRole("heading", { level: 1 });
    await waitFor(() => expect(window.localStorage.getItem("meenmitra.farmer.pond")).toBe("pond-2"));
  });
});

describe("FarmerPicker", () => {
  it("lists ponds without farmer names and pins the remembered pond", async () => {
    window.localStorage.setItem("meenmitra.farmer.pond", "pond-4");
    render(<FarmerShell>{(lang) => <FarmerPicker lang={lang} />}</FarmerShell>);
    expect(await screen.findByText(UI.lastUsed.kn)).toBeInTheDocument();
    const links = screen.getAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/farmer/"));
    expect(links[0]).toHaveAttribute("href", "/farmer/pond-4");
    expect(links).toHaveLength(6);
    expect(document.body.textContent).not.toMatch(/\(demo\)/); // seed farmer names all end in "(demo)"
  });
});
