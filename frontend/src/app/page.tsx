"use client";

import Link from "next/link";
import { api } from "@/api";
import type { Forecast } from "@/api/types";
import { AlertRow } from "@/components/AlertRow";
import { ForecastChart } from "@/components/ForecastChart";
import { Icon } from "@/components/Icon";
import { NightlyRun } from "@/components/NightlyRun";
import { PageHeader } from "@/components/PageHeader";
import { RiskBadge } from "@/components/RiskBadge";
import { RiskDistribution, RiskTrend } from "@/components/RiskCharts";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { EstimateTag, SourceTag } from "@/components/Tags";
import { SPECIES_LABEL } from "@/lib/labels";
import { formatClock, formatDateTime, formatRelative } from "@/lib/time";
import { useApiQuery } from "@/lib/useApi";

export default function DashboardPage() {
  const q = useApiQuery(() => api.getDashboard(), []);

  return (
    <>
      <PageHeader
        eyebrow="Tonight's overview"
        title="Pond dashboard"
        sub="Which ponds may run short of oxygen tonight, what farmers have reported, and which alerts still need a reply."
        actions={
          <>
            <Link href="/ponds/new" className="btn">
              <Icon name="plus" /> Register pond
            </Link>
            <Link href="/forecast" className="btn primary">
              <Icon name="forecast" /> Run a forecast
            </Link>
          </>
        }
      />

      {q.loading && !q.data && (
        <div className="card">
          <LoadingState label="Loading dashboard" rows={5} />
        </div>
      )}
      {!!q.error && (
        <div className="card">
          <ErrorState error={q.error} onRetry={q.reload} title="Could not load the dashboard" />
        </div>
      )}

      {q.data && !q.error && (
        <>
          <div className="row small muted">
            <SourceTag source={q.data.data_source} />
            <span>Updated {formatDateTime(q.data.generated_at)}</span>
            <button type="button" className="btn sm ghost" onClick={q.reload} disabled={q.loading}>
              <Icon name="refresh" size={14} /> Refresh
            </button>
          </div>

          <section aria-label="Pond counts" className="grid grid-4">
            <div className="stat primary">
              <div className="stat-label">
                <Icon name="pond" size={16} /> Monitored ponds
              </div>
              <div className="stat-value">{q.data.total_ponds}</div>
              <div className="stat-note">{q.data.counts.unknown} not yet checked</div>
            </div>
            {(["safe", "watch", "danger"] as const).map((k) => (
              <div key={k} className={`stat ${k}`}>
                <div className="stat-label">
                  <RiskBadge level={k} />
                </div>
                <div className="stat-value">{q.data!.counts[k]}</div>
                <div className="stat-note">
                  {k === "danger" ? "Act before midnight" : k === "watch" ? "Prepare aerators, cut feed" : "Normal routine"}
                </div>
              </div>
            ))}
          </section>

          <NightlyRun onDone={q.reload} />

          <div className="grid grid-main">
            <section className="card" aria-labelledby="featured-h">
              <div className="card-head">
                <div>
                  <h2 id="featured-h">Forecast timeline</h2>
                  <p>
                    {q.data.featured_forecast
                      ? "Highest-risk pond tonight, 6 PM → 8 AM."
                      : "No forecasts yet. Run one from the forecast explorer."}
                  </p>
                </div>
                {q.data.featured_forecast && (
                  <div className="row">
                    <EstimateTag />
                    <RiskBadge level={q.data.featured_forecast.summary.risk_level} />
                  </div>
                )}
              </div>
              {q.data.featured_forecast ? (
                <FeaturedForecast forecast={q.data.featured_forecast} />
              ) : (
                <EmptyState
                  icon="forecast"
                  title="No forecast to show"
                  action={
                    <Link className="btn primary" href="/forecast">
                      Open forecast explorer
                    </Link>
                  }
                />
              )}
            </section>

            <section className="card" aria-labelledby="attn-h">
              <div className="card-head">
                <div>
                  <h2 id="attn-h">Needs attention</h2>
                  <p>Watch and Danger ponds, most severe first.</p>
                </div>
              </div>
              {q.data.attention.length === 0 ? (
                <EmptyState icon="shield" title="All clear" body="No pond is at Watch or Danger right now." />
              ) : (
                <div className="stack">
                  {q.data.attention.map((p) => (
                    <Link key={p.id} href={`/ponds/${p.id}`} className="attn">
                      <RiskBadge level={p.latest_risk} />
                      <span className="attn-main">
                        <strong>{p.name}</strong>
                        <span className="small muted">
                          {p.village} · {SPECIES_LABEL[p.species]} ·{" "}
                          {p.latest_risk_source === "forecast" ? "oxygen forecast" : "water check"} {formatRelative(p.latest_risk_at)}
                        </span>
                      </span>
                      <Icon name="arrow" />
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="grid grid-3">
            <section className="card" aria-labelledby="dist-h">
              <div className="card-head">
                <h2 id="dist-h">Risk distribution</h2>
              </div>
              <RiskDistribution counts={q.data.counts} />
            </section>
            <section className="card" aria-labelledby="trend-h">
              <div className="card-head">
                <div>
                  <h2 id="trend-h">Recent trend</h2>
                  <p>Ponds per risk level, last {q.data.trend.length} days.</p>
                </div>
                {q.data.data_source === "demo" && <span className="tag demo">Illustrative</span>}
              </div>
              {q.data.trend.length ? <RiskTrend trend={q.data.trend} /> : <p className="muted small">No history yet.</p>}
            </section>
            <section className="card" aria-labelledby="alerts-h">
              <div className="card-head">
                <h2 id="alerts-h">Latest alerts</h2>
                <Link href="/alerts" className="btn sm ghost">
                  All alerts <Icon name="arrow" size={14} />
                </Link>
              </div>
              {q.data.recent_alerts.length === 0 ? (
                <p className="muted small">No alerts yet.</p>
              ) : (
                <div className="stack">
                  {q.data.recent_alerts.map((a) => (
                    <AlertRow key={a.id} alert={a} />
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}

function FeaturedForecast({ forecast: f }: { forecast: Forecast }) {
  return (
    <div className="stack">
      <ForecastChart forecast={f} compact />
      <div className="row between small">
        <span>
          Lowest estimate <strong>{f.summary.min_estimated_do_mg_l} mg/L</strong> around <strong>{formatClock(f.summary.min_time)}</strong>
          {f.summary.aerator_start_time && (
            <>
              {" "}
              · start aerator by <strong>{formatClock(f.summary.aerator_start_time)}</strong>
            </>
          )}
        </span>
        <Link href={`/ponds/${f.pond_id}?tab=forecast`} className="btn sm">
          Open pond <Icon name="arrow" size={14} />
        </Link>
      </div>
    </div>
  );
}
