import type { PondRiskLevel } from "@/api/types";
import { formatDate } from "@/lib/time";
import { RISK_COLOR, RISK_LABEL } from "./RiskBadge";

const ORDER: PondRiskLevel[] = ["danger", "watch", "safe", "unknown"];

export function RiskDistribution({ counts }: { counts: Record<PondRiskLevel, number> }) {
  const total = ORDER.reduce((s, k) => s + counts[k], 0);
  return (
    <div className="stack">
      <div className="bar-track" role="img" aria-label={ORDER.map((k) => `${RISK_LABEL[k]}: ${counts[k]}`).join(", ")}>
        {total > 0 &&
          ORDER.map((k) =>
            counts[k] ? <span key={k} style={{ width: `${(counts[k] / total) * 100}%`, background: RISK_COLOR[k] }} /> : null,
          )}
      </div>
      <div className="legend">
        {ORDER.map((k) => (
          <span key={k} className="legend-item">
            <span className="swatch" style={{ background: RISK_COLOR[k] }} />
            {RISK_LABEL[k]} <strong>{counts[k]}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

export function RiskTrend({ trend }: { trend: { date: string; safe: number; watch: number; danger: number }[] }) {
  const W = 420;
  const H = 160;
  const pad = { l: 8, r: 8, t: 8, b: 26 };
  const max = Math.max(1, ...trend.map((d) => d.safe + d.watch + d.danger));
  const bw = (W - pad.l - pad.r) / Math.max(1, trend.length);
  const h = (v: number) => (v / max) * (H - pad.t - pad.b);

  return (
    <figure style={{ margin: 0 }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Ponds by risk level over the last ${trend.length} days`}>
        {trend.map((d, i) => {
          const x = pad.l + i * bw + bw * 0.18;
          const w = bw * 0.64;
          let yCursor = H - pad.b;
          const segs = (["safe", "watch", "danger"] as const).map((k) => {
            const hh = h(d[k]);
            yCursor -= hh;
            return <rect key={k} x={x} y={yCursor} width={w} height={Math.max(0, hh - 1)} rx={3} fill={RISK_COLOR[k]} opacity={i === trend.length - 1 ? 1 : 0.72} />;
          });
          const day = new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });
          return (
            <g key={d.date}>
              <title>{`${formatDate(d.date)} — safe ${d.safe}, watch ${d.watch}, danger ${d.danger}`}</title>
              {segs}
              <text x={x + w / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)" fontWeight={i === trend.length - 1 ? 700 : 400}>
                {i === trend.length - 1 ? "Today" : day}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
