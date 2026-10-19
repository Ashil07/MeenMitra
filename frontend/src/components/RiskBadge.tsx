import type { PondRiskLevel } from "@/api/types";

export const RISK_LABEL: Record<PondRiskLevel, string> = {
  safe: "Safe",
  watch: "Watch",
  danger: "Danger",
  unknown: "Not checked",
};

/** Shape differs per level so status never relies on colour alone. */
function RiskGlyph({ level }: { level: PondRiskLevel }) {
  const common = { width: 14, height: 14, viewBox: "0 0 16 16", "aria-hidden": true, focusable: false } as const;
  switch (level) {
    case "safe":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="M4.8 8.2 7 10.4l4.2-4.6" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "watch":
      return (
        <svg {...common}>
          <path d="M8 1.2 15 14H1L8 1.2Z" fill="currentColor" />
          <path d="M8 6v3.6M8 11.6v.1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "danger":
      return (
        <svg {...common}>
          <path d="M5 1h6l4 4v6l-4 4H5l-4-4V5l4-4Z" fill="currentColor" />
          <path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.4 2" />
        </svg>
      );
  }
}

export function RiskBadge({ level, size, prefix }: { level: PondRiskLevel; size?: "lg"; prefix?: string }) {
  return (
    <span className={`badge ${level}${size === "lg" ? " lg" : ""}`}>
      <RiskGlyph level={level} />
      {prefix ? `${prefix} ` : ""}
      {RISK_LABEL[level]}
    </span>
  );
}

export const RISK_COLOR: Record<PondRiskLevel, string> = {
  safe: "var(--safe)",
  watch: "var(--watch)",
  danger: "var(--danger)",
  unknown: "var(--line-strong)",
};
