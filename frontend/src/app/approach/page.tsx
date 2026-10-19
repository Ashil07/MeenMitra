"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/api";
import type { ImplementationStatus, MlStatus } from "@/api/types";
import { Icon, type IconName } from "@/components/Icon";
import { PageHeader } from "@/components/PageHeader";
import { LoadingState, Notice } from "@/components/States";
import { SourceTag, StatusTag } from "@/components/Tags";
import { TRAINING_STATUS_LABEL } from "@/lib/labels";
import { useApiQuery } from "@/lib/useApi";

interface Layer {
  id: string;
  name: string;
  icon: IconName;
  summary: string;
  inputs: string[];
  outputs: string[];
  how: string;
  limitations: string[];
  production: string;
}

/** Explanatory copy only. Implementation status comes from the backend's /ml/status engine_layers. */
const LAYERS: Layer[] = [
  {
    id: "inputs",
    name: "Farmer & pond inputs",
    icon: "pond",
    summary: "A one-time pond profile instead of a sensor.",
    inputs: ["Village & canal", "Area and depth", "Species, stocking date, fish count", "Aerator yes/no, water colour"],
    outputs: ["Pond volume", "Stocking density", "Profile for every nightly run"],
    how: "The farmer (or a cooperative volunteer) registers the pond once. Everything else is derived from this profile and the weather.",
    limitations: ["Fish count drifts over a crop cycle as fish die or are harvested.", "Depth and area are farmer estimates."],
    production: "Assisted registration by cooperative staff, periodic stock updates by SMS.",
  },
  {
    id: "weather",
    name: "Weather features",
    icon: "cloud",
    summary: "Tonight's weather from Open-Meteo, one call per village.",
    inputs: ["Daytime cloud cover & sunlight", "Evening and overnight air temperature", "Night wind speed", "Rain"],
    outputs: ["Hourly weather features, 6 PM → 8 AM"],
    how: "Cloudy, hot, windless days are the classic set-up for a pre-dawn oxygen crash: algae make less oxygen by day and everything consumes more at night.",
    limitations: ["Village-level weather, not pond-level microclimate.", "This demo uses scenario presets you can adjust."],
    production: "Automatic Open-Meteo fetch at 4:30 PM daily per village.",
  },
  {
    id: "physics",
    name: "Physics-inspired baseline",
    icon: "forecast",
    summary: "An hourly oxygen balance that works with zero training data.",
    inputs: ["Weather features", "Pond volume & depth", "Estimated fish biomass (growth curve from stocking date)", "Per-pond oxygen-use factor"],
    outputs: ["Hourly estimated dissolved oxygen (mg/L)", "Factor contributions", "Lowest point & time"],
    how: "Each hour, oxygen gained from wind mixing is balanced against oxygen used by fish, algae and pond mud, adjusted for water temperature. A growth curve estimates today's fish weight.",
    limitations: [
      "Coefficients come from general aquaculture literature, not from local measurements.",
      "Output is an estimate. It has not been validated against dissolved-oxygen readings in Karnataka ponds.",
    ],
    production: "Calibrate coefficients with a seasonal DO-meter campaign across pilot ponds.",
  },
  {
    id: "ml",
    name: "ML correction layer",
    icon: "sparkle",
    summary: "Learns where the physics model goes wrong.",
    inputs: ["Hour, temperature, cloud, sunlight, wind, rain, fish weight", "Physics baseline estimate"],
    outputs: ["Correction to the baseline curve"],
    how: "A gradient-boosted model (XGBoost is planned) would be trained on measured oxygen readings matched with historical weather, predicting the error of the physics baseline.",
    limitations: [
      "Candidate training data is from aquaponics ponds, which differ from earthen village ponds.",
      "Not applied to any forecast unless the backend reports a trained model in use.",
    ],
    production: "Train on local DO measurements once collected; ship only after validation against held-out ponds.",
  },
  {
    id: "rules",
    name: "Water-quality & symptom rules",
    icon: "water",
    summary: "Test-kit readings and visible signs → clear next steps.",
    inputs: ["pH", "Water temperature (°C)", "Total ammonia (mg/L)", "Nitrite (mg/L)", "Ticked symptoms"],
    outputs: ["Safe / Watch / Danger per reading", "Actions", "Referral flag for disease signs"],
    how: "Transparent threshold rules. Each reading is rated independently and the worst rating wins. Missing readings are reported, not guessed.",
    limitations: ["Cannot diagnose disease or recommend medicine — always refers to a fisheries officer.", "Cheap test kits are imprecise."],
    production: "Thresholds reviewed with the Fisheries Department and tuned per species.",
  },
  {
    id: "risk",
    name: "Safe / Watch / Danger",
    icon: "shield",
    summary: "One status a farmer can act on.",
    inputs: ["Lowest estimated oxygen vs thresholds", "Rules-engine rating"],
    outputs: ["Risk level", "Danger window", "Suggested aerator start time"],
    how: "The forecast is classified by its lowest estimated oxygen against fixed thresholds; the aerator start is suggested an hour before the first Danger hour.",
    limitations: ["Thresholds are generic for warm-water carps.", "A Safe result is not a guarantee against fish loss."],
    production: "Species-specific thresholds and a confidence-aware classification.",
  },
  {
    id: "delivery",
    name: "Alert delivery",
    icon: "send",
    summary: "Kannada WhatsApp / SMS at 5 PM, a call if there is no reply.",
    inputs: ["Risk level & action plan", "Kannada template + English translation", "Farmer mobile number"],
    outputs: ["Delivery records with status and timestamps"],
    how: "Fixed Kannada templates are filled with the pond's times and actions. In this MVP every send goes through a mock provider and is clearly marked as simulated.",
    limitations: ["No real WhatsApp, SMS or voice provider is connected.", "Kannada templates still need native-speaker review; Tulu is not built."],
    production: "Twilio (or similar) for WhatsApp/SMS/voice; recorded Tulu clips and Indic text-to-speech; escalation call to a neighbour.",
  },
  {
    id: "feedback",
    name: "Farmer feedback",
    icon: "sms",
    summary: "7 AM: “Were the fish gasping?” Reply 1, 2 or 3.",
    inputs: ["Farmer reply 1 / 2 / 3"],
    outputs: ["Labelled outcome for that night"],
    how: "A one-tap morning check-in turns every night into a weak label for that pond, without a sensor.",
    limitations: ["Gasping is a coarse, subjective signal.", "In this demo replies are entered in the UI."],
    production: "Replies captured automatically from WhatsApp/SMS webhooks.",
  },
  {
    id: "calibration",
    name: "Per-pond calibration",
    icon: "refresh",
    summary: "Each reply nudges that pond's oxygen-use factor.",
    inputs: ["Feedback history"],
    outputs: ["Updated oxygen-use factor used by the next forecast"],
    how: "“Gasping” raises the pond's oxygen-use factor; “fine” lowers it slightly. Over weeks the forecast leans toward that pond's real behaviour.",
    limitations: ["Simple bounded nudge, not a trained model.", "Can drift if replies are unreliable."],
    production: "Bayesian per-pond update with uncertainty, feeding into the ML layer.",
  },
];

export default function ApproachPage() {
  const status = useApiQuery(() => api.getMlStatus(), []);
  const [active, setActive] = useState(LAYERS[2].id);
  const layer = LAYERS.find((l) => l.id === active)!;
  const layerStatus = status.data?.engine_layers.find((l) => l.id === active);

  return (
    <>
      <PageHeader
        eyebrow="How MeenMitra works"
        title="Approach explorer"
        sub="A hybrid engine: a physics-inspired model that works from day one, a planned ML layer that learns its errors, and per-pond learning from farmer replies. Select a layer to see what it does and what is actually built."
      />

      <section className="hero" aria-label="Pipeline">
        <svg className="hero-waves" width="420" height="120" viewBox="0 0 420 120" aria-hidden="true">
          <path d="M0 60c35 0 35-20 70-20s35 20 70 20 35-20 70-20 35 20 70 20 35-20 70-20 35 20 70 20M0 95c35 0 35-20 70-20s35 20 70 20 35-20 70-20 35 20 70 20 35-20 70-20 35 20 70 20" stroke="#fff" strokeWidth="3" fill="none" />
        </svg>
        <div className="row between" style={{ marginBottom: 16 }}>
          <div>
            <h2>One night with MeenMitra</h2>
            <p className="muted small">5 PM forecast → alert → 2 AM aerator → 7 AM check-in → a sharper forecast tomorrow.</p>
          </div>
          {status.data && <SourceTag source={status.data.data_source} />}
        </div>
        <div className="pipeline" role="group" aria-label="Engine layers">
          {LAYERS.map((l, i) => {
            const s = status.data?.engine_layers.find((x) => x.id === l.id)?.status;
            return (
              <button key={l.id} type="button" className="pipe-step" aria-pressed={active === l.id} onClick={() => setActive(l.id)}>
                <span className="row between" style={{ width: "100%" }}>
                  <span className="pipe-num">STEP {i + 1}</span>
                  <Icon name={l.icon} size={16} style={{ color: "var(--brand-2)" }} />
                </span>
                <span className="pipe-name" style={{ color: "var(--ink)" }}>
                  {l.name}
                </span>
                {s ? <StatusTag status={s} /> : <span className="tag">{status.loading ? "…" : "Status unknown"}</span>}
              </button>
            );
          })}
        </div>
      </section>

      {!!status.error && (
        <Notice tone="warn" title="Implementation status unavailable.">
          The backend status endpoint could not be reached, so layer statuses are shown as unknown.{" "}
          <button type="button" className="btn sm" onClick={status.reload}>
            Retry
          </button>
        </Notice>
      )}

      <section className="card fade-in" key={layer.id} aria-labelledby="layer-h">
        <div className="card-head">
          <div className="row" style={{ gap: 12 }}>
            <span className="state-icon" style={{ width: 44, height: 44 }}>
              <Icon name={layer.icon} size={22} />
            </span>
            <div>
              <h2 id="layer-h">{layer.name}</h2>
              <p>{layer.summary}</p>
            </div>
          </div>
          {layerStatus ? <StatusTag status={layerStatus.status} /> : null}
        </div>

        {layerStatus && (
          <Notice tone={statusTone(layerStatus.status)} title="Current status:">
            {layerStatus.note}
          </Notice>
        )}
        {layer.id === "ml" && <MlEvidence status={status.data} loading={status.loading} />}

        <div className="grid grid-3" style={{ marginTop: 18 }}>
          <div className="stack">
            <h3>Inputs</h3>
            <ul className="list small">
              {layer.inputs.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <div className="stack">
            <h3>Outputs</h3>
            <ul className="list small">
              {layer.outputs.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <div className="stack">
            <h3>Limitations</h3>
            <ul className="list small">
              {layer.limitations.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </div>
        <hr className="divider" style={{ margin: "18px 0" }} />
        <div className="grid grid-2">
          <div className="stack">
            <h3>How it works</h3>
            <p className="small">{layer.how}</p>
          </div>
          <div className="stack">
            <h3>
              Planned for production <StatusTag status="planned" />
            </h3>
            <p className="small">{layer.production}</p>
          </div>
        </div>
      </section>

      <div className="grid grid-3">
        <LegendCard status="implemented" body="Works in this MVP demo with demo or simulated data. Not production-validated." />
        <LegendCard status="experimental" body="Exists in a basic form, or works only in simulation. Expect changes." />
        <LegendCard status="planned" body="Designed but not built. Shown so the full approach is clear." />
      </div>

      <p className="small muted">
        Dataset and model details: <Link href="/models">Data &amp; models</Link>.
      </p>
    </>
  );
}

function statusTone(s: ImplementationStatus) {
  return s === "implemented" ? "success" : s === "experimental" ? "warn" : "info";
}

function MlEvidence({ status, loading }: { status: MlStatus | undefined; loading: boolean }) {
  if (loading && !status) return <LoadingState rows={2} />;
  const model = status?.models.find((m) => m.task === "oxygen_regression");
  if (!model)
    return (
      <Notice tone="info" title="No oxygen ML model reported.">
        The backend has not reported an oxygen-correction model, so no ML correction is described as active.
      </Notice>
    );
  return (
    <div className="notice" style={{ marginTop: 10 }}>
      <Icon name="model" />
      <div className="small">
        <strong>{model.name}</strong> — {TRAINING_STATUS_LABEL[model.training_status]}
        {model.used_in_forecast ? ", used in forecasts" : ", not used in forecasts"}
        {model.validated_for_karnataka_ponds ? ", validated for Karnataka ponds" : ", not validated for Karnataka pond conditions"}.
        {model.metrics.length === 0 ? " No evaluation metrics have been computed." : ` ${model.metrics.length} evaluation metric(s) reported — see Data & models.`}
      </div>
    </div>
  );
}

function LegendCard({ status, body }: { status: ImplementationStatus; body: string }) {
  return (
    <div className="card flat">
      <StatusTag status={status} />
      <p className="small" style={{ marginTop: 8 }}>
        {body}
      </p>
    </div>
  );
}

