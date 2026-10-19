"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/api";
import type { PondRiskLevel } from "@/api/types";
import { Icon } from "@/components/Icon";
import { PageHeader } from "@/components/PageHeader";
import { RISK_LABEL, RiskBadge } from "@/components/RiskBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { SourceTag } from "@/components/Tags";
import { SPECIES_LABEL, fmtInt } from "@/lib/labels";
import { formatRelative } from "@/lib/time";
import { useApiQuery } from "@/lib/useApi";

const FILTERS: ("all" | PondRiskLevel)[] = ["all", "danger", "watch", "safe", "unknown"];

export default function PondsPage() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [risk, setRisk] = useState<"all" | PondRiskLevel>("all");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const q = useApiQuery(() => api.listPonds({ search: debounced || undefined, risk: risk === "all" ? undefined : risk }), [debounced, risk]);
  const filtered = debounced || risk !== "all";

  return (
    <>
      <PageHeader
        eyebrow="Pond management"
        title="Ponds"
        sub="Every registered pond with its latest risk status from tonight's forecast or the most recent water check."
        actions={
          <Link href="/ponds/new" className="btn primary">
            <Icon name="plus" /> Register pond
          </Link>
        }
      />

      <section className="card flat" aria-label="Filter ponds">
        <div className="filters">
          <div className="field grow">
            <label className="label" htmlFor="pond-search">
              Search
            </label>
            <div className="input-wrap">
              <input
                id="pond-search"
                className="input"
                type="search"
                placeholder="Pond, farmer, village or canal"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="field" style={{ minWidth: 0 }}>
            <span className="label" id="risk-filter-label">
              Risk status
            </span>
            <div className="segmented" role="radiogroup" aria-labelledby="risk-filter-label">
              {FILTERS.map((f) => (
                <label key={f}>
                  <input type="radio" name="risk" value={f} checked={risk === f} onChange={() => setRisk(f)} />
                  {f === "all" ? "All" : RISK_LABEL[f]}
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      {q.loading && !q.data && (
        <div className="card">
          <LoadingState label="Loading ponds" />
        </div>
      )}
      {!!q.error && (
        <div className="card">
          <ErrorState error={q.error} onRetry={q.reload} title="Could not load ponds" />
        </div>
      )}
      {q.data && !q.error && (
        <>
          <p className="small muted" aria-live="polite">
            {q.data.length} pond{q.data.length === 1 ? "" : "s"}
            {filtered ? " match your filters" : ""}
            {q.loading ? " · updating…" : ""}
          </p>
          {q.data.length === 0 ? (
            <div className="card">
              {filtered ? (
                <EmptyState
                  icon="search"
                  title="No ponds match"
                  body="Try a different search or clear the risk filter."
                  action={
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        setSearch("");
                        setRisk("all");
                      }}
                    >
                      Clear filters
                    </button>
                  }
                />
              ) : (
                <EmptyState
                  title="No ponds registered yet"
                  body="Register the first pond to start getting overnight oxygen forecasts."
                  action={
                    <Link href="/ponds/new" className="btn primary">
                      Register pond
                    </Link>
                  }
                />
              )}
            </div>
          ) : (
            <ul className="pond-grid" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {q.data.map((p) => (
                <li key={p.id}>
                  <Link href={`/ponds/${p.id}`} className={`pond-card ${p.latest_risk}`}>
                    <div className="row between">
                      <h3>{p.name}</h3>
                      <RiskBadge level={p.latest_risk} />
                    </div>
                    <div className="pond-meta">
                      <span>{p.farmer_name}</span>
                      <span>{p.village}</span>
                      <span>{p.canal}</span>
                    </div>
                    <dl className="kv small">
                      <dt>Species</dt>
                      <dd>{SPECIES_LABEL[p.species]}</dd>
                      <dt>Stock</dt>
                      <dd>
                        {fmtInt(p.fish_count)} fish · {fmtInt(p.area_m2)} m²
                      </dd>
                      <dt>Last check</dt>
                      <dd>
                        {p.latest_risk_at
                          ? `${p.latest_risk_source === "forecast" ? "Forecast" : "Water check"}, ${formatRelative(p.latest_risk_at)}`
                          : "Not checked yet"}
                      </dd>
                    </dl>
                    <div className="row between">
                      <SourceTag source={p.data_source} />
                      <span className="small" style={{ color: "var(--brand-2)", fontWeight: 700 }}>
                        Open <Icon name="arrow" size={14} style={{ verticalAlign: "-2px" }} />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
