# MeenMitra — AI video prompts

These prompts are for the AI-generated clips in the 4-minute demo video: the opening, WhatsApp videos 1 and 2, and the warning call. The workflow and the run sheet are in [demo_video_workflow.md](demo_video_workflow.md).

Every MeenMitra message below is exactly what the app generates in demo mode for **Kere 1** under **"Cloudy, hot night"**, the scenario the script uses. I checked it in the running app on 20 Oct:
- Kere 1 is at **Danger**.
- Lowest oxygen is about **6 AM**.
- The aerator should start by **5 AM**.
- About **₹1,77,000** of fish are at risk.

## Rules for every clip

- **Phone screens:** ask for a phone with a plain glowing screen and no text. Then lay the real chat over it in the editor. Video tools garble text, and Kannada most of all.
- **No real logos:** describe a "green messaging app", not WhatsApp.
- **Voices:** the video tool's voices can't say Kannada. Make the call audio separately with a Kannada (kn-IN) text-to-speech voice.
- **Same farmer in every clip.** Paste this character sheet into every shot:
  > Ramesh, a fish farmer in his mid-40s from coastal Karnataka, India. Lean build, sun-tanned skin, short black hair with some grey, thin moustache. He wears a faded checked half-sleeve shirt and a folded white mundu (lungi), with a small towel over one shoulder. He has a basic Android phone.
- **Place:** a small rectangular earthen fish pond in Brahmavar, Udupi district, with coconut palms, paddy fields, a red-tiled house and a paddle-wheel aerator at the pond edge.
- **Negative prompt:**
  ```
  readable text, logos, brand names, burned-in subtitles, distorted hands, extra fingers, apple logo, western farm, snow, cartoon, oversaturated, piles of dead fish, gore
  ```

---

## Clip 0 — Opening (0:00–0:20, three shots of about 6 s each)

**0A — The farmer at dusk**

> Cinematic wide shot at dusk. [Place] [Character sheet] Ramesh stands on the earthen bund and scatters fish feed by hand; the fish ripple the green water. Warm orange sky, coconut palms in silhouette, humid haze. Slow dolly in, 35mm, realistic documentary style.

**0B — Night falls**

> The same pond at night under thick, heavy clouds, with no moon. The water is still and black and the air is hot and humid. The house light is off: the family is asleep. A slow push in over the water, with low, quiet tension. Realistic low-light cinematography.

**0C — Morning shock (no gore)**

> Early morning, grey light. [Character sheet] Ramesh walks to the pond with a cup of tea, stops, and stares at the water, worried. He puts the cup down. We see only his face and the rippling surface, not dead fish. Handheld, realistic, sombre.

---

## Clip 1 — WhatsApp Video 1: the 5 PM alert (1:30–1:50)

### Messages to lay over the phone screen

**1. MeenMitra, 5:00 PM**

```
ಅಪಾಯ: ಇಂದು ರಾತ್ರಿ "Kere 1" ಕೊಳದಲ್ಲಿ ಆಮ್ಲಜನಕ ಬೆಳಿಗ್ಗೆ 6 ಗಂಟೆ ಸುಮಾರಿಗೆ ತುಂಬಾ ಕಡಿಮೆಯಾಗಬಹುದು.
ಸುಮಾರು ₹1,77,000 ಮೌಲ್ಯದ ಮೀನುಗಳು ಅಪಾಯದಲ್ಲಿವೆ.
ಹೀಗೆ ಮಾಡಿ:
• ಇಂದು ಸಂಜೆ ಮೀನುಗಳಿಗೆ ಆಹಾರ ಹಾಕಬೇಡಿ
• ಬೆಳಗಿನ ಜಾವ 5 ಗಂಟೆಗೆ ಏರೇಟರ್ ಆನ್ ಮಾಡಿ
1 ಎಂದು ಉತ್ತರಿಸಿ = ಸರಿ, ಮಾಡುತ್ತೇನೆ
```

English version (subtitle, or a second bubble):

```
DANGER tonight for your pond "Kere 1". Oxygen may fall too low around 6 AM.
Fish worth about ₹1,77,000 are at risk.
Do this:
• Don't feed the fish this evening
• Start the aerator at 5 AM
Reply 1 = OK, will do
```

**2. Ramesh, 5:02 PM:** `1`

**3. MeenMitra, 5:02 PM:** `ಧನ್ಯವಾದ! ನಿಮ್ಮ ಉತ್ತರ ದಾಖಲಾಗಿದೆ.` (Thank you! Your answer is saved.)

The best source for message 1 is a screenshot of the app itself: Alert centre → "Low-oxygen danger — Kere 1".

### Shots (about 6 s each)

**1A — Feeding time**

> Golden hour, 5 PM. [Place] [Character sheet] Ramesh walks along the bund with a sack of fish feed on his shoulder. His phone buzzes in his shirt pocket. He stops and puts the sack down. Handheld, 35mm, realistic.

**1B — Reading the alert (composite here)**

> Over-the-shoulder close-up of a weathered hand holding a basic Android phone. The screen shows a green messaging app with one long incoming chat bubble and a red warning icon. The screen is plain and bright with no legible text. The sunset pond is out of focus behind it. Slow push in.

**1C — The decision**

> Close-up. [Character sheet] Ramesh reads carefully, nods once, and taps a reply with his thumb. He looks at the feed sack and drags it back from the pond edge, deciding not to feed tonight. Golden light, calm but alert.

---

## Clip 2 — WhatsApp Video 2: follow-up questions (1:50–2:00)

**This feature is not in the MVP.** The app has no numbered menu and no free-text questions; the farmer can only reply "1". If you keep this clip, burn in the caption **"Concept — planned feature, not in the MVP"**, and lay the chat over it in the editor using these lines:

**Ramesh:** `ಏರೇಟರ್ ಇಲ್ಲದಿದ್ದರೆ ಏನು ಮಾಡಬೇಕು?` (What if I have no aerator?)

**MeenMitra (concept):** `ಏರೇಟರ್ ಇಲ್ಲದಿದ್ದರೆ, ನೆರೆಯವರಿಂದ ಏರೇಟರ್ ಅಥವಾ ಪಂಪ್ ವ್ಯವಸ್ಥೆ ಮಾಡಿ.` (No aerator? Arrange an aerator or pump from a neighbour.)

The MeenMitra answer is the app's own no-aerator advice.

> Close-up. [Character sheet] Ramesh sits on the steps of his house in the evening light and types a question slowly with one thumb. He waits, reads the reply and nods. Plain bright screen with no legible text. Realistic.

---

## Clip 3 — The warning call (2:00–2:15)

In the story, the call comes at **4:45 AM**, just before the 5 AM aerator time. That's when a sleeping farmer would miss a text. **Burn in this caption:** "Dramatization — voice alerts are simulated in the MVP."

### Call audio (Kannada TTS: calm, clear and slow)

The pond name and the amount are written in words so the TTS reads them correctly.

```
ನಮಸ್ಕಾರ. ಇದು ಮೀನ್‌ಮಿತ್ರದಿಂದ ಬಂದಿರುವ ತುರ್ತು ಕರೆ.
ಅಪಾಯ: ಕೆರೆ ಒಂದು ಕೊಳದಲ್ಲಿ ಆಮ್ಲಜನಕ ಬೆಳಿಗ್ಗೆ 6 ಗಂಟೆ ಸುಮಾರಿಗೆ ತುಂಬಾ ಕಡಿಮೆಯಾಗಬಹುದು.
ಸುಮಾರು ಒಂದು ಲಕ್ಷ ಎಪ್ಪತ್ತೇಳು ಸಾವಿರ ರೂಪಾಯಿ ಮೌಲ್ಯದ ಮೀನುಗಳು ಅಪಾಯದಲ್ಲಿವೆ.
ಹೀಗೆ ಮಾಡಿ: ಬೆಳಗಿನ ಜಾವ 5 ಗಂಟೆಗೆ ಏರೇಟರ್ ಆನ್ ಮಾಡಿ.
ಮೀನುಗಳು ಮೇಲ್ಮೈಯಲ್ಲಿ ಉಸಿರಿಗಾಗಿ ಒದ್ದಾಡಿದರೆ ಅಥವಾ ಸತ್ತರೆ, ಮೀನುಗಾರಿಕೆ ಅಧಿಕಾರಿಗೆ ತಿಳಿಸಿ.
ಸರಿ, ಮಾಡುತ್ತೇನೆ ಎಂದು ತಿಳಿಸಲು 1 ಒತ್ತಿ.
```

*[keypad beep]*

```
ಧನ್ಯವಾದ! ನಿಮ್ಮ ಉತ್ತರ ದಾಖಲಾಗಿದೆ.
```

**English subtitles:**

```
Hello. This is an urgent call from MeenMitra.
DANGER: oxygen in your pond "Kere 1" may fall too low around 6 AM.
Fish worth about ₹1,77,000 are at risk.
Do this: start the aerator at 5 AM.
If fish gasp at the surface or die, tell your fisheries officer.
Press 1 to say "OK, will do."
[beep]
Thank you! Your answer is saved.
```

The alert lines, the officer line and the thank-you are the app's own text. The greeting and "press 1" are the only lines added for a phone call. The Kannada is a draft that a native speaker hasn't reviewed; have someone check it before you record.

### Shots

**3A — Phone rings in the dark**

> Night, 4:45 AM, inside a simple bedroom in a village house. The only light is a basic Android phone ringing and vibrating on a wooden stool beside a mat. [Character sheet, sleeping] Ramesh wakes, squints and picks up the phone. Realistic low light, blue phone glow on his face.

**3B — Listening**

> Close-up. [Character sheet] Ramesh holds the phone to his ear, sits up and listens intently, becoming fully awake and serious. His lips do not move. He presses one key, then stands up. Low light, realistic.

**3C — Starting the aerator**

> Pre-dawn, 5 AM, deep blue sky, with mist over the pond. [Character sheet, with a headlamp] Ramesh walks fast along the bund and flips a switch on a weatherproof box. The paddle-wheel aerator starts and churns white foam across the dark water. Crickets, coconut palms in silhouette. Cinematic, realistic.

---

## Clip 4 — Morning (bridge into 2:15, optional, about 5 s)

> 7 AM, soft sunrise over the same pond. The aerator is still turning. Fish break the surface calmly; there are no dead fish. [Character sheet] Ramesh crouches at the edge with a cup of tea, smiles with relief, and takes out his phone. Peaceful, hopeful, realistic.

*Then cut to the screen recording of the farmer view's morning check-in.*
