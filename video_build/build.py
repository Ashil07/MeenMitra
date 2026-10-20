"""Build the MeenMitra rough cut: voices (edge-tts), frames (HTML via headless Chrome), video (ffmpeg).

Usage: .venv/Scripts/python build.py        (run capture.py first)
Output: ../video/meenmitra_rough_cut.mp4 and ../video/meenmitra_rough_cut.srt
"""

import asyncio
import base64
import hashlib
import html
import json
import re
import subprocess
from pathlib import Path

import edge_tts
import imageio_ffmpeg
from playwright.sync_api import sync_playwright

from beats import BEATS, DISCLAIMER, PLACEHOLDERS, V_EN, V_KN

ROOT = Path(__file__).parent
SHOTS = ROOT / "out" / "shots"
AUD = ROOT / "out" / "audio"
FRM = ROOT / "out" / "frames"
CLP = ROOT / "out" / "clips"
FINAL_DIR = ROOT.parent / "video"
for d in (AUD, FRM, CLP, FINAL_DIR):
    d.mkdir(parents=True, exist_ok=True)

FF = imageio_ffmpeg.get_ffmpeg_exe()
FPS = 30
META = json.loads((SHOTS / "meta.json").read_text(encoding="utf-8"))


def ff(*args: str) -> None:
    r = subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-y", *args], capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr[-3000:])


def duration(path: Path) -> float:
    r = subprocess.run([FF, "-hide_banner", "-i", str(path)], capture_output=True, text=True)
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr)
    return int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])


# ---------- 1. Voices ----------

async def _tts(text: str, voice: str, out: Path, rate: str) -> None:
    await edge_tts.Communicate(text, voice, rate=rate).save(str(out))


def voices() -> None:
    jobs = []
    for b in BEATS:
        if b.get("kn"):
            text, voice, rate = b["kn"], V_KN, "+0%"
        elif b.get("say"):
            text, voice, rate = b.get("tts", b["say"]), V_EN, "+10%"
        else:
            continue
        key = hashlib.sha1(f"{voice}|{rate}|{text}".encode()).hexdigest()[:10]
        out = AUD / f"{b['id']}_{key}.mp3"
        b["voice_file"] = out
        if not out.exists():
            jobs.append(_tts(text, voice, out, rate))

    async def run_all() -> None:
        sem = asyncio.Semaphore(4)

        async def one(j):
            async with sem:
                await j

        await asyncio.gather(*(one(j) for j in jobs))

    if jobs:
        asyncio.run(run_all())
    print(f"voices: {len(jobs)} generated")


# ---------- 2. Frames ----------

FONT = "'Segoe UI', 'Nirmala UI', system-ui, sans-serif"
SERIF = "Georgia, 'Times New Roman', serif"
KN_FONT = "'Nirmala UI', 'Noto Sans Kannada', sans-serif"
BRAND_SVG = (
    '<svg viewBox="0 0 24 24" fill="none" width="100%" height="100%">'
    '<path d="M3 12c3-4.2 9-5.2 13-2.2l5-3v10.4l-5-3c-4 3-10 2-13-2.2Z" fill="#fff" fill-opacity=".95"/>'
    '<circle cx="13.6" cy="11" r="1" fill="#0e4a43"/>'
    '<path d="M2 19.5c1.7 0 1.7-1.2 3.4-1.2s1.7 1.2 3.4 1.2 1.7-1.2 3.4-1.2 1.7 1.2 3.4 1.2 1.7-1.2 3.4-1.2" stroke="#d7efe9" stroke-width="1.4" stroke-linecap="round"/></svg>'
)


def data_uri(p: Path) -> str:
    return "data:image/png;base64," + base64.b64encode(p.read_bytes()).decode()


def page_html(body: str, bg: str = "transparent") -> str:
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
    *{{box-sizing:border-box;margin:0;padding:0}}
    html,body{{width:1920px;height:1080px;overflow:hidden;background:{bg};font-family:{FONT};}}
    </style></head><body>{body}</body></html>"""


SKIES = {
    "dusk": ("#f6a35c", "#c85a3a", "#3b2a4a", "#e9b26b"),
    "golden": ("#f8c77a", "#e08a4a", "#5a3b3a", "#f1c27d"),
    "evening": ("#e7a06a", "#8c5a6e", "#2c2a48", "#d9a070"),
    "night": ("#1c2a48", "#0d1528", "#05080f", "#2a3a5c"),
    "predawn": ("#2b4a78", "#152647", "#0a1224", "#3d5f8f"),
    "dawn_grey": ("#c9cdd2", "#9aa3ab", "#4b545c", "#b7bec4"),
    "sunrise": ("#ffd1a8", "#f59e8b", "#7a5a6e", "#ffc59a"),
}


def placeholder_html(key: str) -> str:
    mood, title, desc = PLACEHOLDERS[key]
    top, mid, ground, water = SKIES[mood]
    dark = mood in ("night", "predawn")
    sun = "" if dark else f'<circle cx="1600" cy="590" r="56" fill="#fff3d6" opacity="{0.35 if mood == "dawn_grey" else 0.85}"/>'
    moon = '<circle cx="1500" cy="200" r="38" fill="#e8eef8" opacity=".5"/>' if mood == "predawn" else ""
    palms = "".join(
        f'<g transform="translate({x},{y}) scale({s})" fill="{ground}"><rect x="-6" y="0" width="12" height="260" rx="6" transform="rotate({r})"/>'
        f'<path d="M0 0 C -90 -30 -150 10 -190 60 C -120 20 -60 20 0 10 Z"/><path d="M0 0 C 90 -30 150 10 190 60 C 120 20 60 20 0 10 Z"/>'
        f'<path d="M0 0 C -40 -80 -110 -100 -170 -80 C -100 -60 -40 -40 0 5 Z"/><path d="M0 0 C 40 -80 110 -100 170 -80 C 100 -60 40 -40 0 5 Z"/></g>'
        for x, y, s, r in ((260, 420, 1.0, 4), (420, 470, 0.8, -3), (1650, 430, 0.95, -5))
    )
    svg = f"""<svg width="1920" height="1080" viewBox="0 0 1920 1080" style="position:absolute;inset:0">
      <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{top}"/><stop offset=".62" stop-color="{mid}"/></linearGradient>
      <linearGradient id="wat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{water}" stop-opacity=".55"/><stop offset="1" stop-color="{ground}" stop-opacity=".9"/></linearGradient></defs>
      <rect width="1920" height="1080" fill="url(#sky)"/>{sun}{moon}
      <path d="M0 640 L1920 610 L1920 1080 L0 1080 Z" fill="{ground}"/>
      <ellipse cx="960" cy="800" rx="720" ry="150" fill="url(#wat)"/>
      <ellipse cx="960" cy="800" rx="720" ry="150" fill="none" stroke="{water}" stroke-opacity=".35" stroke-width="3"/>
      {palms}
      <rect width="1920" height="1080" fill="#000" opacity="{0.35 if dark else 0.28}"/>
    </svg>"""
    return page_html(f"""{svg}
      <div style="position:absolute;inset:36px;border:3px dashed rgba(255,255,255,.55);border-radius:28px"></div>
      <div style="position:absolute;left:80px;top:72px;background:rgba(0,0,0,.45);color:#fff;padding:12px 22px;border-radius:999px;font:700 26px {FONT};letter-spacing:.06em">
        AI SCENE {key} · PLACEHOLDER</div>
      <div style="position:absolute;left:0;right:0;top:330px;text-align:center;color:#fff;text-shadow:0 3px 18px rgba(0,0,0,.6)">
        <div style="font:600 64px {SERIF};padding:0 160px">{html.escape(title)}</div>
        <div style="font:400 32px {FONT};margin-top:22px;opacity:.92">{html.escape(desc)}</div>
        <div style="font:400 24px {FONT};margin-top:30px;opacity:.75">Replace with the generated clip · ai_video_prompts.md → Clip {key[0]}</div>
      </div>""")


def phone_frame(inner: str, w: int = 470, h: int = 960, dark: bool = False) -> str:
    return f"""<div style="width:{w + 28}px;height:{h + 28}px;border-radius:64px;background:#111;padding:14px;box-shadow:0 30px 80px rgba(0,0,0,.35)">
      <div style="width:{w}px;height:{h}px;border-radius:52px;overflow:hidden;position:relative;background:{'#0b1512' if dark else '#fff'}">{inner}</div></div>"""


def phone_html(shot_id: str, side: tuple[str, str]) -> str:
    img = data_uri(SHOTS / f"{shot_id}.png")
    inner = f'<img src="{img}" style="width:100%;height:100%;object-fit:cover;object-position:top">'
    return page_html(f"""
      <div style="position:absolute;inset:0;background:radial-gradient(circle at 30% 40%,#ffffff 0,#f5f1e8 55%,#e8e0cf 100%)"></div>
      <div style="position:absolute;left:330px;top:46px">{phone_frame(inner)}</div>
      <div style="position:absolute;left:960px;top:300px;width:820px">
        <div style="display:flex;align-items:center;gap:18px"><div style="width:64px;height:64px;border-radius:18px;background:#0e4a43;padding:12px">{BRAND_SVG}</div>
        <div style="font:700 26px {FONT};color:#17675c;letter-spacing:.08em;text-transform:uppercase">{html.escape(side[0])}</div></div>
        <div style="font:600 58px {SERIF};color:#12241f;margin-top:26px;line-height:1.15">{html.escape(side[1])}</div>
      </div>""")


KN_MSG = """ಅಪಾಯ: ಇಂದು ರಾತ್ರಿ "Kere 1" ಕೊಳದಲ್ಲಿ ಆಮ್ಲಜನಕ ಬೆಳಿಗ್ಗೆ 6 ಗಂಟೆ ಸುಮಾರಿಗೆ ತುಂಬಾ ಕಡಿಮೆಯಾಗಬಹುದು.
ಸುಮಾರು ₹1,77,000 ಮೌಲ್ಯದ ಮೀನುಗಳು ಅಪಾಯದಲ್ಲಿವೆ.
ಹೀಗೆ ಮಾಡಿ:
• ಇಂದು ಸಂಜೆ ಮೀನುಗಳಿಗೆ ಆಹಾರ ಹಾಕಬೇಡಿ
• ಬೆಳಗಿನ ಜಾವ 5 ಗಂಟೆಗೆ ಏರೇಟರ್ ಆನ್ ಮಾಡಿ
1 ಎಂದು ಉತ್ತರಿಸಿ = ಸರಿ, ಮಾಡುತ್ತೇನೆ"""
EN_MSG = """DANGER tonight for your pond "Kere 1". Oxygen may fall too low around 6 AM.
Fish worth about ₹1,77,000 are at risk.
Do this:
• Don't feed the fish this evening
• Start the aerator at 5 AM
Reply 1 = OK, will do"""


def chat_html(stage: str) -> str:
    def bubble(text: str, out: bool, time: str, kn: bool = False) -> str:
        ticks = ' <span style="color:#3b9ae1">✓✓</span>' if out else ""
        return f"""<div style="display:flex;justify-content:{'flex-end' if out else 'flex-start'};margin:10px 14px">
          <div style="max-width:86%;background:{'#d6f5cf' if out else '#fff'};border-radius:16px;padding:12px 14px 8px;box-shadow:0 1px 1px rgba(0,0,0,.12);
            font:{'400 19px' if kn else '400 19px'} {KN_FONT if kn else FONT};color:#13221d;white-space:pre-wrap;line-height:1.45">{html.escape(text)}
            <div style="text-align:right;font:400 13px {FONT};color:#6b7a75;margin-top:4px">{time}{ticks}</div></div></div>"""

    msgs = bubble(KN_MSG, False, "5:00 PM", kn=True)
    if stage == "b":
        msgs += bubble("1", True, "5:02 PM") + bubble("ಧನ್ಯವಾದ! ನಿಮ್ಮ ಉತ್ತರ ದಾಖಲಾಗಿದೆ.", False, "5:02 PM", kn=True)
    inner = f"""<div style="height:100%;display:flex;flex-direction:column;background:#ece5da">
      <div style="background:#1f5f52;color:#fff;padding:54px 18px 14px;display:flex;align-items:center;gap:12px">
        <div style="width:46px;height:46px;border-radius:50%;background:#0e4a43;padding:8px">{BRAND_SVG}</div>
        <div><div style="font:700 21px {FONT}">MeenMitra</div><div style="font:400 14px {FONT};opacity:.8">Pond alerts · demo</div></div></div>
      <div style="flex:1;padding-top:10px;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-start">{msgs}</div>
      <div style="background:#f6f2ec;padding:12px 14px 30px;display:flex;gap:10px"><div style="flex:1;background:#fff;border-radius:22px;height:44px"></div>
        <div style="width:44px;height:44px;border-radius:50%;background:#1f5f52"></div></div></div>"""
    en = html.escape(EN_MSG)
    return page_html(f"""
      <div style="position:absolute;inset:0;background:linear-gradient(135deg,#f5f1e8,#e3dccb)"></div>
      <div style="position:absolute;left:300px;top:46px">{phone_frame(inner)}</div>
      <div style="position:absolute;left:930px;top:190px;width:860px">
        <div style="font:700 24px {FONT};color:#17675c;letter-spacing:.08em;text-transform:uppercase">English version of the same message</div>
        <div style="margin-top:20px;background:#fff;border-left:8px solid #a8231b;border-radius:18px;padding:28px 32px;font:500 30px {FONT};color:#12241f;white-space:pre-wrap;line-height:1.45;box-shadow:0 12px 40px rgba(0,0,0,.08)">{en}</div>
        <div style="margin-top:18px;font:400 22px {FONT};color:#3d4d48">Exact text generated by the MeenMitra demo for Kere 1 on a cloudy, hot night.</div>
      </div>""")


def call_html(stage: str) -> str:
    live = stage == "live"
    inner = f"""<div style="height:100%;background:linear-gradient(180deg,#123a35,#081512);color:#fff;text-align:center;padding-top:150px;font-family:{FONT}">
      <div style="font:400 22px {FONT};opacity:.75">{'Urgent call · 00:0' + '7' if live else 'Incoming call…'}</div>
      <div style="width:150px;height:150px;border-radius:50%;background:#0e4a43;margin:40px auto 26px;padding:30px;box-shadow:0 0 0 {'0' if live else '18px'} rgba(23,103,92,.35)">{BRAND_SVG}</div>
      <div style="font:700 40px {FONT}">MeenMitra</div>
      <div style="font:400 22px {FONT};opacity:.8;margin-top:8px">Danger alert · Kere 1</div>
      <div style="position:absolute;bottom:110px;left:0;right:0;display:flex;justify-content:center;gap:{'0' if live else '150px'}">
        {'' if live else '<div style="width:86px;height:86px;border-radius:50%;background:#2e9e5b"></div>'}
        <div style="width:86px;height:86px;border-radius:50%;background:#d8443a"></div></div></div>"""
    return page_html(f"""
      <div style="position:absolute;inset:0;background:radial-gradient(circle at 30% 45%,#1b2f4f,#070c18 70%)"></div>
      <div style="position:absolute;left:300px;top:46px">{phone_frame(inner, dark=True)}</div>
      <div style="position:absolute;left:930px;top:300px;width:860px;color:#fff">
        <div style="font:700 24px {FONT};color:#8fd3c4;letter-spacing:.08em;text-transform:uppercase">Danger ponds only</div>
        <div style="font:600 60px {SERIF};margin-top:20px;line-height:1.15">A voice call just before the 5 AM aerator time</div>
        <div style="font:400 28px {FONT};margin-top:22px;opacity:.85">Read aloud in Kannada. The farmer presses 1 to confirm.</div>
      </div>""")


def logo_html() -> str:
    return page_html(f"""
      <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 40%,#17675c,#0e4a43 55%,#082e2a)"></div>
      <div style="position:absolute;left:0;right:0;top:330px;text-align:center;color:#f2faf7">
        <div style="width:150px;height:150px;border-radius:40px;background:rgba(255,255,255,.12);margin:0 auto;padding:28px">{BRAND_SVG}</div>
        <div style="font:600 110px {SERIF};margin-top:34px">MeenMitra</div>
        <div style="font:400 36px {KN_FONT};opacity:.85;margin-top:6px">ಮೀನ್‌ಮಿತ್ರ · Fish Friend</div>
        <div style="font:400 32px {FONT};opacity:.85;margin-top:26px">Overnight oxygen warnings for small fish farms in coastal Karnataka</div>
      </div>""")


def end_html() -> str:
    return page_html(f"""
      <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 40%,#17675c,#0e4a43 55%,#082e2a)"></div>
      <div style="position:absolute;left:0;right:0;top:250px;text-align:center;color:#f2faf7">
        <div style="width:130px;height:130px;border-radius:36px;background:rgba(255,255,255,.12);margin:0 auto;padding:24px">{BRAND_SVG}</div>
        <div style="font:600 96px {SERIF};margin-top:28px">MeenMitra</div>
        <div style="font:italic 400 44px {SERIF};margin-top:18px">A 5 PM check that can make a difference before dawn.</div>
        <div style="font:400 28px {FONT};opacity:.8;margin-top:40px">Built for small fish farmers in coastal Karnataka · Team MeenMitra</div>
        <div style="display:inline-block;margin-top:26px;border:2px solid rgba(255,255,255,.5);border-radius:999px;padding:10px 26px;font:600 24px {FONT}">Prototype · demo data · field trials next</div>
      </div>""")


def overlay_html(b: dict) -> str:
    parts = []
    if b.get("disc"):
        parts.append(f"""<div style="position:absolute;left:32px;top:26px;max-width:860px;background:rgba(18,36,31,.86);color:#fff;border-left:6px solid #e9c87d;
          border-radius:10px;padding:12px 18px;font:500 21px {FONT};line-height:1.35">{html.escape(DISCLAIMER)}</div>""")
    right = []
    if b.get("concept"):
        right.append(f'<div style="background:#e9a800;color:#1b1400;border-radius:999px;padding:10px 22px;font:800 24px {FONT}">CONCEPT — PLANNED FEATURE</div>')
    if b.get("ts"):
        right.append(f'<div style="background:rgba(18,36,31,.86);color:#fff;border-radius:999px;padding:10px 24px;font:700 34px {FONT}">🕔 {b["ts"]}</div>')
    if right:
        parts.append(f'<div style="position:absolute;right:32px;top:26px;display:flex;flex-direction:column;align-items:flex-end;gap:12px">{"".join(right)}</div>')
    if b.get("lower"):
        parts.append(f"""<div style="position:absolute;left:60px;bottom:170px;background:#0e4a43;color:#fff;border-radius:12px;padding:14px 26px;font:700 32px {FONT};
          box-shadow:0 10px 30px rgba(0,0,0,.25)">{html.escape(b["lower"])}</div>""")
    if b.get("label"):
        t, x, y = b["label"]
        parts.append(f"""<div style="position:absolute;left:{int(x * 1920)}px;top:{int(y * 1080)}px;background:#a8231b;color:#fff;border-radius:10px;padding:10px 18px;
          font:700 28px {FONT};box-shadow:0 8px 24px rgba(0,0,0,.25)">{html.escape(t)}</div>""")
    if b.get("title"):
        parts.append(f"""<div style="position:absolute;left:0;right:0;top:150px;text-align:center;color:#fff;font:600 72px {SERIF};text-shadow:0 4px 24px rgba(0,0,0,.7)">
          {html.escape(b["title"])}</div>""")
    if b.get("kn"):
        parts.append(f"""<div style="position:absolute;left:50%;transform:translateX(-50%);bottom:40px;width:1600px;text-align:center">
          <div style="display:inline-block;background:rgba(0,0,0,.66);border-radius:12px;padding:14px 26px">
          <div style="font:500 30px {KN_FONT};color:#fff;line-height:1.4">{html.escape(b["kn"])}</div>
          <div style="font:600 34px {FONT};color:#ffd84d;line-height:1.35;margin-top:6px">{html.escape(b["say"])}</div></div></div>""")
    elif b.get("say"):
        parts.append(f"""<div style="position:absolute;left:50%;transform:translateX(-50%);bottom:40px;width:1640px;text-align:center">
          <div style="display:inline-block;background:rgba(0,0,0,.66);border-radius:12px;padding:12px 26px;font:600 36px {FONT};color:#fff;line-height:1.35">
          {html.escape(b["say"])}</div></div>""")
    return page_html("".join(parts))


def frames() -> None:
    with sync_playwright() as p:
        br = p.chromium.launch(channel="chrome", headless=True)
        pg = br.new_page(viewport={"width": 1920, "height": 1080})
        made: set[str] = set()

        def render(name: str, markup: str, transparent: bool = False) -> Path:
            out = FRM / f"{name}.png"
            if name not in made:
                pg.set_content(markup, wait_until="load")
                pg.wait_for_timeout(150)
                pg.screenshot(path=str(out), omit_background=transparent)
                made.add(name)
            return out

        for b in BEATS:
            kind, _, arg = b["vis"].partition(":")
            if kind == "shot":
                b["bg"] = SHOTS / f"{arg}.png"
                f = META["shots"][arg]
                b["focus"] = (f["fx"], f["fy"], 0.07 if arg not in ("dash", "dash_end") else 0.04)
            elif kind == "phone":
                b["bg"] = render(f"phone_{arg}", phone_html(arg, b["side"]))
                b["focus"] = (0.5, 0.5, 0.025)
            elif kind == "ph":
                b["bg"] = render(f"ph_{arg}", placeholder_html(arg))
                b["focus"] = (0.5, 0.55, 0.05)
            elif kind == "chat":
                b["bg"] = render(f"chat_{arg}", chat_html(arg))
                b["focus"] = (0.35, 0.5, 0.03)
            elif kind == "call":
                b["bg"] = render(f"call_{arg}", call_html(arg))
                b["focus"] = (0.35, 0.5, 0.03)
            elif kind in ("logo", "end"):
                b["bg"] = render(kind, logo_html() if kind == "logo" else end_html())
                b["focus"] = (0.5, 0.45, 0.04)
            b["ov"] = render(f"ov_{b['id']}", overlay_html(b), transparent=True)
        br.close()
    print("frames: done")


# ---------- 3. Sound effects ----------

SFX = {
    "ding": ("0.32*sin(2*PI*1318*t)*exp(-7*t)+0.28*sin(2*PI*1760*t)*exp(-7*(t-0.13))*gte(t,0.13)", 0.9),
    "ring": ("0.16*(sin(2*PI*400*t)+sin(2*PI*450*t))*sin(2*PI*25*t)*(lt(mod(t,2),0.4)+gt(mod(t,2),0.6)*lt(mod(t,2),1.0))", 2.4),
    "dtmf": ("0.25*(sin(2*PI*697*t)+sin(2*PI*1209*t))", 0.18),
}


def sfx() -> dict[str, Path]:
    out = {}
    for k, (expr, d) in SFX.items():
        p = AUD / f"sfx_{k}.wav"
        if not p.exists():
            ff("-f", "lavfi", "-i", f"aevalsrc=exprs='{expr}':s=48000:d={d}", "-ac", "2", str(p))
        out[k] = p
    return out


# ---------- 4. Clips ----------

def build_clip(b: dict, fx_files: dict[str, Path]) -> Path:
    lead = 0.15
    vdur = duration(b["voice_file"]) if b.get("voice_file") else 0.0
    pad = b.get("pad", 0.3)
    dur = max(b.get("min", 1.5), lead + vdur + pad)
    b["dur"] = dur
    b["voice_dur"] = vdur
    n = round(dur * FPS)

    inputs, chains = [], []
    if b.get("voice_file"):
        inputs.append(str(b["voice_file"]))
        filt = "highpass=f=300,lowpass=f=3400,volume=1.6," if b.get("kn") else ""
        chains.append(f"[{len(inputs) - 1}:a]{filt}aresample=48000,aformat=channel_layouts=stereo,adelay={int(lead * 1000)}:all=1[a{len(inputs) - 1}]")
    for kind, at in b.get("fx", []):
        inputs.append(str(fx_files[kind]))
        chains.append(f"[{len(inputs) - 1}:a]adelay={int(at * 1000)}:all=1[a{len(inputs) - 1}]")
    for kind, after in b.get("tail_fx", []):
        inputs.append(str(fx_files[kind]))
        chains.append(f"[{len(inputs) - 1}:a]adelay={int((lead + vdur + after) * 1000)}:all=1[a{len(inputs) - 1}]")

    wav = CLP / f"{b['id']}.wav"
    if inputs:
        args = []
        for i in inputs:
            args += ["-i", i]
        mix = "".join(f"[a{i}]" for i in range(len(inputs)))
        graph = ";".join(chains) + f";{mix}amix=inputs={len(inputs)}:normalize=0,apad,atrim=0:{dur:.3f}[out]"
        ff(*args, "-filter_complex", graph, "-map", "[out]", "-ar", "48000", "-ac", "2", str(wav))
    else:
        ff("-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", f"{dur:.3f}", str(wav))

    fx_, fy_, z = b["focus"]
    vf = (
        f"[0:v]scale=3840:2160,zoompan=z='1+{z}*on/{n}':x='(iw-iw/zoom)*{fx_}':y='(ih-ih/zoom)*{fy_}':d={n}:s=1920x1080:fps={FPS},setsar=1[bg];"
        f"[bg][1:v]overlay=0:0,format=yuv420p[v]"
    )
    out = CLP / f"{b['id']}.mp4"
    ff("-i", str(b["bg"]), "-i", str(b["ov"]), "-i", str(wav), "-filter_complex", vf, "-map", "[v]", "-map", "2:a",
       "-frames:v", str(n), "-r", str(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "19",
       "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-shortest", str(out))
    return out


def srt_time(t: float) -> str:
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"


def assemble() -> None:
    fx_files = sfx()
    clips = []
    for b in BEATS:
        clips.append(build_clip(b, fx_files))
        print(f"clip {b['id']} {b['dur']:.1f}s", flush=True)

    lst = CLP / "list.txt"
    lst.write_text("".join(f"file '{c.as_posix()}'\n" for c in clips), encoding="utf-8")
    joined = CLP / "joined.mp4"
    ff("-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(joined))
    total = duration(joined)

    final = FINAL_DIR / "meenmitra_rough_cut.mp4"
    ff("-i", str(joined), "-vf", f"fade=t=in:st=0:d=0.8,fade=t=out:st={total - 1.2:.2f}:d=1.2",
       "-af", f"loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,afade=t=in:st=0:d=0.4,afade=t=out:st={total - 1.2:.2f}:d=1.2",
       "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
       "-movflags", "+faststart", str(final))

    # Captions and a timeline, for the real edit.
    t, srt, timeline, i = 0.0, [], [], 1
    for b in BEATS:
        if b.get("seg"):
            timeline.append(f"{int(t // 60)}:{t % 60:05.2f}  {b['seg']}")
        if b.get("say"):
            text = (b["kn"] + "\n" + b["say"]) if b.get("kn") else b["say"]
            srt.append(f"{i}\n{srt_time(t + 0.15)} --> {srt_time(t + 0.15 + b['voice_dur'])}\n{text}\n")
            i += 1
        t += b["dur"]
    (FINAL_DIR / "meenmitra_rough_cut.srt").write_text("\n".join(srt), encoding="utf-8")
    print("\n".join(timeline))
    print(f"TOTAL {total:.1f}s -> {final}")


if __name__ == "__main__":
    voices()
    frames()
    assemble()
