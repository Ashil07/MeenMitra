"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { api } from "@/api";
import type { AlertKind, AlertStatus, RiskLevel } from "@/api/types";
import { AlertDetail } from "@/components/AlertDetail";
import { PageHeader } from "@/components/PageHeader";
import { RISK_LABEL, RiskBadge } from "@/components/RiskBadge";
import { EmptyState, ErrorState, LoadingState, Notice } from "@/components/States";
import { SimulatedTag } from "@/components/Tags";
import { ALERT_KIND_LABEL, ALERT_STATUS_LABEL } from "@/lib/labels";
import { formatRelative } from "@/lib/time";
import { useApiQuery } from "@/lib/useApi";

export default function AlertsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Farmer messaging"
        title="Alert centre"
        sub="Kannada alerts with English translation. Choose a channel, simulate delivery and record the farmer's reply."
      />
      <Notice tone="info" title="Simulation only.">
        Messaging uses a mock provider. No WhatsApp message, SMS or phone call is sent to anyone, and delivery statuses are simulated.
      </Notice>
      <Suspense fallback={<LoadingState />}>
        <AlertCentre />
      </Suspense>
    </>
  );
}

function AlertCentre() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const detailRef = useRef<HTMLDivElement>(null);

  const selectedId = search.get("id");
  const status = (search.get("status") ?? "") as AlertStatus | "";
  const risk = (search.get("risk") ?? "") as RiskLevel | "";
  const kind = (search.get("kind") ?? "") as AlertKind | "";
  const pondId = search.get("pond") ?? "";

  const ponds = useApiQuery(() => api.listPonds(), []);
  const alerts = useApiQuery(
    () => api.listAlerts({ status: status || undefined, risk: risk || undefined, kind: kind || undefined, pond_id: pondId || undefined }),
    [status, risk, kind, pondId],
  );
  const selected = alerts.data?.find((a) => a.id === selectedId) ?? null;
  // An alert linked directly by id may be filtered out of the list; fetch it on its own.
  const direct = useApiQuery(() => (selectedId && !selected ? api.getAlert(selectedId) : Promise.resolve(null)), [selectedId, !!selected]);
  const shown = selected ?? direct.data ?? null;

  const setParam = (k: string, v: string) => {
    const sp = new URLSearchParams(search.toString());
    if (v) sp.set(k, v);
    else sp.delete(k);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (selectedId && window.matchMedia("(max-width: 1100px)").matches) detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedId]);

  return (
    <>
      <section className="card flat" aria-label="Filter alerts">
        <div className="filters">
          <div className="field">
            <label className="label" htmlFor="f-pond">
              Pond
            </label>
            <select id="f-pond" className="select" value={pondId} onChange={(e) => setParam("pond", e.target.value)}>
              <option value="">All ponds</option>
              {ponds.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="f-status">
              Status
            </label>
            <select id="f-status" className="select" value={status} onChange={(e) => setParam("status", e.target.value)}>
              <option value="">Any status</option>
              {(Object.keys(ALERT_STATUS_LABEL) as AlertStatus[]).map((s) => (
                <option key={s} value={s}>
                  {ALERT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="f-risk">
              Risk
            </label>
            <select id="f-risk" className="select" value={risk} onChange={(e) => setParam("risk", e.target.value)}>
              <option value="">Any risk</option>
              {(["danger", "watch", "safe"] as RiskLevel[]).map((r) => (
                <option key={r} value={r}>
                  {RISK_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="f-kind">
              Type
            </label>
            <select id="f-kind" className="select" value={kind} onChange={(e) => setParam("kind", e.target.value)}>
              <option value="">Any type</option>
              {(Object.keys(ALERT_KIND_LABEL) as AlertKind[]).map((k) => (
                <option key={k} value={k}>
                  {ALERT_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <div className="grid grid-main" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr)" }}>
        <section className="card" aria-labelledby="alert-list-h">
          <div className="card-head">
            <h2 id="alert-list-h">History</h2>
            {alerts.data && <span className="small muted">{alerts.data.length} alerts</span>}
          </div>
          {alerts.loading && !alerts.data && <LoadingState label="Loading alerts" />}
          {!!alerts.error && <ErrorState error={alerts.error} onRetry={alerts.reload} title="Could not load alerts" />}
          {alerts.data && !alerts.error && alerts.data.length === 0 && (
            <EmptyState icon="alert" title="No alerts match" body="Create an alert from a forecast or a water check, or clear the filters." />
          )}
          {alerts.data && !alerts.error && alerts.data.length > 0 && (
            <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {alerts.data.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className="attn"
                    style={{ width: "100%", textAlign: "left", cursor: "pointer", ...(a.id === shown?.id ? { borderColor: "var(--brand-2)", boxShadow: "0 0 0 3px rgba(61,181,169,.2)" } : {}) }}
                    aria-current={a.id === shown?.id ? "true" : undefined}
                    onClick={() => setParam("id", a.id)}
                  >
                    <RiskBadge level={a.risk_level} />
                    <span className="attn-main">
                      <strong>{a.title}</strong>
                      <span className="small muted">
                        {ALERT_KIND_LABEL[a.kind]} · {ALERT_STATUS_LABEL[a.status]} · {formatRelative(a.created_at)}
                      </span>
                    </span>
                    {a.deliveries.some((d) => d.simulated) && <SimulatedTag />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" ref={detailRef} aria-label="Alert details" style={{ scrollMarginTop: 72 }}>
          {shown ? (
            <AlertDetail
              key={shown.id}
              alert={shown}
              onUpdated={(updated) => {
                if (alerts.data) alerts.setData(alerts.data.map((a) => (a.id === updated.id ? updated : a)));
                if (!selected) direct.setData(updated);
              }}
            />
          ) : selectedId && direct.loading ? (
            <LoadingState label="Loading alert" />
          ) : selectedId && direct.error ? (
            <ErrorState error={direct.error} onRetry={direct.reload} title="Could not load this alert" />
          ) : (
            <EmptyState icon="alert" title="Select an alert" body="Pick an alert from the history to preview the message, simulate delivery and record the farmer's reply." />
          )}
        </section>
      </div>
    </>
  );
}
