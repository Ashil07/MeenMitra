"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, api, describeError } from "@/api";
import type { Alert, FeedbackResponse, Pond, Symptom, WaterCheck } from "@/api/types";
import { useApiQuery, useMutation } from "@/lib/useApi";
import { Pictogram, type PictogramName } from "./Pictogram";
import { useRememberedPond } from "./prefs";
import { SpeakButton } from "./SpeakButton";
import {
  FARMER_SYMPTOMS,
  MORNING_OPTIONS,
  STATUS_LINE,
  STATUS_WORD,
  STEP_TEXT,
  UI,
  relativeTime,
  stepsFor,
  type Lang,
  type StepId,
} from "./strings";
import styles from "./farmer.module.css";

const STEP_ICON: Record<StepId, PictogramName> = {
  aerator_all_night: "aerator",
  aerator_ready: "aerator",
  fresh_water: "water",
  no_feed: "noFeed",
  less_feed: "lessFeed",
  feed_normal: "feed",
  check_dawn: "sunrise",
  check_morning: "eye",
  call_officer: "officer",
  report_below: "report",
};

export function FarmerError({ lang, error, onRetry }: { lang: Lang; error: unknown; onRetry?: () => void }) {
  const notFound = error instanceof ApiError && error.kind === "not_found";
  return (
    <div className={`${styles.note} ${styles.noteBad}`} role="alert" style={{ marginTop: 20 }}>
      <p>{notFound ? UI.pondNotFound[lang] : UI.loadError[lang]}</p>
      {!notFound && (
        <p className={styles.small} lang="en">
          {describeError(error)}
        </p>
      )}
      {notFound ? (
        <Link href="/farmer" className={styles.linkBtn}>
          {UI.changePond[lang]}
        </Link>
      ) : (
        onRetry && (
          <button type="button" className={styles.secondary} onClick={onRetry}>
            {UI.retry[lang]}
          </button>
        )
      )}
    </div>
  );
}

export function FarmerHome({ pondId, lang }: { pondId: string; lang: Lang }) {
  const pond = useApiQuery(() => api.getPond(pondId), [pondId]);
  const alerts = useApiQuery(() => api.listAlerts({ pond_id: pondId }), [pondId]);
  const [, remember] = useRememberedPond();
  const loadedId = pond.data?.id;

  useEffect(() => {
    if (loadedId) remember(loadedId);
  }, [loadedId, remember]);

  if (pond.error) return <FarmerError lang={lang} error={pond.error} onRetry={pond.reload} />;
  if (!pond.data) {
    return <div className={styles.skeleton} style={{ marginTop: 20 }} role="status" aria-label={UI.loading[lang]} />;
  }

  const p = pond.data;
  const message = latestMessage(alerts.data ?? []);

  return (
    <>
      <div className={styles.pondLine}>
        <div>
          <div className={styles.pondLabel}>{UI.yourPond[lang]}</div>
          <div className={styles.pondName}>
            {p.name} · {p.village}
          </div>
        </div>
        <Link href="/farmer" className={styles.linkBtn}>
          {UI.changePond[lang]}
        </Link>
      </div>

      <StatusCard pond={p} lang={lang} />
      <Steps pond={p} lang={lang} />
      {message && <MessageCard alert={message} lang={lang} onChange={alerts.reload} />}
      <MorningCheck pondId={p.id} lang={lang} />
      <ReportProblem pondId={p.id} lang={lang} onReported={pond.reload} />
    </>
  );
}

const MESSAGE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * The newest message the farmer could actually have received (delivered or already answered),
 * and only if it is recent. A "tonight" warning from two days ago would read as current.
 */
export function latestMessage(alerts: Alert[], now: number = Date.now()): Alert | null {
  return (
    alerts
      .filter((a) => a.status === "sent" || a.status === "acknowledged")
      .filter((a) => now - new Date(a.created_at).getTime() <= MESSAGE_MAX_AGE_MS)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
  );
}

function StatusCard({ pond, lang }: { pond: Pond; lang: Lang }) {
  const level = pond.latest_risk;
  const source = pond.latest_risk_source ?? "forecast";
  const word = STATUS_WORD[level][lang];
  const line = STATUS_LINE[source][level][lang];
  const steps = stepsFor(level, pond.has_aerator).map((s) => STEP_TEXT[s][lang]);
  const spoken = [word, line, ...steps].join(". ");

  return (
    <section className={`${styles.status} ${styles[`status_${level}`]}`} aria-labelledby="farmer-status" aria-live="polite">
      <div className={styles.statusTop}>
        <Pictogram name={level} size={56} />
        <h1 id="farmer-status" className={styles.statusWord}>
          {word}
        </h1>
      </div>
      <p className={styles.statusLine}>{line}</p>
      {pond.latest_risk_at && (
        <p className={styles.statusMeta}>
          {UI.updated[lang]}: {relativeTime(pond.latest_risk_at, lang)}
          {source === "forecast" && level !== "unknown" ? ` · ${UI.estimateNote[lang]}` : ""}
        </p>
      )}
      <SpeakButton text={spoken} lang={lang} />
    </section>
  );
}

function Steps({ pond, lang }: { pond: Pond; lang: Lang }) {
  const level = pond.latest_risk;
  const steps = stepsFor(level, pond.has_aerator);
  return (
    <section className={styles.section} aria-labelledby="farmer-steps">
      <h2 id="farmer-steps" className={styles.sectionTitle}>
        {level === "unknown" ? UI.todoTitleUnknown[lang] : UI.todoTitle[lang]}
      </h2>
      <ol className={styles.steps}>
        {steps.map((s, i) => (
          <li key={s} className={styles.step}>
            <span className={styles.stepIcon}>
              <Pictogram name={STEP_ICON[s]} size={40} />
            </span>
            <span>
              <span className={styles.stepNum}>{i + 1}</span>
              {STEP_TEXT[s][lang]}
            </span>
          </li>
        ))}
      </ol>
      {level !== "safe" && level !== "unknown" && (
        <p className={styles.small} style={{ marginTop: 10 }}>
          {UI.noGuarantee[lang]}
        </p>
      )}
    </section>
  );
}

function MessageCard({ alert, lang, onChange }: { alert: Alert; lang: Lang; onChange: () => void }) {
  const ack = useMutation(api.acknowledgeAlert);
  const text = lang === "kn" ? alert.message_kn : alert.message_en;
  const simulated = alert.deliveries.some((d) => d.simulated) || alert.data_source === "demo";

  return (
    <section className={styles.section} aria-labelledby="farmer-message">
      <h2 id="farmer-message" className={styles.sectionTitle}>
        {UI.messageTitle[lang]}
      </h2>
      <p className={styles.message}>{text}</p>
      <p className={styles.messageMeta}>
        {relativeTime(alert.created_at, lang)}
        {simulated ? ` · ${UI.demoMessage[lang]}` : ""}
      </p>
      {alert.status === "acknowledged" ? (
        <p className={`${styles.note} ${styles.noteOk}`}>✓ {UI.acked[lang]}</p>
      ) : (
        <button
          type="button"
          className={styles.primary}
          disabled={ack.pending}
          onClick={async () => {
            try {
              await ack.run(alert.id, { response: "1" });
              onChange();
            } catch {
              /* shown below */
            }
          }}
        >
          {UI.ack[lang]}
        </button>
      )}
      {!!ack.error && (
        <p className={`${styles.note} ${styles.noteBad}`} role="alert">
          {UI.saveError[lang]}
        </p>
      )}
    </section>
  );
}

const MORNING_STYLE: Record<FeedbackResponse, { icon: PictogramName; className: string }> = {
  3: { icon: "fishFine", className: styles.choiceGood },
  1: { icon: "fishGasping", className: styles.choiceBad },
  2: { icon: "question", className: styles.choiceUnsure },
};

function MorningCheck({ pondId, lang }: { pondId: string; lang: Lang }) {
  const submit = useMutation(api.submitFeedback);
  const [answered, setAnswered] = useState<FeedbackResponse | null>(null);

  return (
    <section className={styles.section} aria-labelledby="farmer-morning">
      <h2 id="farmer-morning" className={styles.sectionTitle}>
        {UI.morningTitle[lang]}
      </h2>
      {answered === null ? (
        <div className={styles.choices}>
          {MORNING_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`${styles.choice} ${MORNING_STYLE[o.value].className}`}
              disabled={submit.pending}
              onClick={async () => {
                try {
                  await submit.run(pondId, o.value);
                  setAnswered(o.value);
                } catch {
                  /* shown below */
                }
              }}
            >
              <Pictogram name={MORNING_STYLE[o.value].icon} size={44} />
              <span className={styles.choiceLabel}>{o.text[lang]}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className={`${styles.note} ${answered === 1 ? styles.noteBad : styles.noteOk}`} role="status">
          <p>{UI.thanks[lang]}</p>
          {answered === 1 && <p>{UI.thanksGasping[lang]}</p>}
          <p className={styles.small}>{UI.answerHelps[lang]}</p>
        </div>
      )}
      {!!submit.error && (
        <p className={`${styles.note} ${styles.noteBad}`} role="alert">
          {UI.saveError[lang]}
        </p>
      )}
    </section>
  );
}

function ReportProblem({ pondId, lang, onReported }: { pondId: string; lang: Lang; onReported: () => void }) {
  const [picked, setPicked] = useState<Symptom[]>([]);
  const [result, setResult] = useState<WaterCheck | null>(null);
  const [needOne, setNeedOne] = useState(false);
  const submit = useMutation(api.submitWaterCheck);

  const toggle = (s: Symptom) => {
    setNeedOne(false);
    setPicked((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  };

  async function send() {
    if (picked.length === 0) {
      setNeedOne(true);
      return;
    }
    try {
      const wc = await submit.run(pondId, {
        readings: { ph: null, temperature_c: null, ammonia_mg_l: null, nitrite_mg_l: null },
        symptoms: picked,
        notes: "Reported from the farmer screen",
      });
      setResult(wc);
      setPicked([]);
      onReported();
    } catch {
      /* shown below */
    }
  }

  return (
    <section className={styles.section} aria-labelledby="farmer-report">
      <h2 id="farmer-report" className={styles.sectionTitle}>
        {UI.reportTitle[lang]}
      </h2>
      {result ? (
        <>
          <div
            className={`${styles.note} ${result.result.risk_level === "danger" ? styles.noteBad : result.result.risk_level === "watch" ? styles.noteWarn : styles.noteOk}`}
            role="status"
          >
            <p>
              {UI.reportSent[lang]} {STATUS_WORD[result.result.risk_level][lang]}.
            </p>
            <p>{UI.medicine[lang]}</p>
            <p className={styles.small}>{UI.notDiagnosis[lang]}</p>
          </div>
          <button type="button" className={styles.secondary} onClick={() => setResult(null)}>
            {UI.reportAgain[lang]}
          </button>
        </>
      ) : (
        <>
          <p className={styles.small} style={{ marginBottom: 12 }}>
            {UI.reportHint[lang]}
          </p>
          <div className={styles.tiles}>
            {FARMER_SYMPTOMS.map((s) => {
              const on = picked.includes(s.id);
              return (
                <button key={s.id} type="button" className={styles.tile} aria-pressed={on} onClick={() => toggle(s.id)}>
                  <span className={styles.tileCheck} aria-hidden="true">
                    {on ? "✓" : ""}
                  </span>
                  <span>{s.text[lang]}</span>
                </button>
              );
            })}
          </div>
          <button type="button" className={styles.primary} onClick={send} disabled={submit.pending}>
            {UI.send[lang]}
          </button>
          {needOne && (
            <p className={`${styles.note} ${styles.noteWarn}`} role="alert">
              {UI.pickOne[lang]}
            </p>
          )}
          {!!submit.error && (
            <p className={`${styles.note} ${styles.noteBad}`} role="alert">
              {UI.saveError[lang]}
            </p>
          )}
        </>
      )}
    </section>
  );
}
