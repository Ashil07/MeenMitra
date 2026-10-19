"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ApiError, api, describeError } from "@/api";
import type { Alert, Pond, Symptom, WaterCheck, WaterReadings } from "@/api/types";
import { SYMPTOMS } from "@/api/types";
import { SYMPTOM_LABEL } from "@/lib/labels";
import { formatDateTime } from "@/lib/time";
import { useMutation } from "@/lib/useApi";
import { Icon } from "./Icon";
import { MessagePreview } from "./MessagePreview";
import { RiskBadge } from "./RiskBadge";
import { EmptyState, Notice, Spinner } from "./States";
import { MeasuredTag, SourceTag } from "./Tags";

const READINGS: { key: keyof WaterReadings; label: string; unit: string; step: string; hint: string; min: number; max: number }[] = [
  { key: "ph", label: "pH", unit: "", step: "0.1", hint: "From a pH strip or kit (0–14).", min: 0, max: 14 },
  { key: "temperature_c", label: "Water temperature", unit: "°C", step: "0.1", hint: "Measured near the surface.", min: 0, max: 45 },
  { key: "ammonia_mg_l", label: "Total ammonia", unit: "mg/L", step: "0.01", hint: "Total ammonia nitrogen (TAN).", min: 0, max: 20 },
  { key: "nitrite_mg_l", label: "Nitrite", unit: "mg/L", step: "0.01", hint: "NO₂⁻ from the test kit.", min: 0, max: 20 },
];

type Raw = Record<keyof WaterReadings, string>;
const EMPTY: Raw = { ph: "", temperature_c: "", ammonia_mg_l: "", nitrite_mg_l: "" };

export function validateReadings(raw: Raw, symptoms: Symptom[]): { errors: Record<string, string>; readings: WaterReadings | null; form?: string } {
  const errors: Record<string, string> = {};
  const readings = {} as WaterReadings;
  for (const r of READINGS) {
    const s = raw[r.key].trim();
    if (s === "") {
      readings[r.key] = null;
      continue;
    }
    const n = Number(s);
    if (!Number.isFinite(n) || n < r.min || n > r.max) errors[r.key] = `${r.label} must be a number between ${r.min} and ${r.max}.`;
    readings[r.key] = n;
  }
  if (Object.keys(errors).length) return { errors, readings: null };
  if (Object.values(readings).every((v) => v === null) && symptoms.length === 0)
    return { errors, readings: null, form: "Enter at least one test-kit reading or tick a symptom you can see." };
  return { errors, readings };
}

export function WaterCheckForm({ pond, onSubmitted }: { pond: Pond; onSubmitted?: (wc: WaterCheck) => void }) {
  const [raw, setRaw] = useState<Raw>(EMPTY);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<WaterCheck | null>(null);
  const submit = useMutation(api.submitWaterCheck);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const v = validateReadings(raw, symptoms);
    setErrors(v.errors);
    setFormError(v.form ?? null);
    if (!v.readings) return;
    try {
      const wc = await submit.run(pond.id, { readings: v.readings, symptoms });
      setResult(wc);
      onSubmitted?.(wc);
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
    }
  }

  return (
    <div className="stack" style={{ gap: 20 }}>
      <section className="card" aria-labelledby="wq-h">
        <div className="card-head">
          <div>
            <h2 id="wq-h">Check my pond</h2>
            <p>Type readings from a test kit and tick anything unusual. Leave a box empty if you did not test it.</p>
          </div>
        </div>
        <form className="form" onSubmit={onSubmit} noValidate aria-busy={submit.pending}>
          {formError && <Notice tone="error">{formError}</Notice>}
          {!!submit.error && (
            <Notice tone="error" title="Check failed.">
              {describeError(submit.error)}
            </Notice>
          )}
          <fieldset className="fieldset four">
            <legend>Test-kit readings</legend>
            {READINGS.map((r) => (
              <div className="field" key={r.key}>
                <label className="label" htmlFor={`wq-${r.key}`}>
                  {r.label}
                </label>
                <div className="input-wrap">
                  <input
                    id={`wq-${r.key}`}
                    className="input"
                    type="number"
                    inputMode="decimal"
                    step={r.step}
                    min={r.min}
                    max={r.max}
                    value={raw[r.key]}
                    aria-invalid={errors[r.key] ? true : undefined}
                    aria-describedby={`wq-${r.key}-msg`}
                    onChange={(e) => setRaw({ ...raw, [r.key]: e.target.value })}
                  />
                  {r.unit && <span className="unit">{r.unit}</span>}
                </div>
                {errors[r.key] ? (
                  <span className="field-error" id={`wq-${r.key}-msg`}>
                    <Icon name="error" size={14} /> {errors[r.key]}
                  </span>
                ) : (
                  <span className="hint" id={`wq-${r.key}-msg`}>
                    {r.hint}
                  </span>
                )}
              </div>
            ))}
          </fieldset>

          <fieldset className="fieldset" style={{ display: "block" }}>
            <legend>What do you see?</legend>
            <div className="check-grid" style={{ marginTop: 8 }}>
              {SYMPTOMS.map((s) => (
                <label key={s} className="check">
                  <input
                    type="checkbox"
                    checked={symptoms.includes(s)}
                    onChange={(e) => setSymptoms(e.target.checked ? [...symptoms, s] : symptoms.filter((x) => x !== s))}
                  />
                  <span>{SYMPTOM_LABEL[s]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="form-actions">
            <button
              type="button"
              className="btn"
              onClick={() => {
                setRaw(EMPTY);
                setSymptoms([]);
                setErrors({});
                setFormError(null);
                setResult(null);
              }}
            >
              Clear
            </button>
            <button type="submit" className="btn primary" disabled={submit.pending}>
              {submit.pending ? <Spinner /> : <Icon name="water" />} {submit.pending ? "Checking…" : "Check water"}
            </button>
          </div>
        </form>
      </section>

      <div aria-live="polite">{result && <WaterCheckResult key={result.id} check={result} pond={pond} />}</div>
    </div>
  );
}

export function WaterCheckResult({ check: c, pond }: { check: WaterCheck; pond: Pond }) {
  const [alert, setAlert] = useState<Alert | null>(null);
  const create = useMutation(api.createAlert);

  return (
    <section className="card fade-in" aria-labelledby={`wcr-${c.id}`}>
      <div className="card-head">
        <div>
          <h2 id={`wcr-${c.id}`}>Rules engine result</h2>
          <p>
            {formatDateTime(c.created_at)} · rules <span className="mono">{c.rules_version}</span>
          </p>
        </div>
        <div className="row">
          <SourceTag source={c.data_source} />
          <RiskBadge level={c.result.risk_level} size="lg" />
        </div>
      </div>

      <div className="grid grid-2">
        <div className="stack">
          <p style={{ fontWeight: 600 }}>{c.result.summary}</p>

          <div className="table-wrap">
            <table>
              <caption className="sr-only">Values used and their rating</caption>
              <thead>
                <tr>
                  <th>Input</th>
                  <th className="num">Value</th>
                  <th>Rating</th>
                </tr>
              </thead>
              <tbody>
                {c.result.findings.map((f, i) => (
                  <tr key={`${f.parameter}-${i}`}>
                    <td style={{ whiteSpace: "normal" }}>
                      <strong>{f.label}</strong>
                      <div className="tiny muted">{f.message}</div>
                    </td>
                    <td className="num">{f.parameter === "symptom" ? "Seen" : `${f.value}${f.unit ? ` ${f.unit}` : ""}`}</td>
                    <td>
                      <RiskBadge level={f.level} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row tiny muted">
            <MeasuredTag /> Values are exactly as entered by the farmer.
          </div>
          {c.result.missing_inputs.length > 0 && (
            <p className="small muted">
              Not provided: {c.result.missing_inputs.map((k) => READINGS.find((r) => r.key === k)?.label ?? k).join(", ")}. The result only reflects what was entered.
            </p>
          )}
        </div>

        <div className="stack">
          <h3>Next steps</h3>
          <ul className="list">
            {c.result.actions.map((a) => (
              <li key={a} className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
                <Icon name="check" style={{ color: "var(--brand-2)", marginTop: 3 }} />
                <span>{a}</span>
              </li>
            ))}
          </ul>
          <Notice tone={c.result.refer_to_fisheries_officer ? "warn" : "info"} title="Disease & treatment need an expert.">
            MeenMitra cannot diagnose fish disease or recommend medicines. Please contact your fisheries extension officer or a qualified aquaculture professional.
          </Notice>

          {c.result.risk_level !== "safe" && (
            <div aria-live="polite">
              {alert ? (
                <div className="stack">
                  <MessagePreview message={alert} />
                  <Notice tone="success" title="Alert drafted.">
                    <Link href={`/alerts?id=${encodeURIComponent(alert.id)}`}>Open it in the alert centre</Link> to simulate delivery.
                  </Notice>
                </div>
              ) : (
                <div className="row">
                  <button
                    type="button"
                    className="btn"
                    disabled={create.pending}
                    onClick={async () => {
                      try {
                        setAlert(await create.run({ pond_id: pond.id, source: "water_check", source_id: c.id }));
                      } catch {
                        /* shown below */
                      }
                    }}
                  >
                    {create.pending ? <Spinner /> : <Icon name="alert" />} Draft farmer alert
                  </button>
                  {!!create.error && <span className="field-error">{describeError(create.error)}</span>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function WaterCheckHistory({ checks }: { checks: WaterCheck[] }) {
  if (checks.length === 0) return <EmptyState icon="water" title="No water checks yet" body="Readings entered with “Check my pond” will appear here." />;
  return (
    <div className="table-wrap">
      <table>
        <caption className="sr-only">Water-quality reading history</caption>
        <thead>
          <tr>
            <th>When</th>
            <th className="num">pH</th>
            <th className="num">Temp °C</th>
            <th className="num">Ammonia mg/L</th>
            <th className="num">Nitrite mg/L</th>
            <th>Symptoms</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((c) => (
            <tr key={c.id}>
              <td>{formatDateTime(c.created_at)}</td>
              <td className="num">{c.readings.ph ?? "—"}</td>
              <td className="num">{c.readings.temperature_c ?? "—"}</td>
              <td className="num">{c.readings.ammonia_mg_l ?? "—"}</td>
              <td className="num">{c.readings.nitrite_mg_l ?? "—"}</td>
              <td style={{ whiteSpace: "normal", minWidth: 160 }}>{c.symptoms.length ? c.symptoms.map((s) => SYMPTOM_LABEL[s]).join(", ") : "None"}</td>
              <td>
                <RiskBadge level={c.result.risk_level} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
