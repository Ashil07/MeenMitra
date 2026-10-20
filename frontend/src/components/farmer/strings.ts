/**
 * All farmer-screen text, Kannada first. Kept in one file so a native speaker can review it in
 * one pass. STATUS: the Kannada is an unreviewed draft (shown on screen as such).
 *
 * Writing rules: short sentences, everyday words, one idea per line, no units or numbers
 * the farmer has to interpret. Never promise an outcome.
 */
import type { FeedbackResponse, PondRiskLevel, Symptom } from "@/api/types";

export type Lang = "kn" | "en";
type T = Record<Lang, string>;

export const UI = {
  appName: { kn: "ಮೀನ್‌ಮಿತ್ರ", en: "MeenMitra" },
  appTagline: { kn: "ನಿಮ್ಮ ಕೊಳದ ಸ್ನೇಹಿತ", en: "Your pond's friend" },
  switchTo: { kn: "English", en: "ಕನ್ನಡ" },
  switchToLabel: { kn: "Show in English", en: "ಕನ್ನಡದಲ್ಲಿ ತೋರಿಸಿ" },
  demo: {
    kn: "ಡೆಮೊ: ಕಾಲ್ಪನಿಕ ಕೊಳಗಳು. ಯಾವುದೇ ಸಂದೇಶ ಕಳುಹಿಸಲಾಗುವುದಿಲ್ಲ.",
    en: "Demo: fictional ponds. No messages are sent.",
  },

  pickTitle: { kn: "ನಿಮ್ಮ ಕೊಳವನ್ನು ಆರಿಸಿ", en: "Choose your pond" },
  pickHint: { kn: "ನಿಮ್ಮ ಕೊಳದ ಹೆಸರನ್ನು ಒತ್ತಿ.", en: "Tap your pond's name." },
  lastUsed: { kn: "ಕೊನೆಯ ಬಾರಿ ನೋಡಿದ ಕೊಳ", en: "Last opened" },
  noPonds: { kn: "ಯಾವುದೇ ಕೊಳ ನೋಂದಣಿಯಾಗಿಲ್ಲ.", en: "No ponds are registered yet." },

  yourPond: { kn: "ನಿಮ್ಮ ಕೊಳ", en: "Your pond" },
  changePond: { kn: "ಕೊಳ ಬದಲಿಸಿ", en: "Change pond" },

  updated: { kn: "ಕೊನೆಯ ಪರಿಶೀಲನೆ", en: "Last checked" },
  estimateNote: { kn: "ಇದು ಅಂದಾಜು ಮಾತ್ರ, ನಿಜವಾದ ಅಳತೆ ಅಲ್ಲ.", en: "This is an estimate, not a measurement." },
  listen: { kn: "ಕೇಳಿ", en: "Listen" },
  stop: { kn: "ನಿಲ್ಲಿಸಿ", en: "Stop" },
  noVoice: {
    kn: "ಈ ಸಾಧನದಲ್ಲಿ ಕನ್ನಡ ಧ್ವನಿ ಇಲ್ಲ, ಆದ್ದರಿಂದ ಓದಿ ಹೇಳುವ ಸೌಲಭ್ಯ ಲಭ್ಯವಿಲ್ಲ.",
    en: "Read-aloud is not available: this device has no English voice.",
  },

  todoTitle: { kn: "ಇಂದು ರಾತ್ರಿ ಏನು ಮಾಡಬೇಕು", en: "What to do tonight" },
  todoTitleUnknown: { kn: "ಏನು ಮಾಡಬೇಕು", en: "What to do" },
  noGuarantee: {
    kn: "ಈ ಕ್ರಮಗಳು ಸಹಾಯ ಮಾಡಬಹುದು, ಆದರೆ ಫಲಿತಾಂಶ ಖಚಿತವಲ್ಲ.",
    en: "These steps can help, but nothing is guaranteed.",
  },

  morningTitle: { kn: "ಇಂದು ಬೆಳಿಗ್ಗೆ ಮೀನುಗಳು ಹೇಗಿದ್ದವು?", en: "How were your fish this morning?" },
  thanks: { kn: "ಧನ್ಯವಾದ! ನಿಮ್ಮ ಉತ್ತರ ದಾಖಲಾಗಿದೆ.", en: "Thank you! Your answer is saved." },
  thanksGasping: {
    kn: "ತಕ್ಷಣ ಏರೇಟರ್ ಚಾಲನೆ ಮಾಡಿ ಮತ್ತು ಮೀನುಗಾರಿಕೆ ಅಧಿಕಾರಿಗೆ ತಿಳಿಸಿ.",
    en: "Run the aerator now and tell your fisheries officer.",
  },
  answerHelps: {
    kn: "ನಿಮ್ಮ ಉತ್ತರದಿಂದ ಮುಂದಿನ ಎಚ್ಚರಿಕೆಗಳು ಉತ್ತಮವಾಗುತ್ತವೆ.",
    en: "Your answer helps improve future warnings.",
  },

  messageTitle: { kn: "ಮೀನ್‌ಮಿತ್ರ ಸಂದೇಶ", en: "Message from MeenMitra" },
  ack: { kn: "ಸರಿ, ನೋಡಿದೆ", en: "OK, I saw it" },
  acked: { kn: "ನೀವು ಉತ್ತರಿಸಿದ್ದೀರಿ", en: "You replied" },
  demoMessage: { kn: "ಡೆಮೊ ಸಂದೇಶ, ನಿಜವಾಗಿ ಕಳುಹಿಸಿಲ್ಲ", en: "Demo message, not really sent" },

  reportTitle: { kn: "ಮೀನುಗಳಲ್ಲಿ ಸಮಸ್ಯೆಯೇ?", en: "Problem with your fish?" },
  reportHint: { kn: "ನೀವು ನೋಡಿದ್ದನ್ನು ಒತ್ತಿ, ನಂತರ ಕಳುಹಿಸಿ.", en: "Tap what you see, then send." },
  send: { kn: "ಕಳುಹಿಸಿ", en: "Send" },
  pickOne: { kn: "ಕನಿಷ್ಠ ಒಂದನ್ನು ಆರಿಸಿ.", en: "Choose at least one." },
  reportSent: { kn: "ನಿಮ್ಮ ವರದಿ ಸಿಕ್ಕಿದೆ.", en: "We got your report." },
  medicine: {
    kn: "ಮೀನುಗಾರಿಕೆ ಅಧಿಕಾರಿಯನ್ನು ಕೇಳದೆ ಯಾವುದೇ ಔಷಧಿ ಬಳಸಬೇಡಿ.",
    en: "Do not use any medicine without asking a fisheries officer.",
  },
  notDiagnosis: { kn: "ಇದು ರೋಗ ಪತ್ತೆ ಅಲ್ಲ.", en: "This is not a diagnosis." },
  reportAgain: { kn: "ಇನ್ನೊಂದು ವರದಿ", en: "Report something else" },
  canalWarned: {
    kn: "ನಿಮ್ಮ ಕಾಲುವೆಯ ಇತರ ಕೊಳಗಳಿಗೆ ನಿಮ್ಮ ಹೆಸರು ತಿಳಿಸದೆ ಎಚ್ಚರಿಕೆ ಕಳುಹಿಸಲಾಗುತ್ತದೆ.",
    en: "Other ponds on your canal will be warned, without your name.",
  },

  help: {
    kn: "ಸಹಾಯ ಬೇಕೇ? ನಿಮ್ಮ ಸಹಕಾರ ಸಂಘ ಅಥವಾ ಮೀನುಗಾರಿಕೆ ಅಧಿಕಾರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ.",
    en: "Need help? Contact your cooperative or fisheries officer.",
  },
  draftNote: {
    kn: "ಕನ್ನಡ ಪಠ್ಯ ಕರಡು ರೂಪದಲ್ಲಿದೆ; ಪರಿಶೀಲನೆ ಬಾಕಿ ಇದೆ.",
    en: "Kannada text is a draft awaiting native-speaker review.",
  },
  staffView: { kn: "ಸಿಬ್ಬಂದಿ ನೋಟ", en: "Staff view" },

  loading: { kn: "ಲೋಡ್ ಆಗುತ್ತಿದೆ…", en: "Loading…" },
  loadError: { kn: "ಮಾಹಿತಿ ಸಿಗಲಿಲ್ಲ.", en: "Could not load the information." },
  saveError: { kn: "ಉಳಿಸಲು ಆಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", en: "Could not save. Please try again." },
  retry: { kn: "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ", en: "Try again" },
  pondNotFound: { kn: "ಈ ಕೊಳ ಸಿಗಲಿಲ್ಲ.", en: "This pond was not found." },
} satisfies Record<string, T>;

export const STATUS_WORD: Record<PondRiskLevel, T> = {
  safe: { kn: "ಸುರಕ್ಷಿತ", en: "Safe" },
  watch: { kn: "ಎಚ್ಚರ", en: "Be careful" },
  danger: { kn: "ಅಪಾಯ", en: "Danger" },
  unknown: { kn: "ಮಾಹಿತಿ ಇಲ್ಲ", en: "No check yet" },
};

/** One sentence under the status word, depending on where the status came from. */
export const STATUS_LINE: Record<"forecast" | "water_check", Record<PondRiskLevel, T>> = {
  forecast: {
    safe: { kn: "ಇಂದು ರಾತ್ರಿ ನಿಮ್ಮ ಮೀನುಗಳಿಗೆ ಅಪಾಯ ಕಡಿಮೆ.", en: "Low risk for your fish tonight." },
    watch: { kn: "ಇಂದು ರಾತ್ರಿ ನೀರಿನಲ್ಲಿ ಆಮ್ಲಜನಕ ಕಡಿಮೆಯಾಗಬಹುದು.", en: "Oxygen in the water may drop tonight." },
    danger: {
      kn: "ಇಂದು ರಾತ್ರಿ ಮೀನುಗಳಿಗೆ ಉಸಿರಾಡಲು ಆಮ್ಲಜನಕ ಸಾಕಾಗದಿರಬಹುದು.",
      en: "Your fish may not get enough oxygen tonight.",
    },
    unknown: { kn: "ಈ ಕೊಳಕ್ಕೆ ಇನ್ನೂ ಪರಿಶೀಲನೆ ಆಗಿಲ್ಲ.", en: "This pond has not been checked yet." },
  },
  water_check: {
    safe: { kn: "ನಿಮ್ಮ ಕೊನೆಯ ನೀರಿನ ಪರೀಕ್ಷೆ ಸರಿಯಾಗಿದೆ.", en: "Your last water check looks fine." },
    watch: { kn: "ನೀರಿನ ಪರೀಕ್ಷೆಯಲ್ಲಿ ಗಮನಿಸಬೇಕಾದ ಅಂಶಗಳಿವೆ.", en: "Your last water check needs attention." },
    danger: { kn: "ನೀರಿನ ಪರೀಕ್ಷೆಯಲ್ಲಿ ಅಪಾಯದ ಸೂಚನೆ ಕಂಡಿದೆ.", en: "Your last water check shows danger." },
    unknown: { kn: "ಈ ಕೊಳಕ್ಕೆ ಇನ್ನೂ ಪರಿಶೀಲನೆ ಆಗಿಲ್ಲ.", en: "This pond has not been checked yet." },
  },
};

export type StepId =
  | "aerator_all_night"
  | "fresh_water"
  | "no_feed"
  | "less_feed"
  | "aerator_ready"
  | "check_dawn"
  | "feed_normal"
  | "check_morning"
  | "call_officer"
  | "report_below";

export const STEP_TEXT: Record<StepId, T> = {
  aerator_all_night: { kn: "ಸಂಜೆಯಿಂದ ಬೆಳಗಿನವರೆಗೆ ಏರೇಟರ್ ಚಾಲನೆ ಮಾಡಿ.", en: "Run the aerator from evening until sunrise." },
  fresh_water: {
    kn: "ಏರೇಟರ್ ಇಲ್ಲದಿದ್ದರೆ, ಸಾಧ್ಯವಾದರೆ ಶುದ್ಧ ಹೊಸ ನೀರು ಹಾಯಿಸಿ.",
    en: "No aerator? If you can, add clean fresh water.",
  },
  no_feed: { kn: "ಇಂದು ಸಂಜೆ ಮೀನುಗಳಿಗೆ ಆಹಾರ ಕೊಡಬೇಡಿ.", en: "Do not feed the fish this evening." },
  less_feed: { kn: "ಇಂದು ಸಂಜೆ ಕಡಿಮೆ ಆಹಾರ ಕೊಡಿ.", en: "Give less feed this evening." },
  aerator_ready: {
    kn: "ಏರೇಟರ್ ಸಿದ್ಧವಾಗಿಡಿ; ಮಧ್ಯರಾತ್ರಿಯ ನಂತರ ಚಾಲನೆ ಮಾಡಿ.",
    en: "Keep the aerator ready and run it after midnight.",
  },
  check_dawn: { kn: "ಸೂರ್ಯೋದಯಕ್ಕೆ ಮೊದಲು ಮೀನುಗಳನ್ನು ನೋಡಿ.", en: "Look at your fish before sunrise." },
  feed_normal: { kn: "ಎಂದಿನಂತೆ ಆಹಾರ ಕೊಡಿ.", en: "Feed as usual." },
  check_morning: { kn: "ಬೆಳಿಗ್ಗೆ ಮೀನುಗಳನ್ನು ಒಮ್ಮೆ ನೋಡಿ.", en: "Take a look at your fish in the morning." },
  call_officer: {
    kn: "ಮೀನುಗಳು ಮೇಲ್ಮೈಯಲ್ಲಿ ಉಸಿರಿಗಾಗಿ ಒದ್ದಾಡಿದರೆ ಅಥವಾ ಸತ್ತರೆ, ಮೀನುಗಾರಿಕೆ ಅಧಿಕಾರಿಗೆ ತಿಳಿಸಿ.",
    en: "If fish gasp at the surface or die, tell your fisheries officer.",
  },
  report_below: { kn: "ಮೀನುಗಳಲ್ಲಿ ಸಮಸ್ಯೆ ಕಂಡರೆ ಕೆಳಗೆ ತಿಳಿಸಿ.", en: "If you see a problem with your fish, report it below." },
};

/** At most three steps, most important first. */
export function stepsFor(level: PondRiskLevel, hasAerator: boolean): StepId[] {
  switch (level) {
    case "danger":
      return [hasAerator ? "aerator_all_night" : "fresh_water", "no_feed", "call_officer"];
    case "watch":
      return [hasAerator ? "aerator_ready" : "fresh_water", "less_feed", "check_dawn"];
    case "safe":
      return ["feed_normal", "check_morning"];
    default:
      return ["check_morning", "report_below"];
  }
}

export const MORNING_OPTIONS: { value: FeedbackResponse; text: T }[] = [
  { value: 3, text: { kn: "ಚೆನ್ನಾಗಿದ್ದವು", en: "Fine" } },
  { value: 1, text: { kn: "ಉಸಿರಿಗಾಗಿ ಒದ್ದಾಡುತ್ತಿದ್ದವು", en: "Gasping for air" } },
  { value: 2, text: { kn: "ಗೊತ್ತಿಲ್ಲ", en: "Not sure" } },
];

/** Signs a farmer can see without a test kit. Keys are the shared symptom enum. */
export const FARMER_SYMPTOMS: { id: Symptom; text: T }[] = [
  { id: "gasping_at_surface", text: { kn: "ಮೇಲ್ಮೈಯಲ್ಲಿ ಉಸಿರಿಗಾಗಿ ಒದ್ದಾಟ", en: "Gasping at the surface" } },
  { id: "dead_fish", text: { kn: "ಸತ್ತ ಮೀನು", en: "Dead fish" } },
  { id: "not_feeding", text: { kn: "ಆಹಾರ ತಿನ್ನುತ್ತಿಲ್ಲ", en: "Not eating" } },
  { id: "red_spots_or_ulcers", text: { kn: "ಕೆಂಪು ಕಲೆ ಅಥವಾ ಹುಣ್ಣು", en: "Red spots or sores" } },
  { id: "white_patches_or_fungus", text: { kn: "ಬಿಳಿ ಕಲೆ ಅಥವಾ ಹತ್ತಿಯಂತಹ ಬೆಳವಣಿಗೆ", en: "White patches or cotton-like growth" } },
  { id: "foul_smell", text: { kn: "ನೀರಿನಲ್ಲಿ ಕೆಟ್ಟ ವಾಸನೆ", en: "Bad smell from the water" } },
];

/** "Fish worth about ₹1,77,000 are at risk." Value is a demo estimate (see lib/value.ts). */
export function valueAtRiskText(formattedInr: string, lang: Lang): string {
  return lang === "kn" ? `ಸುಮಾರು ${formattedInr} ಮೌಲ್ಯದ ಮೀನುಗಳು ಅಪಾಯದಲ್ಲಿವೆ.` : `Fish worth about ${formattedInr} are at risk.`;
}

/** "40 ನಿಮಿಷ ಹಿಂದೆ" / "40 min ago". */
export function relativeTime(iso: string | null, lang: Lang, now: Date = new Date()): string {
  if (!iso) return lang === "kn" ? "ಇನ್ನೂ ಇಲ್ಲ" : "never";
  const min = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (min < 1) return lang === "kn" ? "ಈಗಷ್ಟೇ" : "just now";
  if (min < 60) return lang === "kn" ? `${min} ನಿಮಿಷ ಹಿಂದೆ` : `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return lang === "kn" ? `${h} ಗಂಟೆ ಹಿಂದೆ` : `${h} h ago`;
  const d = Math.round(h / 24);
  return lang === "kn" ? `${d} ದಿನ ಹಿಂದೆ` : `${d} d ago`;
}
