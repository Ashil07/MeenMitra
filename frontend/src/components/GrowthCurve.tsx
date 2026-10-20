"use client";

import { useId } from "react";
import type { Species } from "@/api/types";
import { DEMO_SURVIVAL, demoBiomassKg, weightAtDay } from "@/lib/growth";
import { fmtInt } from "@/lib/labels";
import { daysBetween } from "@/lib/time";
import { VALUE_NOTE, fishValueInr, formatInr } from "@/lib/value";

const W = 320;
const H = 150;
const PAD = { l: 38, r: 12, t: 12, b: 26 };

/** Today's estimated fish weight from the stocking date, shown on the demo growth curve. */
export function GrowthCurve({ species, stockingDate, fishCount }: { species: Species; stockingDate: string; fishCount: number }) {
  const titleId = useId();
  const today = Math.max(0, daysBetween(stockingDate));
  const maxDay = Math.max(240, Math.ceil((today + 60) / 30) * 30);
  const weights = Array.from({ length: maxDay / 5 + 1 }, (_, i) => weightAtDay(species, i * 5));
  const maxW = Math.max(...weights) * 1.08;
  const x = (d: number) => PAD.l + (d / maxDay) * (W - PAD.l - PAD.r);
  const y = (g: number) => PAD.t + (1 - g / maxW) * (H - PAD.t - PAD.b);
  const path = weights.map((g, i) => `${i ? "L" : "M"}${x(i * 5).toFixed(1)},${y(g).toFixed(1)}`).join(" ");
  const wToday = weightAtDay(species, today);
  const biomass = demoBiomassKg(fishCount, wToday);

  return (
    <figure style={{ margin: 0 }} aria-labelledby={titleId}>
      <figcaption id={titleId} className="small">
        <strong>~{fmtInt(wToday)} g</strong> per fish today (day {today}) · <strong>~{fmtInt(biomass)} kg</strong> in the pond ·{" "}
        <span title={VALUE_NOTE}>worth about {formatInr(fishValueInr(species, biomass))}</span>
      </figcaption>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Growth curve: about ${wToday} grams per fish on day ${today}.`} style={{ marginTop: 8 }}>
        <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="var(--line)" />
        <path d={path} fill="none" stroke="var(--brand-2)" strokeWidth={2.5} strokeLinecap="round" />
        <line x1={x(today)} x2={x(today)} y1={PAD.t} y2={H - PAD.b} stroke="var(--ink-2)" strokeDasharray="3 3" opacity={0.5} />
        <circle cx={x(today)} cy={y(wToday)} r={5} fill="var(--brand)" stroke="#fff" strokeWidth={2} />
        <text x={x(today) + 7} y={Math.max(PAD.t + 10, y(wToday) - 6)} fontSize="11" fontWeight="700" fill="var(--ink)">
          today
        </text>
        <text x={PAD.l - 6} y={PAD.t + 8} fontSize="10" fill="var(--muted)" textAnchor="end">
          {fmtInt(Math.round(maxW / 100) * 100)} g
        </text>
        <text x={PAD.l - 6} y={H - PAD.b} fontSize="10" fill="var(--muted)" textAnchor="end">
          0
        </text>
        {[0, maxDay / 2, maxDay].map((d) => (
          <text key={d} x={x(d)} y={H - 8} fontSize="10" fill="var(--muted)" textAnchor="middle">
            day {d}
          </text>
        ))}
      </svg>
      <p className="tiny muted" style={{ marginTop: 6 }}>
        Demo logistic growth curve from the stocking date, assuming {Math.round(DEMO_SURVIVAL * 100)}% survival. Not weighed fish. Tonight&apos;s forecast uses this
        weight to estimate oxygen demand.
      </p>
    </figure>
  );
}
