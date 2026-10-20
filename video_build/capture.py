"""Capture MeenMitra screens for the rough cut by driving the running demo app in headless Chrome.

Writes out/shots/<id>.png (1920x1080 desktop, or 824x1760 mobile) and out/shots/meta.json with
each shot's zoom focus (fx, fy in 0..1) and some on-screen facts used to check the narration.
Run with the frontend dev server on http://localhost:3000 in mock mode.
"""

import json
import re
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

BASE = "http://localhost:3000"
OUT = Path(__file__).parent / "out" / "shots"
OUT.mkdir(parents=True, exist_ok=True)
META: dict = {"shots": {}, "facts": {}}

HIDE_DEV = "nextjs-portal{display:none!important} *{caret-color:transparent!important}"


def prep(page: Page) -> None:
    page.add_style_tag(content=HIDE_DEV)


def clear(page: Page) -> None:
    page.evaluate("document.querySelectorAll('.__hl').forEach(e => e.remove())")


def focus(page: Page, loc, color: str = "#0f8a7e", pad: int = 10, scroll: bool = True) -> tuple[float, float]:
    """Scroll an element to the centre, draw a highlight box round it, return its centre (0..1)."""
    loc = loc.first
    if scroll:
        loc.evaluate("e => e.scrollIntoView({block: 'center', inline: 'nearest'})")
        page.wait_for_timeout(500)
    b = loc.bounding_box()
    vw, vh = page.viewport_size["width"], page.viewport_size["height"]
    page.evaluate(
        """([x, y, w, h, c]) => {
            const d = document.createElement('div');
            d.className = '__hl';
            Object.assign(d.style, {position: 'fixed', left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px',
              border: `4px solid ${c}`, borderRadius: '14px', boxShadow: `0 0 0 6px ${c}33`, zIndex: 99999, pointerEvents: 'none'});
            document.body.appendChild(d);
        }""",
        [b["x"] - pad, b["y"] - pad, b["width"] + 2 * pad, b["height"] + 2 * pad, color],
    )
    cx = min(max((b["x"] + b["width"] / 2) / vw, 0), 1)
    cy = min(max((b["y"] + b["height"] / 2) / vh, 0), 1)
    return cx, cy


def shot(page: Page, sid: str, fx: float = 0.5, fy: float = 0.5) -> None:
    page.wait_for_timeout(300)
    page.screenshot(path=str(OUT / f"{sid}.png"))
    META["shots"][sid] = {"fx": round(fx, 3), "fy": round(fy, 3)}
    clear(page)
    print("shot", sid)


def goto(page: Page, path: str, wait_text: str) -> None:
    page.goto(BASE + path, wait_until="networkidle")
    page.get_by_text(wait_text).first.wait_for(timeout=30000)
    prep(page)
    page.wait_for_timeout(600)


def desktop_steps(page: Page) -> None:
    # Dashboard as seeded.
    goto(page, "/", "Pond dashboard")
    shot(page, "dash")

    # Kere 1 overview: fish stock and value.
    goto(page, "/ponds/pond-1", "Fish growth")
    growth = page.locator("section", has=page.get_by_role("heading", name="Fish growth"))
    META["facts"]["growth"] = growth.first.inner_text()
    shot(page, "kere1_overview", *focus(page, growth))

    # 5 PM run: normal night, then cloudy hot night.
    goto(page, "/", "5 PM nightly forecast")
    nightly = page.locator("section", has=page.get_by_role("heading", name="5 PM nightly forecast"))
    run_btn = page.get_by_role("button", name=re.compile("Run tonight"))
    page.get_by_text("Normal night", exact=True).click()
    run_btn.click()
    page.get_by_text("No oxygen alerts needed tonight").first.wait_for(timeout=30000)
    page.wait_for_timeout(500)
    shot(page, "nightly_normal", *focus(page, nightly))

    page.get_by_text("Cloudy, hot night", exact=True).click()
    run_btn.click()
    note = page.get_by_text(re.compile(r"\d of \d ponds have a Watch or Danger"))
    note.first.wait_for(timeout=30000)
    page.wait_for_timeout(500)
    META["facts"]["nightly_cloudy"] = note.first.locator("xpath=ancestor::*[contains(@class,'notice') or self::div][1]").inner_text()
    shot(page, "nightly_cloudy", *focus(page, note.first.locator("xpath=..").locator("xpath=..")))
    k1 = nightly.locator("li", has=page.get_by_text("Kere 1", exact=True))
    shot(page, "nightly_cloudy_k1", *focus(page, k1, color="#D64545"))

    # Kere 1 forecast: curve, then factors and actions.
    goto(page, "/ponds/pond-1?tab=forecast", "Hourly risk curve")
    result = page.locator("section", has=page.locator("#result-h"))
    META["facts"]["forecast_result"] = result.first.inner_text()[:600]
    curve = page.locator("section", has=page.locator("#curve-h"))
    shot(page, "k1_curve", *focus(page, curve, color="#D64545"))
    actions = page.locator("section", has=page.locator("#actions-h"))
    META["facts"]["actions"] = actions.first.inner_text()
    shot(page, "k1_actions", *focus(page, actions))
    factors = page.locator("section", has=page.locator("#factors-h"))
    shot(page, "k1_factors", *focus(page, factors))

    # Alert centre: simulate WhatsApp delivery of the Kere 1 danger alert, then show the voice channel.
    goto(page, "/alerts", "Low-oxygen danger — Kere 1")
    page.get_by_text("Low-oxygen danger — Kere 1").first.click()
    page.get_by_text("Send to farmer").first.wait_for(timeout=30000)
    prep(page)
    page.get_by_role("button", name=re.compile("Simulate send via WhatsApp")).click()
    delivered = page.get_by_text(re.compile("Simulated delivered"))
    delivered.first.wait_for(timeout=30000)
    page.wait_for_timeout(400)
    shot(page, "alert_sent", *focus(page, delivered.first.locator("xpath=ancestor::*[contains(@class,'notice')][1]")))
    page.locator("label", has_text=re.compile(r"^\s*Voice")).first.click()
    vnote = page.get_by_text("A voice call would read the Kannada text")
    vnote.first.wait_for(timeout=10000)
    shot(page, "alert_voice", *focus(page, vnote))


def farmer_steps(page: Page) -> None:
    def english() -> None:
        lang = page.locator("div[lang]").first.get_attribute("lang")
        if lang == "kn":
            page.locator("header button").first.click()
            page.wait_for_timeout(600)

    page.goto(BASE + "/farmer/pond-1", wait_until="networkidle")
    page.wait_for_timeout(1500)
    prep(page)
    english()
    shot(page, "farmer_k1_top")
    morning = page.locator("section", has=page.locator("#farmer-morning"))
    shot(page, "farmer_k1_morning", *focus(page, morning))
    morning.get_by_role("button", name=re.compile("Fine")).click()
    page.get_by_text("Thank you! Your answer is saved.").first.wait_for(timeout=10000)
    shot(page, "farmer_k1_thanks", *focus(page, morning))

    page.goto(BASE + "/farmer/pond-5", wait_until="networkidle")
    page.wait_for_timeout(1500)
    prep(page)
    english()
    report = page.locator("section", has=page.locator("#farmer-report"))
    report.get_by_role("button", name=re.compile("Red spots or sores")).click()
    shot(page, "farmer_abdul_pick", *focus(page, report, color="#D64545"))
    report.get_by_role("button", name="Send", exact=True).click()
    page.get_by_text(re.compile("We got your report")).first.wait_for(timeout=10000)
    page.wait_for_timeout(400)
    META["facts"]["abdul_result"] = report.first.inner_text()
    shot(page, "farmer_abdul_sent", *focus(page, report))


def desktop_after(page: Page) -> None:
    goto(page, "/cooperative", "Outbreak map")
    mapcard = page.locator("section", has=page.locator("#map-h"))
    mapcard.first.evaluate("e => e.scrollIntoView({block: 'start'})")
    page.wait_for_timeout(500)
    # Zoom towards Canal C (Padubidri / Mulki), no box: the red dashed canal is the highlight.
    b = page.locator("svg text", has_text="Mulki").first.bounding_box()
    vw, vh = page.viewport_size["width"], page.viewport_size["height"]
    shot(page, "coop_map", b["x"] / vw, (b["y"] - 40) / vh)

    goto(page, "/approach", "ML correction layer")
    page.get_by_role("button", name=re.compile("ML correction layer")).first.click()
    ml = page.get_by_text(re.compile("Trained and tested"))
    ml.first.wait_for(timeout=15000)
    page.wait_for_timeout(400)
    META["facts"]["approach_ml"] = ml.first.inner_text()
    shot(page, "approach_ml", *focus(page, ml.first.locator("xpath=..")))

    goto(page, "/models", "Test results")
    acc = page.locator("tr", has=page.get_by_text("Accuracy", exact=True)).first
    META["facts"]["models_acc"] = acc.inner_text()
    shot(page, "models_wq", *focus(page, acc, color="#D64545", pad=6))
    samples = page.get_by_text("Model predictions on test samples").first.locator("xpath=..")
    shot(page, "models_samples", *focus(page, samples))
    fig = page.locator("figure").first
    META["facts"]["models_fig"] = fig.inner_text()
    shot(page, "models_ox", *focus(page, fig))

    goto(page, "/", "Pond dashboard")
    shot(page, "dash_end")


with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True)
    desk = browser.new_context(viewport={"width": 1536, "height": 864}, device_scale_factor=1.25)
    page = desk.new_page()
    desktop_steps(page)
    state = desk.storage_state()
    desk.close()

    mob = browser.new_context(viewport={"width": 412, "height": 880}, device_scale_factor=2, is_mobile=True, has_touch=True, storage_state=state)
    page = mob.new_page()
    farmer_steps(page)
    state = mob.storage_state()
    mob.close()

    desk = browser.new_context(viewport={"width": 1536, "height": 864}, device_scale_factor=1.25, storage_state=state)
    page = desk.new_page()
    desktop_after(page)
    desk.close()
    browser.close()

(OUT / "meta.json").write_text(json.dumps(META, indent=2, ensure_ascii=False), encoding="utf-8")
print("done")
