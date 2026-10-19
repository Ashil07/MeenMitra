"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { api } from "@/api";
import type { Pond } from "@/api/types";
import { useApiQuery } from "@/lib/useApi";
import { RISK_LABEL } from "./RiskBadge";
import { EmptyState, ErrorState, LoadingState } from "./States";

/** Pond selector synced to ?pond=… that renders `children(pond)` for the chosen pond. */
export function PondPicker({ children, reloadKey }: { children: (pond: Pond, reload: () => void) => ReactNode; reloadKey?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const ponds = useApiQuery(() => api.listPonds(), []);
  const selectedId = search.get("pond") ?? ponds.data?.[0]?.id ?? null;
  const pond = useApiQuery(() => (selectedId ? api.getPond(selectedId) : Promise.resolve(null)), [selectedId, reloadKey]);

  if (ponds.loading && !ponds.data) return <LoadingState label="Loading ponds" />;
  if (ponds.error) return <ErrorState error={ponds.error} onRetry={ponds.reload} title="Could not load ponds" />;
  if (!ponds.data?.length)
    return (
      <div className="card">
        <EmptyState
          title="No ponds yet"
          body="Register a pond first."
          action={
            <Link href="/ponds/new" className="btn primary">
              Register pond
            </Link>
          }
        />
      </div>
    );

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="card flat">
        <div className="filters">
          <div className="field grow">
            <label className="label" htmlFor="pond-picker">
              Pond
            </label>
            <select
              id="pond-picker"
              className="select"
              value={selectedId ?? ""}
              onChange={(e) => router.replace(`${pathname}?pond=${encodeURIComponent(e.target.value)}`, { scroll: false })}
            >
              {ponds.data.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.village} ({RISK_LABEL[p.latest_risk]})
                </option>
              ))}
            </select>
          </div>
          {selectedId && (
            <Link href={`/ponds/${selectedId}`} className="btn">
              Pond details
            </Link>
          )}
        </div>
      </div>
      {pond.loading && !pond.data && <LoadingState label="Loading pond" />}
      {!!pond.error && <ErrorState error={pond.error} onRetry={pond.reload} title="Could not load this pond" />}
      {pond.data && !pond.error && <div key={pond.data.id}>{children(pond.data, pond.reload)}</div>}
    </div>
  );
}
