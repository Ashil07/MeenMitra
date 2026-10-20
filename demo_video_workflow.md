# MeenMitra — 4-minute demo video: production workflow

**The steps, in order:**
1. Fix the script.
2. Set up.
3. Record the screens.
4. Generate the AI clips.
5. Record the audio.
6. Edit.
7. Check.

The AI clip prompts and every message text are in [ai_video_prompts.md](ai_video_prompts.md).

I checked the numbers below in the running app on 20 Oct (branch `feature/ppt-demo`, demo mode).

---

## Step 1 — Fix the script first (five changes)

| Segment | Problem | Change it to |
|---|---|---|
| 0:40–1:10 | "The ponds are currently marked Safe" isn't quite true: two ponds stay at Watch because of earlier water checks. | "On a normal night, the 5 PM forecast finds **no oxygen risk** in any pond." The run's result line says "No oxygen alerts needed tonight." |
| 0:40–1:10 | "Flags three ponds" | This is correct: "3 of 6 ponds have a Watch or Danger oxygen forecast tonight", with Kere 1 at Danger. You can add "about ₹5.47 lakh of fish in those ponds", which is on screen. |
| 1:30–2:15 | "Ask questions, choose from a numbered menu, type another question" — the MVP doesn't do this. The farmer can only reply 1. | Either cut it, or say "**In the full product**, he could also ask questions…" and show the caption "Concept — planned feature". |
| 1:30–2:15 | "If the risk becomes serious during the night… when Kere 1 reaches Danger" — the app doesn't re-check overnight. Kere 1 is already at Danger at 5 PM. | "Because Kere 1 is at **Danger**, MeenMitra can also **call** the farmer just before the 5 AM aerator time, when a text might be missed." |
| 3:05–3:30 | "As we collect real pond data, we can develop an ML correction layer" is now out of date: two models are trained and tested. | See the replacement text below. |

**New narration for 3:05–3:30** (every number is on the Data & models page):

> Behind MeenMitra is a physics-inspired model of how oxygen changes overnight, combined with weather, water-quality rules and farmer feedback, and each pond is calibrated from its own observations.
> We've also trained and tested two machine-learning models. A water-quality classifier, trained on a public aquaculture dataset, grades held-out samples with 99.4% accuracy. A next-hour oxygen model, trained on simulated pond data, cuts prediction error by about 60% compared with a simple baseline.
> They don't change the risk score yet. That needs real pond measurements, and our Data & models page shows exactly what's trained and what's still to do.

**Keep these checked phrases as they are:**
- "about 1,178 kg of fish, worth about ₹1.77 lakh" (shown in Kere 1's forecast)
- "lowest oxygen around 6 AM, start aerator by 5 AM"
- "Canal C is marked red" (only after you submit Abdul's report; see 3F below)

**One known catch:** the farmer view's danger step says "Run the aerator from evening until sunrise", but the WhatsApp message says "Start the aerator at 5 AM". Don't show both at once, or narrate "start the aerator early".

---

## Step 2 — Set up (once, about 15 minutes)

1. Check out the frontend on `feature/ppt-demo`, with `NEXT_PUBLIC_API_MODE=mock` in `.env.local`. Then run:
   ```bash
   npm run dev
   ```
2. **Browser:**
   - a fresh Chrome profile or a guest window, so there are no bookmarks, extensions or autofill
   - window 1920×1080, page zoom 110–125% so the text reads on a phone
   - light theme, notifications off
3. **Recorder:** OBS (or the Windows Snipping Tool's screen recording), 1080p at 30 fps, with the mouse cursor highlighted.
4. **Before every take,** click **Reset demo data** in the sidebar. The app saves its state in the browser, so an earlier run changes what you see.
5. Record a few seconds of the sidebar's **Demo mode** tag. The "Demo data" and "Simulated" labels must stay visible in the final cut.

---

## Step 3 — Screen recordings (run sheet)

Record each of these as a separate clip: they're easier to retime than one long take. Click slowly and pause 2 seconds on each result.

| Clip | For segment | Clicks | What must be on screen |
|---|---|---|---|
| **3A** | 0:20–0:40 | Dashboard, then scroll slowly; open **Ponds** and hover over Kere 1. | 6 ponds, Ramesh K., Kere 1 |
| **3B** | 0:40–0:55 | Dashboard → 5 PM nightly forecast → **Normal night** → **Run tonight's 5 PM forecast for all ponds** | "No oxygen alerts needed tonight" |
| **3C** | 0:55–1:10 | Pick **Cloudy, hot night** → **Run** again | Kere 1 at Danger, Hosa Kere and Temple Tank Pond at Watch, "3 of 6 ponds…", ₹5,47,000 |
| **3D** | 1:10–1:30 | **Open pond** (Kere 1) → hourly curve → risk factors → recommendations | The curve dips under the Danger line; lowest 2.98 mg/L around 6 AM; start aerator by 5 AM |
| **3E** | 1:30 (cut-in) | **Alert centre** → "Low-oxygen danger — Kere 1" → show the Kannada and English message → send by WhatsApp → the **Simulated · delivered** result | Message text, the **Simulated** tag, the masked phone number |
| **3E-2** | 2:00 (cut-in) | Same alert → choose the **Voice** channel | The line "A voice call would read the Kannada text…", which shows it's simulated |
| **3F** | 2:15–2:35 | **Farmer view** → Kere 1 → "How were your fish this morning?" → tap **Fine** → the thank-you | Morning check-in with three options |
| **3G** | 2:35–2:50 | **Farmer view** → Kodi Kere (Abdul) → "Problem with your fish?" → **Red spots or sores** → **Send** | "We got your report", "This is not a diagnosis", "Other ponds on your canal will be warned, without your name" |
| **3H** | 2:50–3:05 | **Cooperative** → outbreak map | Canal C red and dashed (Canal B is also red from earlier seed reports; don't point at it) |
| **3I** | 3:05–3:20 | **Approach** → click through the steps; open "ML correction layer" | "Trained and tested: … 60.6% …" |
| **3J** | 3:20–3:30 | **Data & models** → scroll the random forest card (samples, confusion matrix), then the oxygen chart | 99.4%, the prediction-vs-actual chart, the "Simulated (demo data)" label |
| **3K** | 3:30–3:45 | Back to the dashboard, with a slow zoom | — |

Record **3E** and **3F** in **one session without a reset**, because the alert must exist before you send it. Record **3G → 3H** together for the same reason.

**For the WhatsApp overlay:** take a sharp screenshot of the message in 3E (Win+Shift+S), zoomed to 150%.

---

## Step 4 — AI clips

Use one tool for every clip so the look matches: Veo 3, Kling 2.x, Runway Gen-4, Sora or Hailuo.

| Clip | Length | Prompts | Generations to make |
|---|---|---|---|
| Opening (0A–0C) | 3 × 6 s | ai_video_prompts.md, Clip 0 | 3–4 per shot; keep the most consistent face |
| WhatsApp Video 1 (1A–1C) | 3 × 6 s | Clip 1 | 3 per shot |
| WhatsApp Video 2 (optional) | 1 × 6 s | Clip 2 | 2 |
| Warning call (3A–3C) | 3 × 5 s | Clip 3 | 3 per shot |
| Morning bridge (optional) | 1 × 5 s | Clip 4 | 2 |

**Tips:**
- **Same face every time.** Make one still of Ramesh with an image tool (or take the best frame of shot 0A). Then generate every other clip *image-to-video* from that still.
- **Phone screens:** generate them blank, then in the editor track the screenshot onto the screen (CapCut's "Track" feature, or a corner pin in DaVinci Resolve or Premiere). Or cut to a full-screen phone mock-up, which is easier and reads better.
- **Speech:** mute every AI-generated voice.

---

## Step 5 — Audio

1. **Voiceover (English):**
   - Record it in one quiet room, phone or USB mic about 15 cm away, with a blanket behind you to deaden echo.
   - Read each segment on its own, so a mistake costs one segment.
   - Aim for about 140 words a minute. The script is about 520 words, which fits in 4:00 with pauses.
2. **Kannada call audio:**
   - Use the call script in Clip 3, read by a kn-IN TTS voice: Google Cloud TTS `kn-IN-Wavenet-A/B`, Microsoft Azure `kn-IN-SapnaNeural` / `kn-IN-GaganNeural`, or ElevenLabs.
   - Add a "phone line" effect: cut everything below 300 Hz and above 3,400 Hz.
   - Add a ring sound before it and a keypad beep after "1 ಒತ್ತಿ".
3. **Background sound:** quiet, royalty-free ambient music (YouTube Audio Library or Pixabay), ducked to about −20 dB under the voice. Add crickets for the night shots and birds for the morning.
4. **Optional:** a short WhatsApp-style notification "ding" from a royalty-free library. Don't use the real WhatsApp sound.

---

## Step 6 — Edit timeline

Free editors that work: CapCut desktop or DaVinci Resolve.

| Time | Video | Audio | On-screen text |
|---|---|---|---|
| 0:00–0:20 | AI 0A → 0B → 0C | VO "Imagine being…", ambient, crickets | — |
| 0:20–0:40 | Screen 3A | VO | Title card "MeenMitra" (2 s) |
| 0:40–1:10 | 3B → 3C | VO | Highlight the "3 of 6" result line |
| 1:10–1:30 | 3D | VO | Circle the Danger dip and "start aerator by 5 AM" |
| 1:30–1:50 | AI 1A–1C + chat overlay, then cut to 3E | VO, notification sound | English subtitle of the message; **"Dramatization — WhatsApp and voice alerts are simulated in this MVP. No real messages or calls are sent."** |
| 1:50–2:00 | AI Clip 2 (optional) | VO "In the full product…" | **"Concept — planned feature"** |
| 2:00–2:15 | AI 3A–3C, quick cut to 3E-2 | Ring, then the Kannada TTS with phone effect, beep, VO under it | English subtitles of the call; keep the disclaimer showing |
| 2:15–2:35 | AI Clip 4 (optional), then 3F | VO, birds | — |
| 2:35–3:05 | 3G → 3H | VO | "Possible signs — not a diagnosis" |
| 3:05–3:30 | 3I → 3J | New VO (step 1) | Highlight 99.4% and the oxygen chart; "Simulated data" stays visible |
| 3:30–4:00 | 3K → logo end card | VO closing, music swells | "MeenMitra — a five-PM check that can make a difference before dawn." |

**Captions:** burn in English subtitles for the whole voiceover. Judges often watch muted.

**Export:** 1080p, H.264, 30 fps, about 10–16 Mbps. Under 4:00 exactly; check the competition's limit.

---

## Step 7 — Final checks before submitting

- [ ] Every number in the voiceover matches the screen: 1,178 kg, ₹1.77 lakh, 3 of 6 ponds, 6 AM / 5 AM, 99.4%, about 60%.
- [ ] The simulated-delivery disclaimer shows on screen during both the WhatsApp clips and the call.
- [ ] The numbered menu and free-text questions are cut or captioned "Concept".
- [ ] The video never says "validated", "accurate forecast" or "saves your fish". It says "estimate", "warning" and "can help".
- [ ] Disease is "possible signs, not a diagnosis"; Abdul isn't named to other farmers.
- [ ] No real phone numbers appear (the app masks them; check any AI-made screens too).
- [ ] No WhatsApp logo or real brand marks appear in the AI clips.
- [ ] The Kannada TTS script was checked by a native speaker.
- [ ] Watch it once with the sound off and once on a phone.
