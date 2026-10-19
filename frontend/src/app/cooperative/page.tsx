"use client";

import Link from "next/link";
import { api } from "@/api";
import type { PondSummary } from "@/api/types";
import { Icon } from "@/components/Icon";
import { PageHeader } from "@/components/PageHeader";
import { RISK_COLOR, RISK_LABEL, RiskBadge } from "@/components/RiskBadge";
import { RiskDistribution } from "@/components/RiskCharts";
import { EmptyState, ErrorState, LoadingState, Notice } from "@/components/States";
import { SourceTag } from "@/components/Tags";
import { SYMPTOM_LABEL } from "@/lib/labels";
import { formatDateTime, formatRelative } from "@/lib/time";
import { useApiQuery } from "@/lib/useApi";

export default function CooperativePage() {
  const q = useApiQuery(() => api.getCooperative(), []);

  return (
    <>
      <PageHeader
        eyebrow="Fisheries cooperative"
        title="Cooperative dashboard"
        sub="Every member pond's status, grouped by shared canal, so aerators and officer visits go where the risk is highest tonight."
        actions={
          <button type="button" className="btn" onClick={q.reload} disabled={q.loading}>
            <Icon name="refresh" /> Refresh
          </button>
        }
      />

      {q.loading && !q.data && (
        <div className="card">
          <LoadingState rows={5} />
        </div>
      )}
      {!!q.error && (
        <div className="card">
          <ErrorState error={q.error} onRetry={q.reload} title="Could not load the cooperative overview" />
        </div>
      )}

      {q.data && !q.error && (
        <>
          <div className="row small muted">
            <SourceTag source={q.data.data_source} /> Updated {formatDateTime(q.data.generated_at)} · Farmer names are hidden in reports.
          </div>

          <div className="grid grid-main">
            <section className="card" aria-labelledby="prio-h">
              <div className="card-head">
                <div>
                  <h2 id="prio-h">Follow-up priority</h2>
                  <p>Danger first, then Watch.</p>
                </div>
              </div>
              {q.data.priority.length === 0 ? (
                <EmptyState icon="shield" title="No ponds need follow-up" />
              ) : (
                <ol className="stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {q.data.priority.map((p, i) => (
                    <li key={p.id}>
                      <Link href={`/ponds/${p.id}`} className="attn">
                        <span className="mono muted" aria-hidden="true">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <RiskBadge level={p.latest_risk} />
                        <span className="attn-main">
                          <strong>
                            {p.name} · {p.village}
                          </strong>
                          <span className="small muted">{p.reason}</span>
                        </span>
                        <Icon name="arrow" />
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="card" aria-labelledby="dist-h">
              <div className="card-head">
                <h2 id="dist-h">Risk distribution</h2>
              </div>
              <RiskDistribution counts={q.data.counts} />
            </section>
          </div>

          <section className="card" aria-labelledby="cluster-h">
            <div className="card-head">
              <div>
                <h2 id="cluster-h">Possible outbreak clusters</h2>
                <p>Ponds on the same canal reporting possible disease signs. These are farmer observations, not confirmed diagnoses.</p>
              </div>
            </div>
            {q.data.clusters.length === 0 ? (
              <p className="small muted">No clusters detected from recent reports.</p>
            ) : (
              <div className="grid grid-2">
                {q.data.clusters.map((c) => (
                  <div key={c.id} className="card flat" style={{ borderColor: "var(--watch-line)", background: "var(--watch-bg)" }}>
                    <div className="row between">
                      <h3>{c.canal}</h3>
                      <span className="badge watch">{c.status === "possible" ? "Possible — not confirmed" : c.status === "confirmed" ? "Confirmed by officer" : "Dismissed"}</span>
                    </div>
                    <p className="small" style={{ marginTop: 8 }}>
                      {c.report_count} report{c.report_count === 1 ? "" : "s"} from {c.pond_count} ponds · {formatRelative(c.first_reported_at)} – {formatRelative(c.last_reported_at)}
                    </p>
                    <p className="small" style={{ marginTop: 6 }}>
                      Signs: {c.symptoms.map((s) => SYMPTOM_LABEL[s]).join(", ")}
                    </p>
                    <p className="small muted" style={{ marginTop: 6 }}>
                      {c.note}
                    </p>
                    {q.data!.data_source === "demo" && (
                      <span className="tag demo" style={{ marginTop: 10 }}>
                        Demo observation
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="canal-h" className="stack" style={{ gap: 14 }}>
            <div className="row between">
              <h2 id="canal-h">Ponds by canal</h2>
              <span className="small muted">Schematic grouping — not a map. No coordinates are stored.</span>
            </div>
            <div className="grid grid-3">
              {q.data.canals.map((c) => (
                <CanalCard key={c.canal} canal={c.canal} ponds={c.ponds} />
              ))}
            </div>
          </section>

          <section className="card" aria-labelledby="reports-h">
            <div className="card-head">
              <div>
                <h2 id="reports-h">Recent farmer reports</h2>
                <p>Anonymised water checks and morning check-ins.</p>
              </div>
            </div>
            {q.data.recent_reports.length === 0 ? (
              <p className="small muted">No reports yet.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Canal</th>
                      <th>Village</th>
                      <th>Type</th>
                      <th>Summary</th>
                      <th>Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.data.recent_reports.map((r) => (
                      <tr key={r.id}>
                        <td>{formatRelative(r.created_at)}</td>
                        <td>{r.canal}</td>
                        <td>{r.village}</td>
                        <td>{r.kind === "water_check" ? "Water check" : "Check-in"}</td>
                        <td style={{ whiteSpace: "normal", minWidth: 200 }}>{r.summary}</td>
                        <td>
                          <RiskBadge level={r.risk_level} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <Notice tone="info">Outbreak notices tell neighbouring farmers that signs were reported on their canal without naming the reporting farm.</Notice>
        </>
      )}
    </>
  );
}

function CanalCard({ canal, ponds }: { canal: string; ponds: PondSummary[] }) {
  const W = 300;
  const gap = W / (ponds.length + 1);
  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 10 }}>
        <h3>{canal}</h3>
        <span className="small muted">{ponds.length} ponds</span>
      </div>
      <svg viewBox={`0 0 ${W} 64`} className="chart" role="img" aria-label={`${canal}: ${ponds.map((p) => `${p.name} ${RISK_LABEL[p.latest_risk]}`).join(", ")}`}>
        <path d={`M0 32 C ${W * 0.25} 18, ${W * 0.5} 46, ${W} 30`} stroke="#9bd3ca" strokeWidth={8} fill="none" strokeLinecap="round" />
        {ponds.map((p, i) => (
          <g key={p.id}>
            <circle cx={gap * (i + 1)} cy={32} r={11} fill={RISK_COLOR[p.latest_risk]} stroke="#fff" strokeWidth={3} />
          </g>
        ))}
      </svg>
      <ul className="list" style={{ marginTop: 8 }}>
        {ponds.map((p) => (
          <li key={p.id} className="row between">
            <Link href={`/ponds/${p.id}`}>{p.name}</Link>
            <RiskBadge level={p.latest_risk} />
          </li>
        ))}
      </ul>
    </div>
  );
}
