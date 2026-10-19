"use client";

import { useId, useState } from "react";
import type { Forecast } from "@/api/types";
import { formatClock, formatHourShort } from "@/lib/time";
import { RISK_LABEL } from "./RiskBadge";

const W = 720;
const H = 300;
const PAD = { l: 44, r: 16, t: 16, b: 34 };

export function ForecastChart({ forecast, compact = false }: { forecast: Forecast; compact?: boolean }) {
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const titleId = useId();
  const pts = forecast.points;
  const { danger_below_mg_l: dangerT, watch_below_mg_l: watchT } = forecast.thresholds;

  if (pts.length === 0) return <p className="muted">This forecast has no hourly points.</p>;

  const maxY = Math.max(10, Math.ceil(Math.max(...pts.map((p) => p.upper_mg_l ?? p.estimated_do_mg_l)) + 0.5));
  const x = (i: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / Math.max(1, pts.length - 1);
  const y = (v: number) => PAD.t + (1 - Math.min(v, maxY) / maxY) * (H - PAD.t - PAD.b);

  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.estimated_do_mg_l).toFixed(1)}`).join(" ");
  const hasBand = pts.every((p) => p.lower_mg_l !== null && p.upper_mg_l !== null);
  const band = hasBand
    ? [
        ...pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.upper_mg_l!).toFixed(1)}`),
        ...[...pts].reverse().map((p, j) => `L${x(pts.length - 1 - j).toFixed(1)},${y(p.lower_mg_l!).toFixed(1)}`),
        "Z",
      ].join(" ")
    : null;

  const ticks = Array.from({ length: Math.floor(maxY / 2) + 1 }, (_, i) => i * 2);
  const minIdx = pts.reduce((best, p, i) => (p.estimated_do_mg_l < pts[best].estimated_do_mg_l ? i : best), 0);
  const a = active !== null ? pts[active] : null;

  return (
    <figure style={{ margin: 0 }} aria-labelledby={titleId}>
      <figcaption id={titleId} className="sr-only">
        Estimated dissolved oxygen from {formatClock(pts[0].time)} to {formatClock(pts[pts.length - 1].time)}. Lowest estimate{" "}
        {pts[minIdx].estimated_do_mg_l} mg/L at {formatClock(pts[minIdx].time)}. Danger below {dangerT} mg/L, watch below {watchT} mg/L.
      </figcaption>

      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={titleId} onMouseLeave={() => setActive(null)}>
        <defs>
          <linearGradient id={`${titleId}-line`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#17675c" />
            <stop offset="100%" stopColor="#0e4a43" />
          </linearGradient>
        </defs>

        {/* risk zones */}
        <rect x={PAD.l} y={y(dangerT)} width={W - PAD.l - PAD.r} height={y(0) - y(dangerT)} fill="var(--danger-bg)" />
        <rect x={PAD.l} y={y(watchT)} width={W - PAD.l - PAD.r} height={y(dangerT) - y(watchT)} fill="var(--watch-bg)" />
        <text x={W - PAD.r - 6} y={y(dangerT) + 14} textAnchor="end" fontSize="11" fontWeight="700" fill="var(--danger)">
          DANGER &lt; {dangerT} mg/L
        </text>
        <text x={W - PAD.r - 6} y={y(watchT) + 14} textAnchor="end" fontSize="11" fontWeight="700" fill="var(--watch)">
          WATCH &lt; {watchT} mg/L
        </text>

        {/* grid */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t === 0 ? undefined : "3 4"} />
            <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
              {t}
            </text>
          </g>
        ))}
        <text x={12} y={PAD.t + 4} fontSize="10" fill="var(--muted)" transform={`rotate(-90 12 ${PAD.t + 4})`} textAnchor="end">
          mg/L (estimated)
        </text>
        {pts.map((p, i) =>
          compact && i % 2 === 1 ? null : (
            <text key={p.time} x={x(i)} y={H - 12} textAnchor="middle" fontSize="11" fill="var(--muted)">
              {formatHourShort(p.time)}
            </text>
          ),
        )}

        {band && <path d={band} fill="rgba(61,181,169,0.18)" stroke="none" />}
        <path d={line} fill="none" stroke={`url(#${titleId}-line)`} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />

        {/* lowest point marker */}
        <g>
          <line x1={x(minIdx)} x2={x(minIdx)} y1={PAD.t} y2={H - PAD.b} stroke="var(--ink-2)" strokeDasharray="2 3" opacity={0.4} />
        </g>

        {pts.map((p, i) => (
          <g
            key={p.time}
            className="pt"
            tabIndex={compact ? -1 : 0}
            role={compact ? undefined : "button"}
            aria-label={`${formatClock(p.time)}: ${p.estimated_do_mg_l} mg/L estimated, ${RISK_LABEL[p.risk_level]}`}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
          >
            <rect x={x(i) - 18} y={PAD.t} width={36} height={H - PAD.t - PAD.b} fill="transparent" />
            <circle
              className="ring"
              cx={x(i)}
              cy={y(p.estimated_do_mg_l)}
              r={active === i ? 6 : i === minIdx ? 5 : 3.5}
              fill={p.risk_level === "danger" ? "var(--danger)" : p.risk_level === "watch" ? "var(--watch)" : "var(--safe)"}
              stroke="#fff"
              strokeWidth={2}
            />
          </g>
        ))}

        {a && active !== null && (
          <g pointerEvents="none">
            {(() => {
              const tx = Math.min(Math.max(x(active) - 80, PAD.l), W - PAD.r - 160);
              const ty = Math.max(PAD.t, y(a.estimated_do_mg_l) - 78);
              return (
                <g transform={`translate(${tx},${ty})`}>
                  <rect width={160} height={64} rx={10} fill="var(--forest)" opacity={0.95} />
                  <text x={12} y={20} fontSize="12" fontWeight="700" fill="#fff">
                    {formatClock(a.time)} · {RISK_LABEL[a.risk_level]}
                  </text>
                  <text x={12} y={38} fontSize="12" fill="#cfe2db">
                    Est. {a.estimated_do_mg_l} mg/L
                    {a.lower_mg_l !== null && a.upper_mg_l !== null ? ` (${a.lower_mg_l}–${a.upper_mg_l})` : ""}
                  </text>
                  <text x={12} y={54} fontSize="11" fill="#9fbfb4">
                    Water ~{a.water_temp_c} °C
                  </text>
                </g>
              );
            })()}
          </g>
        )}
      </svg>

      <div className="row between" style={{ marginTop: 8 }}>
        <div className="legend" aria-hidden="true">
          <span className="legend-item">
            <span className="swatch" style={{ background: "var(--brand-2)", height: 3 }} /> Estimated oxygen
          </span>
          {hasBand && (
            <span className="legend-item">
              <span className="swatch" style={{ background: "rgba(61,181,169,0.3)" }} /> Uncertainty band
            </span>
          )}
          <span className="legend-item">
            <span className="swatch" style={{ background: "var(--watch-bg)", boxShadow: "inset 0 0 0 1px var(--watch-line)" }} /> Watch zone
          </span>
          <span className="legend-item">
            <span className="swatch" style={{ background: "var(--danger-bg)", boxShadow: "inset 0 0 0 1px var(--danger-line)" }} /> Danger zone
          </span>
        </div>
        {!compact && (
          <button type="button" className="btn sm ghost" aria-expanded={showTable} onClick={() => setShowTable((s) => !s)}>
            {showTable ? "Hide" : "Show"} hourly table
          </button>
        )}
      </div>

      {showTable && (
        <div className="table-wrap fade-in" style={{ marginTop: 10 }}>
          <table>
            <caption className="sr-only">Hourly estimated oxygen</caption>
            <thead>
              <tr>
                <th>Time (IST)</th>
                <th className="num">Est. oxygen (mg/L)</th>
                <th className="num">Range</th>
                <th className="num">Water °C</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {pts.map((p) => (
                <tr key={p.time}>
                  <td>{formatClock(p.time)}</td>
                  <td className="num">{p.estimated_do_mg_l.toFixed(2)}</td>
                  <td className="num">{p.lower_mg_l !== null && p.upper_mg_l !== null ? `${p.lower_mg_l}–${p.upper_mg_l}` : "—"}</td>
                  <td className="num">{p.water_temp_c}</td>
                  <td>{RISK_LABEL[p.risk_level]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}
