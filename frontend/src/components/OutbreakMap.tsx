"use client";

import Link from "next/link";
import type { Alert, OutbreakCluster, PondSummary } from "@/api/types";
import { knownVillage } from "@/lib/places";
import { RISK_COLOR, RISK_LABEL } from "./RiskBadge";

const W = 360;
const H = 440;
const PAD = 24;
// Coastal strip from Kota (north) to Mulki (south). East-west is stretched for legibility (schematic).
const BOX = { latMin: 13.03, latMax: 13.58, lonMin: 74.6, lonMax: 74.9 };

const x = (lon: number) => PAD + ((lon - BOX.lonMin) / (BOX.lonMax - BOX.lonMin)) * (W - 2 * PAD);
const y = (lat: number) => PAD + ((BOX.latMax - lat) / (BOX.latMax - BOX.latMin)) * (H - 2 * PAD);

// Simplified coastline (schematic): roughly where the Udupi / Mulki shore runs.
const COAST: [number, number][] = [
  [74.69, 13.6],
  [74.698, 13.4],
  [74.73, 13.25],
  [74.765, 13.0],
];

/**
 * Cooperative outbreak map. Villages sit at approximate public locations; ponds are drawn in a
 * small ring around their village (no pond coordinates are stored). Canals that have a possible
 * cluster or outbreak notices are highlighted.
 */
export function OutbreakMap({
  canals,
  clusters,
  notices,
}: {
  canals: { canal: string; ponds: PondSummary[] }[];
  clusters: OutbreakCluster[];
  notices: Alert[];
}) {
  const ponds = canals.flatMap((c) => c.ponds.map((p) => ({ ...p, canal: c.canal })));
  const byVillage = new Map<string, typeof ponds>();
  for (const p of ponds) byVillage.set(p.village, [...(byVillage.get(p.village) ?? []), p]);

  const pos = new Map<string, { cx: number; cy: number }>();
  const villages: { name: string; vx: number; vy: number }[] = [];
  const unplaced: string[] = [];
  for (const [village, list] of byVillage) {
    const place = knownVillage(village);
    if (!place) {
      unplaced.push(...list.map((p) => `${p.name} (${village})`));
      continue;
    }
    const vx = x(place.longitude);
    const vy = y(place.latitude);
    villages.push({ name: village, vx, vy });
    list.forEach((p, i) => {
      const angle = (i / Math.max(list.length, 1)) * 2 * Math.PI - Math.PI / 2;
      pos.set(p.id, { cx: vx + 22 + Math.cos(angle) * 14, cy: vy + Math.sin(angle) * 14 });
    });
  }

  const noticedPonds = new Set(notices.map((n) => n.pond_id));
  const hotCanals = new Set([...clusters.map((c) => c.canal), ...notices.map((n) => ponds.find((p) => p.id === n.pond_id)?.canal).filter(Boolean)]);
  const coastPath = COAST.map(([lon, lat], i) => `${i ? "L" : "M"}${x(lon).toFixed(1)},${y(lat).toFixed(1)}`).join(" ");

  const summary = ponds.map((p) => `${p.name}, ${p.village}: ${RISK_LABEL[p.latest_risk]}${noticedPonds.has(p.id) ? ", outbreak notice" : ""}`).join("; ");

  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`Outbreak map. ${summary}`} style={{ maxWidth: 520, margin: "0 auto" }}>
        <path d={`${coastPath} L0,${H} L0,0 Z`} fill="#d7efe9" />
        <path d={coastPath} stroke="#9bd3ca" strokeWidth={2} fill="none" />
        <text x={10} y={H / 2} fontSize="11" fill="#3d6b62" transform={`rotate(-90 10 ${H / 2})`} textAnchor="middle">
          Arabian Sea
        </text>

        {(() => {
          const udupi = knownVillage("Udupi")!;
          return (
            <g>
              <rect x={x(udupi.longitude) - 3} y={y(udupi.latitude) - 3} width={6} height={6} fill="var(--muted)" />
              <text x={x(udupi.longitude) + 8} y={y(udupi.latitude) + 4} fontSize="10" fill="var(--muted)">
                Udupi town
              </text>
            </g>
          );
        })()}

        {canals.map((c) => {
          const pts = c.ponds.map((p) => pos.get(p.id)).filter((v): v is { cx: number; cy: number } => !!v);
          if (pts.length < 2) return null;
          const hot = hotCanals.has(c.canal);
          const d = pts.map((p, i) => `${i ? "L" : "M"}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(" ");
          return (
            <path
              key={c.canal}
              d={d}
              stroke={hot ? "var(--danger)" : "#7cc4b8"}
              strokeWidth={hot ? 4 : 3}
              strokeDasharray={hot ? "6 4" : undefined}
              fill="none"
              strokeLinecap="round"
            />
          );
        })}

        {villages.map((v) => (
          <g key={v.name}>
            <circle cx={v.vx} cy={v.vy} r={3} fill="var(--ink-2)" />
            <text x={v.vx - 6} y={v.vy + 4} fontSize="11" fontWeight="700" fill="var(--ink)" textAnchor="end">
              {v.name}
            </text>
          </g>
        ))}

        {ponds.map((p) => {
          const at = pos.get(p.id);
          if (!at) return null;
          return (
            <g key={p.id}>
              {noticedPonds.has(p.id) && <circle cx={at.cx} cy={at.cy} r={11} fill="none" stroke="var(--danger)" strokeWidth={2} strokeDasharray="3 2" />}
              <circle cx={at.cx} cy={at.cy} r={7} fill={RISK_COLOR[p.latest_risk]} stroke="#fff" strokeWidth={2}>
                <title>{`${p.name} · ${RISK_LABEL[p.latest_risk]}${noticedPonds.has(p.id) ? " · outbreak notice" : ""}`}</title>
              </circle>
            </g>
          );
        })}
      </svg>
      <figcaption className="legend" style={{ marginTop: 8, justifyContent: "center" }}>
        {(["safe", "watch", "danger", "unknown"] as const).map((k) => (
          <span key={k} className="legend-item">
            <span className="swatch" style={{ background: RISK_COLOR[k], borderRadius: "50%" }} /> {RISK_LABEL[k]}
          </span>
        ))}
        <span className="legend-item">
          <span className="swatch" style={{ background: "transparent", border: "2px dashed var(--danger)", borderRadius: "50%" }} /> Outbreak notice
        </span>
        <span className="legend-item">
          <span className="swatch" style={{ background: "var(--danger)", height: 3 }} /> Canal with possible outbreak
        </span>
      </figcaption>
      <p className="tiny muted" style={{ textAlign: "center", marginTop: 6 }}>
        Schematic: approximate village locations and a simplified coastline. Ponds are drawn around their village, not at exact positions.
      </p>
      {unplaced.length > 0 && (
        <p className="tiny muted" style={{ textAlign: "center" }}>
          Not on the map (village location unknown): {unplaced.join(", ")}.
        </p>
      )}
      <ul className="sr-only">
        {ponds.map((p) => (
          <li key={p.id}>
            <Link href={`/ponds/${p.id}`}>{p.name}</Link>
          </li>
        ))}
      </ul>
    </figure>
  );
}
