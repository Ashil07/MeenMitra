"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { api } from "@/api";
import type { Pond } from "@/api/types";
import { AlertRow } from "@/components/AlertRow";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { ForecastExplorer } from "@/components/ForecastExplorer";
import { Icon } from "@/components/Icon";
import { PageHeader } from "@/components/PageHeader";
import { RiskBadge } from "@/components/RiskBadge";
import { EmptyState, ErrorState, LoadingState, Notice } from "@/components/States";
import { TabPanel, Tabs } from "@/components/Tabs";
import { SourceTag } from "@/components/Tags";
import { WaterCheckForm, WaterCheckHistory } from "@/components/WaterCheck";
import { ALGAE_LABEL, SPECIES_LABEL, fmtInt, maskPhone } from "@/lib/labels";
import { daysBetween, formatDate, formatDateTime, formatRelative } from "@/lib/time";
import { useApiQuery } from "@/lib/useApi";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "forecast", label: "Forecast" },
  { id: "water", label: "Water checks" },
  { id: "alerts", label: "Alerts" },
  { id: "feedback", label: "Check-in" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function PondDetailPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading pond" />}>
      <PondDetail />
    </Suspense>
  );
}

function PondDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const search = useSearchParams();
  const router = useRouter();
  const tabParam = search.get("tab");
  const tab: TabId = TABS.some((t) => t.id === tabParam) ? (tabParam as TabId) : "overview";
  const created = search.get("created") === "1";
  const saved = search.get("saved") === "1";

  const pond = useApiQuery(() => api.getPond(id), [id]);

  const setTab = (t: TabId) => {
    const sp = new URLSearchParams(search.toString());
    sp.set("tab", t);
    sp.delete("created");
    sp.delete("saved");
    router.replace(`/ponds/${id}?${sp.toString()}`, { scroll: false });
  };

  if (pond.loading && !pond.data) return <LoadingState label="Loading pond" rows={6} />;
  if (pond.error)
    return (
      <div className="card">
        <ErrorState error={pond.error} onRetry={pond.reload} title="Could not load this pond" />
        <div className="row" style={{ justifyContent: "center" }}>
          <Link href="/ponds" className="btn ghost">
            <Icon name="back" /> Back to ponds
          </Link>
        </div>
      </div>
    );
  const p = pond.data!;

  return (
    <>
      <PageHeader
        crumbs={[
          { href: "/ponds", label: "Ponds" },
          { href: `/ponds/${p.id}`, label: p.name },
        ]}
        eyebrow={`${p.village} · ${p.canal}`}
        title={
          <span className="row" style={{ gap: 14 }}>
            {p.name} <RiskBadge level={p.latest_risk} size="lg" />
          </span>
        }
        sub={`${p.farmer_name} · ${SPECIES_LABEL[p.species]} · ${fmtInt(p.fish_count)} fish · ${fmtInt(p.area_m2)} m²`}
        actions={
          <>
            <Link href={`/ponds/${p.id}/edit`} className="btn">
              <Icon name="edit" /> Edit pond
            </Link>
            <button type="button" className="btn primary" onClick={() => setTab("forecast")}>
              <Icon name="forecast" /> Forecast tonight
            </button>
          </>
        }
      />

      {created && <Notice tone="success" title="Pond registered.">Run its first overnight forecast from the Forecast tab.</Notice>}
      {saved && <Notice tone="success">Pond details saved.</Notice>}

      <Tabs tabs={[...TABS]} value={tab} onChange={setTab} label="Pond sections" idPrefix="pond" />

      {tab === "overview" && (
        <TabPanel idPrefix="pond" id="overview">
          <Overview pond={p} onGo={setTab} />
        </TabPanel>
      )}
      {tab === "forecast" && (
        <TabPanel idPrefix="pond" id="forecast">
          <ForecastExplorer pond={p} onChange={pond.reload} />
        </TabPanel>
      )}
      {tab === "water" && (
        <TabPanel idPrefix="pond" id="water">
          <WaterTab pond={p} onChange={pond.reload} />
        </TabPanel>
      )}
      {tab === "alerts" && (
        <TabPanel idPrefix="pond" id="alerts">
          <AlertsTab pondId={p.id} />
        </TabPanel>
      )}
      {tab === "feedback" && (
        <TabPanel idPrefix="pond" id="feedback">
          <FeedbackPanel pond={p} onUpdated={pond.reload} />
        </TabPanel>
      )}
    </>
  );
}

function Overview({ pond: p, onGo }: { pond: Pond; onGo: (t: TabId) => void }) {
  const ageDays = daysBetween(p.stocking_date);
  return (
    <div className="grid grid-main">
      <section className="card" aria-labelledby="profile-h">
        <div className="card-head">
          <h2 id="profile-h">Pond profile</h2>
          <SourceTag source={p.data_source} />
        </div>
        <dl className="kv">
          <dt>Farmer</dt>
          <dd>{p.farmer_name}</dd>
          <dt>Mobile</dt>
          <dd className="mono">{maskPhone(p.phone)}</dd>
          <dt>Village</dt>
          <dd>{p.village}</dd>
          <dt>Canal</dt>
          <dd>{p.canal}</dd>
          <dt>Size</dt>
          <dd>
            {fmtInt(p.area_m2)} m² ({(p.area_m2 / 4046.86).toFixed(2)} acre) × {p.depth_m} m deep
          </dd>
          <dt>Species</dt>
          <dd>{SPECIES_LABEL[p.species]}</dd>
          <dt>Stocked</dt>
          <dd>
            {formatDate(p.stocking_date)} ({ageDays} days ago)
          </dd>
          <dt>Fish stocked</dt>
          <dd>{fmtInt(p.fish_count)}</dd>
          <dt>Water colour</dt>
          <dd>{ALGAE_LABEL[p.algae_level]}</dd>
          <dt>Aerator</dt>
          <dd>{p.has_aerator ? "Yes" : "No"}</dd>
          <dt>Registered</dt>
          <dd>{formatDateTime(p.created_at)}</dd>
        </dl>
      </section>
      <div className="stack" style={{ gap: 20 }}>
        <section className="card" aria-labelledby="status-h">
          <h2 id="status-h" style={{ marginBottom: 12 }}>
            Current status
          </h2>
          <div className="stack">
            <RiskBadge level={p.latest_risk} size="lg" />
            <p className="small muted">
              {p.latest_risk_at
                ? `From the latest ${p.latest_risk_source === "forecast" ? "oxygen forecast" : "water check"}, ${formatRelative(p.latest_risk_at)}.`
                : "No forecast or water check yet."}
            </p>
            <div className="row">
              <button type="button" className="btn primary" onClick={() => onGo("forecast")}>
                <Icon name="forecast" /> Forecast
              </button>
              <button type="button" className="btn" onClick={() => onGo("water")}>
                <Icon name="water" /> Check water
              </button>
            </div>
          </div>
        </section>
        <section className="card tint" aria-labelledby="calib-h">
          <h3 id="calib-h" style={{ marginBottom: 8 }}>
            Per-pond learning
          </h3>
          <p className="small">
            Oxygen-use factor <strong>{p.oxygen_use_factor.toFixed(2)}</strong> from {p.feedback_count} morning repl{p.feedback_count === 1 ? "y" : "ies"}.
          </p>
          <button type="button" className="btn sm" style={{ marginTop: 10 }} onClick={() => onGo("feedback")}>
            Record a check-in
          </button>
        </section>
      </div>
    </div>
  );
}

function WaterTab({ pond, onChange }: { pond: Pond; onChange: () => void }) {
  const history = useApiQuery(() => api.listWaterChecks(pond.id), [pond.id]);
  return (
    <>
      <WaterCheckForm
        pond={pond}
        onSubmitted={() => {
          history.reload();
          onChange();
        }}
      />
      <section className="card" aria-labelledby="hist-h">
        <div className="card-head">
          <h2 id="hist-h">Reading history</h2>
        </div>
        {history.loading && !history.data && <LoadingState />}
        {!!history.error && <ErrorState error={history.error} onRetry={history.reload} />}
        {history.data && !history.error && <WaterCheckHistory checks={history.data} />}
      </section>
    </>
  );
}

function AlertsTab({ pondId }: { pondId: string }) {
  const q = useApiQuery(() => api.listAlerts({ pond_id: pondId }), [pondId]);
  return (
    <section className="card" aria-labelledby="pond-alerts-h">
      <div className="card-head">
        <h2 id="pond-alerts-h">Alerts for this pond</h2>
        <Link href={`/alerts?pond=${encodeURIComponent(pondId)}`} className="btn sm">
          Open in alert centre
        </Link>
      </div>
      {q.loading && !q.data && <LoadingState />}
      {!!q.error && <ErrorState error={q.error} onRetry={q.reload} />}
      {q.data && !q.error && (q.data.length === 0 ? <EmptyState icon="alert" title="No alerts yet" body="Create one from a forecast or a water check." /> : <div className="stack">{q.data.map((a) => <AlertRow key={a.id} alert={a} />)}</div>)}
    </section>
  );
}
