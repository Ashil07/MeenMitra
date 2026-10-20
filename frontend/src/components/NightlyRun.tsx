"use client";

import Link from "next/link";
import { useState } from "react";
import { api, describeError } from "@/api";
import type { Forecast, PondSummary, ScenarioId } from "@/api/types";
import { OPEN_METEO_ATTRIBUTION, fetchVillageWeather } from "@/lib/liveWeather";
import { VALUE_NOTE, fishValueInr, formatInr } from "@/lib/value";
import { Icon } from "./Icon";
import { RiskBadge } from "./RiskBadge";
import { Notice, Spinner } from "./States";

type Source = "live" | ScenarioId;

interface Row {
  pond: PondSummary;
  state: "waiting" | "running" | "done" | "error";
  forecast?: Forecast;
  alert?: "drafted" | "already_drafted" | "not_needed";
  alertId?: string;
  error?: string;
}

const SOURCES: { id: Source; label: string }[] = [
  { id: "live", label: "Live weather (Open-Meteo)" },
  { id: "normal", label: "Normal night" },
  { id: "cloudy_hot", label: "Cloudy, hot night" },
  { id: "high_risk", label: "High-risk night" },
];

const DRAFT_WINDOW_MS = 12 * 3_600_000;

/**
 * Demo of the nightly job: in production this runs automatically at 5 PM for every pond.
 * Here it is started by hand. It forecasts each pond and drafts an alert for every Watch or
 * Danger pond. Sending those alerts is a separate step (WhatsApp / SMS / voice).
 */
export function NightlyRun({ onDone }: { onDone: () => void }) {
  const [source, setSource] = useState<Source>("live");
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [fatal, setFatal] = useState<unknown>(null);

  const update = (id: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.pond.id === id ? { ...r, ...patch } : r)));

  async function runAll() {
    setRunning(true);
    setFatal(null);
    try {
      const ponds = await api.listPonds();
      setRows(ponds.map((pond) => ({ pond, state: "waiting" })));
      for (const pond of ponds) {
        update(pond.id, { state: "running" });
        try {
          let forecast: Forecast;
          if (source === "live") {
            const live = await fetchVillageWeather(pond.village);
            forecast = await api.runForecast(pond.id, {
              scenario_id: "normal",
              weather_overrides: live.weather,
              feeding_this_evening: true,
              live_weather: live.info,
            });
          } else {
            forecast = await api.runForecast(pond.id, { scenario_id: source, feeding_this_evening: true });
          }
          let alert: Row["alert"] = "not_needed";
          let alertId: string | undefined;
          if (forecast.summary.risk_level !== "safe") {
            const drafts = await api.listAlerts({ pond_id: pond.id, kind: "oxygen_forecast", status: "draft" });
            const recent = drafts.find((a) => Date.now() - Date.parse(a.created_at) < DRAFT_WINDOW_MS);
            if (recent) {
              alert = "already_drafted";
              alertId = recent.id;
            } else {
              const created = await api.createAlert({ pond_id: pond.id, source: "forecast", source_id: forecast.id });
              alert = "drafted";
              alertId = created.id;
            }
          }
          update(pond.id, { state: "done", forecast, alert, alertId });
        } catch (e) {
          update(pond.id, { state: "error", error: describeError(e) });
        }
      }
      onDone();
    } catch (e) {
      setFatal(e);
    } finally {
      setRunning(false);
    }
  }

  const done = rows.filter((r) => r.state === "done" && r.forecast);
  const atRisk = done.filter((r) => r.forecast!.summary.risk_level !== "safe");
  const valueAtRisk = atRisk.reduce((sum, r) => sum + fishValueInr(r.pond.species, r.forecast!.inputs.estimated_biomass_kg), 0);
  const drafted = done.filter((r) => r.alert === "drafted").length;
  const finished = rows.length > 0 && !running;

  return (
    <section className="card" aria-labelledby="nightly-h">
      <div className="card-head">
        <div>
          <h2 id="nightly-h">5 PM nightly forecast</h2>
          <p>Forecast tonight for every pond and draft alerts for Watch and Danger ponds. In production this runs automatically at 5 PM.</p>
        </div>
        <span className="tag demo">Started by hand in the demo</span>
      </div>

      <div className="stack" style={{ gap: 14 }}>
        <div className="segmented" role="radiogroup" aria-label="Weather for tonight's run">
          {SOURCES.map((s) => (
            <label key={s.id}>
              <input type="radio" name="nightly-source" value={s.id} checked={source === s.id} onChange={() => setSource(s.id)} disabled={running} />
              {s.label}
            </label>
          ))}
        </div>
        {source === "live" && <p className="tiny muted">Each pond uses the forecast for its village. {OPEN_METEO_ATTRIBUTION}.</p>}

        <div className="row">
          <button type="button" className="btn primary" onClick={runAll} disabled={running}>
            {running ? <Spinner /> : <Icon name="clock" />}
            {running ? "Running tonight's forecasts…" : "Run tonight's 5 PM forecast for all ponds"}
          </button>
          <span className="small muted">Assumes farmers feed as usual this evening.</span>
        </div>

        {!!fatal && <Notice tone="error">{describeError(fatal)}</Notice>}

        {rows.length > 0 && (
          <ul className="list" aria-live="polite">
            {rows.map((r) => (
              <li key={r.pond.id} className="row between" style={{ flexWrap: "wrap", gap: 8 }}>
                <span>
                  <strong>{r.pond.name}</strong> <span className="small muted">· {r.pond.village}</span>
                </span>
                <span className="row" style={{ gap: 8 }}>
                  {r.state === "waiting" && <span className="small muted">Waiting</span>}
                  {r.state === "running" && <Spinner />}
                  {r.state === "error" && <span className="field-error">Failed: {r.error}</span>}
                  {r.state === "done" && r.forecast && (
                    <>
                      <RiskBadge level={r.forecast.summary.risk_level} />
                      {r.alert === "drafted" && r.alertId && (
                        <Link href={`/alerts?id=${encodeURIComponent(r.alertId)}`} className="small">
                          Alert drafted
                        </Link>
                      )}
                      {r.alert === "already_drafted" && r.alertId && (
                        <Link href={`/alerts?id=${encodeURIComponent(r.alertId)}`} className="small muted">
                          Alert already drafted
                        </Link>
                      )}
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {finished && done.length > 0 && (
          <Notice
            tone={atRisk.length ? "warn" : "success"}
            title={`${atRisk.length} of ${rows.length} ponds have a Watch or Danger oxygen forecast tonight.`}
          >
            {atRisk.length > 0 ? (
              <>
                About <strong title={VALUE_NOTE}>{formatInr(valueAtRisk)}</strong> of fish are in those ponds (demo estimate).{" "}
                {drafted} new alert{drafted === 1 ? "" : "s"} drafted in Kannada and English, ready to send.{" "}
                <Link href="/alerts">Open the alert centre</Link>.
              </>
            ) : (
              "No oxygen alerts needed tonight. Ponds flagged by earlier water checks still appear under Needs attention."
            )}
          </Notice>
        )}
      </div>
    </section>
  );
}
