/**
 * DEMO message templates used only by the mock API.
 * In live mode the backend renders alert text; the frontend never builds messages itself.
 * Kannada drafts have NOT been reviewed by a native speaker (kannada_reviewed: false).
 */
import type { AlertMessage, RiskLevel, WaterFinding } from "../types";
import { istHour } from "@/lib/time";
import { formatInr } from "@/lib/value";

function kannadaTime(iso: string): string {
  const h = istHour(iso);
  if (h === 18) return "ಸಂಜೆ 6 ಗಂಟೆ";
  if (h >= 19 && h <= 23) return `ರಾತ್ರಿ ${h - 12} ಗಂಟೆ`;
  if (h === 0) return "ರಾತ್ರಿ 12 ಗಂಟೆ";
  if (h >= 1 && h <= 5) return `ಬೆಳಗಿನ ಜಾವ ${h} ಗಂಟೆ`;
  return `ಬೆಳಿಗ್ಗೆ ${h} ಗಂಟೆ`;
}

function englishTime(iso: string): string {
  const h = istHour(iso);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${h < 12 ? "AM" : "PM"}`;
}

export function forecastMessage(opts: {
  pondName: string;
  risk: RiskLevel;
  lowTime: string;
  aeratorTime: string | null;
  hasAerator: boolean;
  /** Rough value of the fish in the pond (demo estimate); adds an "at risk" line to Watch/Danger. */
  valueInr?: number;
}): AlertMessage {
  const { pondName: p, risk, lowTime } = opts;
  const atRiskKn = opts.valueInr ? `\nಸುಮಾರು ${formatInr(opts.valueInr)} ಮೌಲ್ಯದ ಮೀನುಗಳು ಅಪಾಯದಲ್ಲಿವೆ.` : "";
  const atRiskEn = opts.valueInr ? `\nFish worth about ${formatInr(opts.valueInr)} are at risk.` : "";
  if (risk === "danger") {
    const aer = opts.aeratorTime ?? lowTime;
    const aerKn = opts.hasAerator
      ? `• ${kannadaTime(aer)}ಗೆ ಏರೇಟರ್ ಆನ್ ಮಾಡಿ`
      : "• ಏರೇಟರ್ ಇಲ್ಲದಿದ್ದರೆ, ನೆರೆಯವರಿಂದ ಏರೇಟರ್ ಅಥವಾ ಪಂಪ್ ವ್ಯವಸ್ಥೆ ಮಾಡಿ";
    const aerEn = opts.hasAerator
      ? `• Start the aerator at ${englishTime(aer)}`
      : "• No aerator? Arrange an aerator or pump from a neighbour";
    return {
      message_kn: `ಅಪಾಯ: ಇಂದು ರಾತ್ರಿ "${p}" ಕೊಳದಲ್ಲಿ ಆಮ್ಲಜನಕ ${kannadaTime(lowTime)} ಸುಮಾರಿಗೆ ತುಂಬಾ ಕಡಿಮೆಯಾಗಬಹುದು.${atRiskKn}\nಹೀಗೆ ಮಾಡಿ:\n• ಇಂದು ಸಂಜೆ ಮೀನುಗಳಿಗೆ ಆಹಾರ ಹಾಕಬೇಡಿ\n${aerKn}\n1 ಎಂದು ಉತ್ತರಿಸಿ = ಸರಿ, ಮಾಡುತ್ತೇನೆ`,
      message_en: `DANGER tonight for your pond "${p}". Oxygen may fall too low around ${englishTime(lowTime)}.${atRiskEn}\nDo this:\n• Don't feed the fish this evening\n${aerEn}\nReply 1 = OK, will do`,
      kannada_reviewed: false,
    };
  }
  if (risk === "watch") {
    return {
      message_kn: `ಎಚ್ಚರಿಕೆ: ಇಂದು ರಾತ್ರಿ "${p}" ಕೊಳದಲ್ಲಿ ಆಮ್ಲಜನಕ ${kannadaTime(lowTime)} ಸುಮಾರಿಗೆ ಕಡಿಮೆಯಾಗಬಹುದು.${atRiskKn}\nಹೀಗೆ ಮಾಡಿ:\n• ಇಂದು ಸಂಜೆ ಆಹಾರವನ್ನು ಅರ್ಧದಷ್ಟು ಕಡಿಮೆ ಮಾಡಿ\n• ಏರೇಟರ್ ಸಿದ್ಧವಾಗಿಡಿ\n• ಬೆಳಗಿನ ಜಾವ ಮೀನುಗಳನ್ನು ಗಮನಿಸಿ\n1 ಎಂದು ಉತ್ತರಿಸಿ = ಸರಿ`,
      message_en: `WATCH tonight for your pond "${p}". Oxygen may run low around ${englishTime(lowTime)}.${atRiskEn}\nDo this:\n• Cut this evening's feed by half\n• Keep the aerator ready\n• Check the fish before dawn\nReply 1 = OK`,
      kannada_reviewed: false,
    };
  }
  return {
    message_kn: `ಸುರಕ್ಷಿತ: ಇಂದು ರಾತ್ರಿ "${p}" ಕೊಳದಲ್ಲಿ ಆಮ್ಲಜನಕದ ಅಪಾಯ ಕಡಿಮೆ ಇದೆ. ಎಂದಿನಂತೆ ಮುಂದುವರಿಸಿ.`,
    message_en: `SAFE tonight for your pond "${p}". Low oxygen risk. Continue as usual.`,
    kannada_reviewed: false,
  };
}

const PARAM_KN: Record<WaterFinding["parameter"], string> = {
  ph: "ಪಿಎಚ್ (pH)",
  temperature_c: "ನೀರಿನ ತಾಪಮಾನ",
  ammonia_mg_l: "ಅಮೋನಿಯಾ",
  nitrite_mg_l: "ನೈಟ್ರೈಟ್",
  symptom: "ಮೀನುಗಳ ಲಕ್ಷಣಗಳು",
};

const PARAM_EN: Record<WaterFinding["parameter"], string> = {
  ph: "pH",
  temperature_c: "water temperature",
  ammonia_mg_l: "ammonia",
  nitrite_mg_l: "nitrite",
  symptom: "fish symptoms",
};

export function waterCheckMessage(opts: {
  pondName: string;
  risk: RiskLevel;
  findings: WaterFinding[];
  refer: boolean;
}): AlertMessage {
  const p = opts.pondName;
  const flagged = [...new Set(opts.findings.filter((f) => f.level !== "safe").map((f) => f.parameter))];
  if (opts.risk === "safe") {
    return {
      message_kn: `ಸುರಕ್ಷಿತ: "${p}" ಕೊಳದ ನೀರಿನ ಪರೀಕ್ಷೆ ಸರಿಯಾಗಿದೆ. ಎಂದಿನಂತೆ ಮುಂದುವರಿಸಿ.`,
      message_en: `SAFE: The water check for "${p}" looks fine. Continue as usual.`,
      kannada_reviewed: false,
    };
  }
  const headKn =
    opts.risk === "danger"
      ? `ಅಪಾಯ: "${p}" ಕೊಳದ ನೀರಿನ ಪರೀಕ್ಷೆಯಲ್ಲಿ ಸಮಸ್ಯೆ ಕಂಡುಬಂದಿದೆ.`
      : `ಎಚ್ಚರಿಕೆ: "${p}" ಕೊಳದ ನೀರಿನ ಪರೀಕ್ಷೆಯಲ್ಲಿ ಗಮನಿಸಬೇಕಾದ ಅಂಶಗಳಿವೆ.`;
  const headEn =
    opts.risk === "danger"
      ? `DANGER: The water check for "${p}" found a problem.`
      : `WATCH: The water check for "${p}" needs attention.`;
  const referKn = opts.refer ? "\n• ಔಷಧಿ ಹಾಕುವ ಮೊದಲು ಮೀನುಗಾರಿಕೆ ಅಧಿಕಾರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ" : "";
  const referEn = opts.refer ? "\n• Contact the fisheries officer before using any medicine" : "";
  return {
    message_kn: `${headKn}\nಗಮನಿಸಿ: ${flagged.map((k) => PARAM_KN[k]).join(", ")}\nಹೀಗೆ ಮಾಡಿ:\n• ಇಂದು ಆಹಾರ ಕಡಿಮೆ ಮಾಡಿ${referKn}\n1 ಎಂದು ಉತ್ತರಿಸಿ = ಸರಿ`,
    message_en: `${headEn}\nCheck: ${flagged.map((k) => PARAM_EN[k]).join(", ")}\nDo this:\n• Reduce feeding today${referEn}\nReply 1 = OK`,
    kannada_reviewed: false,
  };
}

export function outbreakNoticeMessage(): AlertMessage {
  return {
    message_kn:
      "ಸೂಚನೆ: ನಿಮ್ಮ ಕಾಲುವೆಯ ಇನ್ನೊಂದು ಕೊಳದಲ್ಲಿ ಮೀನು ರೋಗದ ಸಂಭವನೀಯ ಲಕ್ಷಣಗಳು ವರದಿಯಾಗಿವೆ (ದೃಢಪಟ್ಟಿಲ್ಲ).\n• ಕೆಲವು ದಿನ ಕಾಲುವೆಯಿಂದ ನೀರು ತುಂಬಿಸಬೇಡಿ\n• ನಿಮ್ಮ ಮೀನುಗಳನ್ನು ಗಮನಿಸಿ\n1 ಎಂದು ಉತ್ತರಿಸಿ = ಸರಿ",
    message_en:
      "NOTICE: Possible fish-disease signs were reported at another pond on your canal (not confirmed).\n• Avoid filling from the canal for a few days\n• Watch your fish closely\nReply 1 = OK",
    kannada_reviewed: false,
  };
}
