# MeenMitra rough-cut builder

This builds `../video/meenmitra_rough_cut.mp4` (about 4:00) and `../video/meenmitra_rough_cut.srt`. It uses:
- the real demo app (screens captured in headless Chrome)
- placeholder cards for the AI scenes
- a chat mock-up and call screens
- an en-IN narration voice and a kn-IN voice for the warning call (edge-tts)
- ffmpeg to put it all together

## Rebuild

1. Start the frontend in mock mode on http://localhost:3000 (branch `feature/ppt-demo`).
2. From this folder, capture the screens:
   ```bash
   .venv/Scripts/python capture.py
   ```
3. Then build the video:
   ```bash
   .venv/Scripts/python -u build.py
   ```

**What's cached:** voices are cached by their text in `out/audio`. To redo a graphic, delete its PNG in `out/frames`. Every clip is re-rendered on each build.

## What to change where

- **Narration, captions, timing, on-screen tags:** `beats.py`. Each beat is one visual held for its line.
- **Swapping in the real AI clips:** cut them in over the `AI SCENE … PLACEHOLDER` cards in your editor. The `.srt` and the timeline printed at the end of `build.py` show where each one goes.
- **Voices:** set `V_EN` and `V_KN` in `beats.py`. To use your own voiceover, mute the video's audio and record over it using the `.srt` timings.

## Notes

- **edge-tts** sends the narration text to Microsoft's online speech service to make the audio.
- **The Kannada call lines** haven't been checked by a native speaker.
- **There is no music.** Add a royalty-free bed in your editor at about −20 dB.
