"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { api, describeError } from "@/api";
import type { Alert, Forecast, Pond, ScenarioId, WeatherInputs } from "@/api/types";
import { fmtInt } from "@/lib/labels";
import { LiveWeatherError, OPEN_METEO_ATTRIBUTION, fetchVillageWeather, type LiveWeather } from "@/lib/liveWeather";
import { formatClock, formatDateTime } from "@/lib/time";
import { useApiQuery, useMutation } from "@/lib/useApi";
import { VALUE_NOTE, fishValueInr, formatInr } from "@/lib/value";
import { ForecastChart } from "./ForecastChart";
import { Icon, type IconName } from "./Icon";
import { MessagePreview } from "./MessagePreview";
import { RiskBadge } from "./RiskBadge";
import { EmptyState, ErrorState, LoadingState, Notice, Spinner } from "./States";
import { EstimateTag, SourceTag } from "./Tags";

const WEATHER_FIELDS: { key: keyof WeatherInputs; label: string; unit: string; min: number; max: number; step: number; icon: IconName }[] = [
  { key: "cloud_cover_pct", label: "Daytime cloud cover", unit: "%", min: 0, max: 100, step: 5, icon: "cloud" },
  { key: "air_temp_evening_c", label: "Evening air temp", unit: "°C", min: 18, max: 40, step: 0.5, icon: "thermo" },
  { key: "air_temp_min_c", label: "Overnight low", unit: "°C", min: 15, max: 35, step: 0.5, icon: "thermo" },
  { key: "wind_speed_ms", label: "Night wind", unit: "m/s", min: 0, max: 10, step: 0.5, icon: "wind" },
  { key: "rain_mm", label: "Daytime rain", unit: "mm", min: 0, max: 100, step: 1, icon: "cloud" },
];

export function ForecastExplorer({ pond, onChange }: { pond: Pond; onChange?: () => void }) {
  const scenarios = useApiQuery(() => api.listScenarios(), []);
  const latest = useApiQuery(() => api.getLatestForecast(pond.id), [pond.id]);

  const [scenarioId, setScenarioId] = useState<ScenarioId>("normal");
  const [overrides, setOverrides] = useState<Partial<WeatherInputs>>({});
  const [feeding, setFeeding] = useState(true);
  const [result, setResult] = useState<Forecast | null>(null);
  const [previous, setPrevious] = useState<Forecast | null>(null);
  const run = useMutation(api.runForecast);
  const [source, setSource] = useState<"scenario" | "live">("scenario");
  const [live, setLive] = useState<LiveState>({ status: "idle" });

  async function loadLive() {
    setLive({ status: "loading" });
    try {
      setLive({ status: "ok", data: await fetchVillageWeather(pond.village) });
    } catch (e) {
      setLive({ status: "error", error: e instanceof LiveWeatherError ? e.message : "Could not load live weather." });
    }
  }

  const scenario = scenarios.data?.find((s) => s.id === scenarioId);
  const weather: WeatherInputs | null = scenario ? { ...scenario.weather, ...overrides } : null;
  const shown = result ?? latest.data ?? null;

  async function onRun() {
    try {
      const f =
        source === "live" && live.data
          ? await run.run(pond.id, { scenario_id: "normal", weather_overrides: live.data.weather, feeding_this_evening: feeding, live_weather: live.data.info })
          : await run.run(pond.id, { scenario_id: scenarioId, weather_overrides: Object.keys(overrides).length ? overrides : undefined, feeding_this_evening: feeding });
      setPrevious(shown);
      setResult(f);
      onChange?.();
    } catch {
      /* error shown via run.error */
    }
  }

  if (scenarios.loading && !scenarios.data) return <LoadingState label="Loading scenarios" />;
  if (scenarios.error) return <ErrorState error={scenarios.error} onRetry={scenarios.reload} title="Could not load forecast scenarios" />;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <section className="card" aria-labelledby="inputs-h">
        <div className="card-head">
          <div>
            <h2 id="inputs-h">Tonight&apos;s conditions</h2>
            <p>Use tonight&apos;s live weather forecast, or pick a scenario and fine-tune it, then run the forecast for {pond.name}.</p>
          </div>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div className="segmented" role="radiogroup" aria-label="Weather source">
            <label>
              <input type="radio" name="weather-source" value="scenario" checked={source === "scenario"} onChange={() => setSource("scenario")} />
              Weather scenario
            </label>
            <label>
              <input
                type="radio"
                name="weather-source"
                value="live"
                checked={source === "live"}
                onChange={() => {
                  setSource("live");
                  if (live.status !== "ok" && live.status !== "loading") void loadLive();
                }}
              />
              Live forecast · {pond.village}
            </label>
          </div>

          {source === "live" && <LiveWeatherPanel live={live} village={pond.village} onRetry={loadLive} />}

          {source === "scenario" && (
            <>
          <div className="segmented" role="radiogroup" aria-label="Weather scenario">
            {scenarios.data?.map((s) => (
              <label key={s.id}>
                <input
                  type="radio"
                  name="scenario"
                  value={s.id}
                  checked={scenarioId === s.id}
                  onChange={() => {
                    setScenarioId(s.id);
                    setOverrides({});
                  }}
                />
                {s.label}
              </label>
            ))}
          </div>
          {scenario && <p className="small muted">{scenario.description}</p>}

          {weather && (
            <details>
              <summary className="small" style={{ cursor: "pointer", fontWeight: 700 }}>
                Adjust weather inputs {Object.keys(overrides).length > 0 && <span className="tag">{Object.keys(overrides).length} changed</span>}
              </summary>
              <div className="fieldset three" style={{ marginTop: 14 }}>
                {WEATHER_FIELDS.map((f) => (
                  <div className="field" key={f.key}>
                    <label className="label" htmlFor={`w-${f.key}`}>
                      {f.label}: <strong>{weather[f.key]}</strong> {f.unit}
                    </label>
                    <input
                      id={`w-${f.key}`}
                      type="range"
                      min={f.min}
                      max={f.max}
                      step={f.step}
                      value={weather[f.key]}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setOverrides((o) => {
                          const next = { ...o };
                          if (scenario && v === scenario.weather[f.key]) delete next[f.key];
                          else next[f.key] = v;
                          return next;
                        });
                      }}
                    />
                  </div>
                ))}
              </div>
              {Object.keys(overrides).length > 0 && (
                <button type="button" className="btn sm ghost" onClick={() => setOverrides({})}>
                  <Icon name="reset" size={14} /> Back to scenario values
                </button>
              )}
            </details>
          )}
            </>
          )}

          <label className="check" style={{ maxWidth: 420 }}>
            <input type="checkbox" checked={feeding} onChange={(e) => setFeeding(e.target.checked)} />
            <span>
              <strong>Farmer plans to feed this evening</strong>
              <br />
              <span className="small muted">Digesting feed increases night-time oxygen use.</span>
            </span>
          </label>

          <div className="row">
            <button type="button" className="btn primary" onClick={onRun} disabled={run.pending || !scenario || (source === "live" && live.status !== "ok")}>
              {run.pending ? <Spinner /> : <Icon name="forecast" />}
              {run.pending ? "Running forecast…" : shown ? "Rerun forecast" : "Run forecast"}
            </button>
            {!!run.error && <span className="field-error">{describeError(run.error)}</span>}
          </div>
        </div>
      </section>

      <div aria-live="polite">
        {result && previous && (
          <Notice tone="success">
            Forecast updated: lowest estimate {previous.summary.min_estimated_do_mg_l} → <strong>{result.summary.min_estimated_do_mg_l} mg/L</strong>
            {previous.summary.risk_level !== result.summary.risk_level ? `, risk ${previous.summary.risk_level} → ${result.summary.risk_level}` : ""}.
          </Notice>
        )}
        {result && !previous && <Notice tone="success">Forecast generated.</Notice>}
      </div>

      {latest.loading && !shown && <LoadingState label="Loading latest forecast" />}
      {!!latest.error && !result && <ErrorState error={latest.error} onRetry={latest.reload} title="Could not load the latest forecast" />}
      {!latest.loading && !latest.error && !shown && (
        <div className="card">
          <EmptyState icon="forecast" title="No forecast yet" body="Choose a scenario above and run the first forecast for this pond." />
        </div>
      )}
      {shown && <ForecastResult key={shown.id} forecast={shown} pond={pond} />}
    </div>
  );
}

type LiveState = { status: "idle" | "loading" | "ok" | "error"; data?: LiveWeather; error?: string };

function LiveWeatherPanel({ live, village, onRetry }: { live: LiveState; village: string; onRetry: () => void }) {
  if (live.status === "loading" || live.status === "idle")
    return (
      <p className="small muted row">
        <Spinner /> Fetching tonight&apos;s forecast for {village} from Open-Meteo…
      </p>
    );
  if (live.status === "error" || !live.data)
    return (
      <Notice tone="error" title="Live weather unavailable">
        {live.error} You can switch back to a weather scenario.{" "}
        <button type="button" className="btn sm" onClick={onRetry} style={{ marginLeft: 6 }}>
          Try again
        </button>
      </Notice>
    );
  const { weather: w, info } = live.data;
  return (
    <div className="card flat tint">
      <div className="row between">
        <strong>
          <Icon name="cloud" size={16} /> Tonight in {info.place}
        </strong>
        <span className="tag implemented">Live forecast</span>
      </div>
      <dl className="kv small" style={{ marginTop: 10 }}>
        <dt>Daytime cloud</dt>
        <dd>{w.cloud_cover_pct}%</dd>
        <dt>Daytime rain</dt>
        <dd>{w.rain_mm} mm</dd>
        <dt>Air temp</dt>
        <dd>
          {w.air_temp_evening_c} °C at 6 PM, {w.air_temp_min_c} °C overnight low
        </dd>
        <dt>Night wind</dt>
        <dd>{w.wind_speed_ms} m/s</dd>
      </dl>
      <p className="tiny muted" style={{ marginTop: 8 }}>
        {OPEN_METEO_ATTRIBUTION} · fetched {formatClock(info.fetched_at)} ·{" "}
        {info.location_source === "district_default"
          ? `"${village}" could not be located, so the Udupi district centre was used.`
          : info.location_source === "geocoded"
            ? `Located "${village}" by name.`
            : "Approximate village location."}{" "}
        Weather is a forecast, not an observation.
      </p>
    </div>
  );
}

function ForecastResult({ forecast: f, pond }: { forecast: Forecast; pond: Pond }) {
  const maxFactor = useMemo(() => Math.max(0.01, ...f.factors.map((x) => x.magnitude_mg_l)), [f.factors]);
  const [alert, setAlert] = useState<Alert | null>(null);
  const create = useMutation(api.createAlert);

  return (
    <div className="stack fade-in" style={{ gap: 20 }}>
      <section className="hero" aria-labelledby="result-h">
        <div className="row between" style={{ alignItems: "flex-start" }}>
          <div className="stack" style={{ gap: 6 }}>
            <span className="eyebrow" style={{ color: "#9fe0d5" }}>
              Overnight oxygen risk · {formatDateTime(f.points[0]?.time)} → {formatClock(f.points[f.points.length - 1]?.time ?? f.created_at)}
            </span>
            <h2 id="result-h" style={{ fontSize: "1.6rem" }}>
              {f.summary.risk_level === "danger"
                ? `Danger tonight — oxygen may fall too low around ${formatClock(f.summary.first_danger_time ?? f.summary.min_time)}`
                : f.summary.risk_level === "watch"
                  ? `Watch tonight — oxygen may run low around ${formatClock(f.summary.first_watch_time ?? f.summary.min_time)}`
                  : "Safe tonight — oxygen is expected to stay above the watch level"}
            </h2>
            <p className="muted small">
              Lowest estimate {f.summary.min_estimated_do_mg_l} mg/L at {formatClock(f.summary.min_time)}
              {f.summary.aerator_start_time ? ` · suggested aerator start ${formatClock(f.summary.aerator_start_time)}` : ""}
            </p>
            {f.summary.risk_level !== "safe" && (
              <p className="small" style={{ color: "#d7efe9" }} title={VALUE_NOTE}>
                Fish worth about <strong>{formatInr(fishValueInr(pond.species, f.inputs.estimated_biomass_kg))}</strong> are at risk (demo estimate).
              </p>
            )}
          </div>
          <RiskBadge level={f.summary.risk_level} size="lg" />
        </div>
      </section>

      <div className="grid grid-main">
        <section className="card" aria-labelledby="curve-h">
          <div className="card-head">
            <div>
              <h2 id="curve-h">Hourly risk curve</h2>
              <p>Estimated dissolved oxygen, 6 PM to 8 AM (IST). Hover or tab through points for details.</p>
            </div>
            <div className="row">
              <EstimateTag />
              <SourceTag source={f.data_source} />
            </div>
          </div>
          <ForecastChart forecast={f} />
          <div className="stack" style={{ marginTop: 14 }}>
            <Notice tone="info" title="These are estimates, not measurements.">
              No oxygen sensor is used. {f.uncertainty_note}
            </Notice>
            {!f.model.calibrated && (
              <Notice tone="warn">
                Model <span className="mono">{f.model.name}</span> v{f.model.version} is not yet calibrated against real dissolved-oxygen measurements from Karnataka ponds.
                {f.model.ml_correction_applied ? "" : " No ML correction was applied."}
              </Notice>
            )}
          </div>
        </section>

        <div className="stack" style={{ gap: 20 }}>
          <section className="card" aria-labelledby="actions-h">
            <div className="card-head">
              <h2 id="actions-h">Suggested actions</h2>
              <span className="tag demo">Demo guidance</span>
            </div>
            <ul className="list">
              {f.actions.map((a) => (
                <li key={a} className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
                  <Icon name="check" style={{ color: "var(--brand-2)", marginTop: 3 }} />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
            <p className="tiny muted" style={{ marginTop: 10 }}>
              Guidance is generic and does not guarantee fish survival. For disease or medicine questions, contact a fisheries officer.
            </p>
          </section>

          <section className="card tint" aria-labelledby="inputs-sum-h">
            <h3 id="inputs-sum-h" style={{ marginBottom: 10 }}>
              Inputs used
            </h3>
            <dl className="kv small">
              <dt>Weather</dt>
              <dd>
                {f.inputs.live_weather
                  ? `Live Open-Meteo forecast for ${f.inputs.live_weather.place}, fetched ${formatClock(f.inputs.live_weather.fetched_at)}`
                  : "Scenario values"}
              </dd>
              <dt>Cloud / rain</dt>
              <dd>
                {f.inputs.weather.cloud_cover_pct}% · {f.inputs.weather.rain_mm} mm
              </dd>
              <dt>Air temp</dt>
              <dd>
                {f.inputs.weather.air_temp_evening_c} °C evening, {f.inputs.weather.air_temp_min_c} °C low
              </dd>
              <dt>Wind</dt>
              <dd>{f.inputs.weather.wind_speed_ms} m/s</dd>
              <dt>Feeding</dt>
              <dd>{f.inputs.feeding_this_evening ? "Yes, this evening" : "No"}</dd>
              <dt>Pond</dt>
              <dd>
                {fmtInt(pond.area_m2)} m² × {pond.depth_m} m · {pond.has_aerator ? "has aerator" : "no aerator"}
              </dd>
              <dt>Fish (est.)</dt>
              <dd>
                ~{f.inputs.estimated_fish_weight_g} g each · ~{fmtInt(f.inputs.estimated_biomass_kg)} kg total
              </dd>
              <dt>Fish value (est.)</dt>
              <dd title={VALUE_NOTE}>
                ~{formatInr(fishValueInr(pond.species, f.inputs.estimated_biomass_kg))} <span className="muted">(demo price per kg)</span>
              </dd>
              <dt>Pond factor</dt>
              <dd>
                {f.inputs.oxygen_use_factor.toFixed(2)} <span className="muted">(learned from farmer replies)</span>
              </dd>
            </dl>
          </section>
        </div>
      </div>

      <div className="grid grid-2">
        <section className="card" aria-labelledby="factors-h">
          <div className="card-head">
            <div>
              <h2 id="factors-h">What drives tonight&apos;s result</h2>
              <p>Overnight contribution of each factor, as reported by the model.</p>
            </div>
          </div>
          <ul className="list">
            {f.factors.map((x) => (
              <li key={x.key}>
                <div className="factor">
                  <div>
                    <strong>{x.label}</strong>{" "}
                    <span className={`tag ${x.effect === "lowers" ? "experimental" : "implemented"}`}>{x.effect === "lowers" ? "lowers oxygen" : "adds oxygen"}</span>
                  </div>
                  <span className="small" style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {x.effect === "lowers" ? "−" : "+"}
                    {x.magnitude_mg_l.toFixed(2)} mg/L
                  </span>
                  <div className="factor-bar" style={{ gridColumn: "1 / -1" }} aria-hidden="true">
                    <span className={x.effect} style={{ width: `${(x.magnitude_mg_l / maxFactor) * 100}%` }} />
                  </div>
                  <p className="small muted" style={{ gridColumn: "1 / -1" }}>
                    {x.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card" aria-labelledby="preview-h">
          <div className="card-head">
            <div>
              <h2 id="preview-h">Farmer alert preview</h2>
              <p>What the farmer would receive at 5 PM.</p>
            </div>
          </div>
          {f.alert_preview ? (
            <div className="stack">
              <MessagePreview message={f.alert_preview} />
              <div aria-live="polite">
                {alert ? (
                  <Notice tone="success" title="Alert drafted.">
                    Not sent yet.{" "}
                    <Link href={`/alerts?id=${encodeURIComponent(alert.id)}`}>Open it in the alert centre</Link> to choose a channel and simulate delivery.
                  </Notice>
                ) : (
                  <div className="row">
                    <button
                      type="button"
                      className="btn primary"
                      disabled={create.pending}
                      onClick={async () => {
                        try {
                          setAlert(await create.run({ pond_id: f.pond_id, source: "forecast", source_id: f.id }));
                        } catch {
                          /* shown below */
                        }
                      }}
                    >
                      {create.pending ? <Spinner /> : <Icon name="alert" />} Create alert from this forecast
                    </button>
                    {!!create.error && <span className="field-error">{describeError(create.error)}</span>}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="muted small">The backend did not return a message preview for this forecast.</p>
          )}
        </section>
      </div>
    </div>
  );
}
