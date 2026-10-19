"use client";

import Link from "next/link";
import { useState } from "react";
import { api, describeError } from "@/api";
import type { Alert, Channel, Delivery } from "@/api/types";
import { ALERT_KIND_LABEL, ALERT_STATUS_LABEL, CHANNEL_LABEL, DELIVERY_STATUS_LABEL } from "@/lib/labels";
import { formatDateTime } from "@/lib/time";
import { useMutation } from "@/lib/useApi";
import { Icon, type IconName } from "./Icon";
import { MessagePreview } from "./MessagePreview";
import { RiskBadge } from "./RiskBadge";
import { Notice, Spinner } from "./States";
import { SimulatedTag, SourceTag } from "./Tags";

const CHANNEL_ICON: Record<Channel, IconName> = { whatsapp: "whatsapp", sms: "sms", voice: "phone" };

export function AlertDetail({ alert, onUpdated }: { alert: Alert; onUpdated: (a: Alert) => void }) {
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [lastDelivery, setLastDelivery] = useState<Delivery | null>(null);
  const send = useMutation(async (id: string) => {
    const d = await api.sendAlert(id, { channel, simulate_failure: simulateFailure || undefined });
    const fresh = await api.getAlert(id);
    return { d, fresh };
  });
  const ack = useMutation(api.acknowledgeAlert);

  const delivered = alert.deliveries.some((d) => d.status === "delivered");
  const acknowledged = alert.status === "acknowledged";

  return (
    <article className="stack" style={{ gap: 18 }} aria-labelledby={`alert-${alert.id}-h`}>
      <header className="stack" style={{ gap: 8 }}>
        <div className="row">
          <RiskBadge level={alert.risk_level} />
          <span className="tag">{ALERT_KIND_LABEL[alert.kind]}</span>
          <SourceTag source={alert.data_source} />
        </div>
        <h2 id={`alert-${alert.id}-h`}>{alert.title}</h2>
        <dl className="kv small">
          <dt>Pond</dt>
          <dd>
            <Link href={`/ponds/${alert.pond_id}`}>{alert.pond_name}</Link>
          </dd>
          <dt>Created</dt>
          <dd>{formatDateTime(alert.created_at)}</dd>
          <dt>Status</dt>
          <dd>
            {ALERT_STATUS_LABEL[alert.status]}
            {acknowledged && alert.acknowledged_at && ` · ${formatDateTime(alert.acknowledged_at)} (reply “${alert.ack_response}”)`}
          </dd>
        </dl>
      </header>

      <MessagePreview message={alert} />

      <section className="card tint" aria-labelledby={`send-${alert.id}`}>
        <div className="card-head" style={{ marginBottom: 12 }}>
          <h3 id={`send-${alert.id}`}>Send to farmer</h3>
          <SimulatedTag label="Simulation mode" />
        </div>
        <div className="stack">
          <div className="segmented" role="radiogroup" aria-label="Delivery channel">
            {(Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => (
              <label key={c}>
                <input type="radio" name={`channel-${alert.id}`} value={c} checked={channel === c} onChange={() => setChannel(c)} />
                <Icon name={CHANNEL_ICON[c]} size={16} /> {CHANNEL_LABEL[c]}
              </label>
            ))}
          </div>
          {channel === "voice" && (
            <p className="small muted">A voice call would read the Kannada text. Text-to-speech and Tulu voice clips are planned, not built.</p>
          )}
          <label className="check" style={{ maxWidth: 460 }}>
            <input type="checkbox" checked={simulateFailure} onChange={(e) => setSimulateFailure(e.target.checked)} />
            <span>
              <strong>Simulate a provider failure</strong>
              <br />
              <span className="small muted">Demo testing of the failed-send path.</span>
            </span>
          </label>
          <div className="row">
            <button
              type="button"
              className="btn primary"
              disabled={send.pending}
              onClick={async () => {
                try {
                  const { d, fresh } = await send.run(alert.id);
                  setLastDelivery(d);
                  onUpdated(fresh);
                } catch {
                  /* shown below */
                }
              }}
            >
              {send.pending ? <Spinner /> : <Icon name="send" />} Simulate send via {CHANNEL_LABEL[channel]}
            </button>
          </div>
          <div aria-live="polite">
            {!!send.error && (
              <Notice tone="error" title="Send request failed.">
                {describeError(send.error)}
              </Notice>
            )}
            {lastDelivery && !send.error && (
              <Notice tone={lastDelivery.status === "failed" ? "error" : "success"}>
                {lastDelivery.status === "failed" ? (
                  <>
                    <strong>{CHANNEL_LABEL[lastDelivery.channel]} delivery failed:</strong> {lastDelivery.error ?? "Unknown error."}
                  </>
                ) : (
                  <>
                    <strong>{lastDelivery.simulated ? "Simulated" : "Provider reported"} {DELIVERY_STATUS_LABEL[lastDelivery.status].toLowerCase()}</strong> to{" "}
                    {lastDelivery.recipient_masked} via {CHANNEL_LABEL[lastDelivery.channel]}.
                    {lastDelivery.simulated && " No real message was sent."}
                  </>
                )}
              </Notice>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby={`hist-${alert.id}`}>
        <h3 id={`hist-${alert.id}`} style={{ marginBottom: 10 }}>
          Delivery history
        </h3>
        {alert.deliveries.length === 0 ? (
          <p className="small muted">Not sent yet.</p>
        ) : (
          <ol className="timeline">
            {[...alert.deliveries].reverse().map((d) => (
              <li key={d.id} className={d.status === "failed" ? "fail" : d.status === "delivered" ? "ok" : ""}>
                <div className="row" style={{ gap: 8 }}>
                  <strong>
                    {CHANNEL_LABEL[d.channel]} · {DELIVERY_STATUS_LABEL[d.status]}
                  </strong>
                  {d.simulated ? <SimulatedTag /> : <span className="tag live">Provider: {d.provider}</span>}
                </div>
                <div className="tiny muted">
                  {formatDateTime(d.created_at)}
                  {d.updated_at !== d.created_at && ` · updated ${formatDateTime(d.updated_at)}`} · to {d.recipient_masked} · provider {d.provider}
                </div>
                {d.error && <div className="tiny" style={{ color: "var(--danger)" }}>{d.error}</div>}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="card tint" aria-labelledby={`ack-${alert.id}`}>
        <div className="card-head" style={{ marginBottom: 12 }}>
          <h3 id={`ack-${alert.id}`}>Farmer reply</h3>
          <SimulatedTag label="Recorded manually" />
        </div>
        {acknowledged ? (
          <Notice tone="success">
            Farmer replied “{alert.ack_response}” at {formatDateTime(alert.acknowledged_at)}.
          </Notice>
        ) : (
          <div className="stack">
            <p className="small muted">
              In production the reply would arrive from WhatsApp/SMS. In this demo, record it here once the alert has been delivered.
            </p>
            <div className="row">
              <button
                type="button"
                className="btn"
                disabled={!delivered || ack.pending}
                aria-describedby={!delivered ? `ack-why-${alert.id}` : undefined}
                onClick={async () => {
                  try {
                    onUpdated(await ack.run(alert.id, { response: "1" }));
                  } catch {
                    /* shown below */
                  }
                }}
              >
                {ack.pending ? <Spinner /> : <Icon name="check" />} Record reply “1 — OK, will do”
              </button>
            </div>
            {!delivered && (
              <span id={`ack-why-${alert.id}`} className="tiny muted">
                Available after a successful (simulated) delivery.
              </span>
            )}
            {!!ack.error && <Notice tone="error">{describeError(ack.error)}</Notice>}
          </div>
        )}
      </section>
    </article>
  );
}
