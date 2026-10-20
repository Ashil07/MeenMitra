"""The rough cut, beat by beat. Each beat is one visual held for its narration (plus a short pause).

vis:   "shot:<id>"  desktop screenshot from capture.py (zooms towards its highlight)
       "phone:<id>" farmer-view screenshot shown in a phone frame
       "ph:<key>"   placeholder card for an AI scene (see PLACEHOLDERS)
       "chat:a|b", "call:ring|live", "logo", "end"  generated graphics
say:   narration and caption text; tts: what the voice reads if different (pronunciation)
kn:    Kannada call line (read by the Kannada voice, phone-filtered); say is then its English subtitle
fx:    extra sounds: ("ding"|"ring"|"dtmf", start_seconds)
"""

V_EN = "en-IN-NeerjaNeural"
V_KN = "kn-IN-SapnaNeural"

DISCLAIMER = "Dramatization — WhatsApp and voice alerts are simulated in this MVP. No real messages or calls are sent."

PLACEHOLDERS = {
    "0A": ("dusk", "Ramesh feeds his pond at dusk", "Coconut palms, paddy fields, a paddle-wheel aerator at the pond edge."),
    "0B": ("night", "The same pond at night, under heavy cloud", "Still black water, hot humid air, the house lights off."),
    "0C": ("dawn_grey", "Morning: Ramesh stares at the water, worried", "Only his face and the rippling surface. No dead fish shown."),
    "1A": ("golden", "5 PM: his phone buzzes as he carries the feed sack", "He puts the sack down and takes out his phone."),
    "1C": ("golden", "He replies, then pulls the feed sack away", "Deciding not to feed tonight."),
    "2": ("evening", "Ramesh types a question on his phone", "Concept only: questions are not in the MVP."),
    "3A": ("night", "4:45 AM: the phone rings in the dark bedroom", "Blue phone glow on his face as he wakes."),
    "3C": ("predawn", "5 AM: he switches on the aerator", "White foam churns across the dark water. Mist, crickets."),
    "4": ("sunrise", "7 AM: calm fish at sunrise, Ramesh smiles", "The aerator still turning, a cup of tea in his hand."),
}

BEATS = [
    # 0:00 The problem
    dict(id="b01", seg="The problem", vis="ph:0A", say="Imagine being a small fish farmer in coastal Karnataka. Your savings and your hard work are all in this pond."),
    dict(id="b02", vis="ph:0B", say="But at night, the oxygen in the water can fall dangerously low while you sleep."),
    dict(id="b03", vis="ph:0C", say="By morning, your fish may already be lost. What if you got a warning before that happened?", title="What if you knew before sunrise?"),
    # 0:20 Introducing MeenMitra
    dict(id="b04", seg="Introducing MeenMitra", vis="logo", say="Meet MeenMitra, an early-warning system for small fish farmers.", tts="Meet Meen Mitra, an early-warning system for small fish farmers."),
    dict(id="b05", vis="shot:dash", say="Let's follow Ramesh and his pond, Kere 1. The dashboard shows every pond and tonight's risk.",
         tts="Let's follow Ramesh and his pond, Keray One. The dashboard shows every pond and tonight's risk.", lower="Ramesh · Kere 1 · Brahmavar, Udupi"),
    dict(id="b06", vis="shot:kere1_overview", say="Kere 1 holds about 1,178 kilograms of fish, worth roughly 1.77 lakh rupees.",
         tts="Keray One holds about eleven hundred and seventy-eight kilograms of fish, worth roughly one point seven seven lakh rupees."),
    # 0:40 The evening forecast
    dict(id="b07", seg="The evening forecast", vis="shot:nightly_normal", say="Every evening at 5 PM, MeenMitra forecasts the night ahead for every pond. On a normal night, it finds no oxygen risk.",
         tts="Every evening at 5 PM, Meen Mitra forecasts the night ahead for every pond. On a normal night, it finds no oxygen risk.", ts="5:00 PM"),
    dict(id="b08", vis="shot:nightly_cloudy", say="But what if tonight is cloudy and hot? Less sunlight means the algae make less oxygen, and warm water holds less of it."),
    dict(id="b09", vis="shot:nightly_cloudy_k1", say="Now three of the six ponds are flagged, and Kere 1 is at Danger.", tts="Now three of the six ponds are flagged, and Keray One is at Danger."),
    # 1:10 Understanding the warning
    dict(id="b10", seg="Understanding the warning", vis="shot:k1_curve", say="Here's Kere 1 up close. This curve is the estimated oxygen through the night, dropping below the danger line around 6 AM.",
         tts="Here's Keray One up close. This curve is the estimated oxygen through the night, dropping below the danger line around 6 AM."),
    dict(id="b11", vis="shot:k1_actions", say="MeenMitra shows the factors behind the warning, and what to do: skip this evening's feed, and start the aerator by 5 AM.",
         tts="Meen Mitra shows the factors behind the warning, and what to do: skip this evening's feed, and start the aerator by 5 AM."),
    # 1:30 WhatsApp alert and the warning call
    dict(id="b12", seg="WhatsApp alert and warning call", vis="ph:1A", say="At 5 PM, Ramesh gets the warning on WhatsApp, in Kannada, with English alongside.", ts="5:00 PM", disc=True, fx=[("ding", 0.2)]),
    dict(id="b13", vis="chat:a", say="It tells him the risk, what's at stake, and exactly what to do.", disc=True, ts="5:00 PM"),
    dict(id="b14", vis="chat:b", say="He replies 1 to confirm, and skips tonight's feed.", tts="He replies one to confirm, and skips tonight's feed.", disc=True, ts="5:02 PM"),
    dict(id="b17", vis="ph:3A", say="And because Kere 1 is at Danger, MeenMitra can also call him before the aerator needs to start, when a text could be missed.",
         tts="And because Keray One is at Danger, Meen Mitra can also call him before the aerator needs to start, when a text could be missed.", ts="4:45 AM", disc=True),
    dict(id="b18", vis="call:ring", say="", ts="4:45 AM", disc=True, fx=[("ring", 0.1)], min=2.4),
    dict(id="b19", vis="call:live", kn="ನಮಸ್ಕಾರ. ಇದು ಮೀನ್‌ಮಿತ್ರದಿಂದ ಬಂದಿರುವ ತುರ್ತು ಕರೆ.", say="Hello. This is an urgent call from MeenMitra.", ts="4:45 AM", disc=True),
    dict(id="b20", vis="call:live", kn="ಅಪಾಯ: ಕೆರೆ ಒಂದು ಕೊಳದಲ್ಲಿ ಆಮ್ಲಜನಕ ಬೆಳಿಗ್ಗೆ 6 ಗಂಟೆ ಸುಮಾರಿಗೆ ತುಂಬಾ ಕಡಿಮೆಯಾಗಬಹುದು.", say="DANGER: oxygen in your pond Kere 1 may fall too low around 6 AM.", ts="4:45 AM", disc=True),
    dict(id="b21", vis="call:live", kn="ಬೆಳಗಿನ ಜಾವ 5 ಗಂಟೆಗೆ ಏರೇಟರ್ ಆನ್ ಮಾಡಿ. ಸರಿ, ಮಾಡುತ್ತೇನೆ ಎಂದು ತಿಳಿಸಲು 1 ಒತ್ತಿ.", say="Start the aerator at 5 AM. Press 1 to say “OK, will do.”", ts="4:45 AM", disc=True, tail_fx=[("dtmf", 0.25)], pad=0.65),
    dict(id="b22", vis="call:live", kn="ಧನ್ಯವಾದ! ನಿಮ್ಮ ಉತ್ತರ ದಾಖಲಾಗಿದೆ.", say="Thank you! Your answer is saved.", ts="4:46 AM", disc=True),
    dict(id="b24", vis="ph:3C", say="", ts="5:00 AM", disc=True, min=2.2),
    # 2:15 Morning check-in
    dict(id="b25", seg="Morning check-in", vis="ph:4", say="The support doesn't stop at the warning. In the morning, MeenMitra asks how the fish were:",
         tts="The support doesn't stop at the warning. In the morning, Meen Mitra asks how the fish were:", ts="7:00 AM"),
    dict(id="b26", vis="phone:farmer_k1_morning", say="gasping for air, not sure, or fine.", ts="7:00 AM", side=("Farmer view · Kere 1", "One tap each morning. No typing.")),
    dict(id="b27", vis="phone:farmer_k1_thanks", say="Each answer adjusts that pond's settings, so future warnings fit it better.", side=("Farmer view · Kere 1", "Each reply tunes this pond's oxygen-use factor.")),
    # 2:35 Fish reports and canal alerts
    dict(id="b28", seg="Fish reports and canal alerts", vis="phone:farmer_abdul_pick", say="Now another farmer, Abdul, notices red spots on his fish. He taps what he sees and sends a report.",
         side=("Farmer view · Kodi Kere", "Abdul · Mulki · Canal C")),
    dict(id="b29", vis="phone:farmer_abdul_sent", say="MeenMitra warns the other ponds on the same canal, without naming Abdul.",
         tts="Meen Mitra warns the other ponds on the same canal, without naming Abdul.", side=("Farmer view · Kodi Kere", "Possible signs — not a diagnosis.")),
    dict(id="b30", vis="shot:coop_map", say="On the cooperative map, Canal C turns red. It's an early signal, not a diagnosis. Decisions about medicine stay with a fisheries officer.",
         label=("Canal C · possible signs — not confirmed", 0.47, 0.60)),
    # 3:05 How it works
    dict(id="b31", seg="How it works", vis="shot:approach_ml", say="Under the hood, a physics-inspired model estimates overnight oxygen, combined with water-quality rules and farmer feedback."),
    dict(id="b32", vis="shot:models_wq", say="We've also trained two machine-learning models. One grades water quality with 99.4 percent accuracy on held-out data;"),
    dict(id="b33", vis="shot:models_ox", say="the other cuts next-hour oxygen error by about 60 percent on simulated ponds. They won't change the risk score until we've tested them on real ponds."),
    # 3:30 Closing
    dict(id="b34", seg="Closing", vis="shot:dash_end", say="MeenMitra isn't just a prediction. It helps farmers understand the risk and decide what to do next.",
         tts="Meen Mitra isn't just a prediction. It helps farmers understand the risk and decide what to do next."),
    dict(id="b35", vis="ph:4", say="Today it's a working prototype on demo data. Next, we test it in real ponds, alongside farmers."),
    dict(id="b36", vis="end", say="Because the farmer who needs a warning before sunrise should get one. MeenMitra: a 5 PM check that can make a difference before dawn.",
         tts="Because the farmer who needs a warning before sunrise should get one. Meen Mitra: a 5 PM check that can make a difference before dawn.", pad=1.0),
]
