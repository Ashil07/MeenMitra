"use client";

import { useState } from "react";
import { api, describeError } from "@/api";
import type { FeedbackResponse, FeedbackResult, Pond } from "@/api/types";
import { useMutation } from "@/lib/useApi";
import { Notice, Spinner } from "./States";
import { SimulatedTag } from "./Tags";

const OPTIONS: { value: FeedbackResponse; label: string; kn: string }[] = [
  { value: 1, label: "1 — Fish were gasping", kn: "ಮೀನುಗಳು ಉಸಿರಾಡಲು ಕಷ್ಟಪಡುತ್ತಿದ್ದವು" },
  { value: 2, label: "2 — Not sure", kn: "ಗೊತ್ತಿಲ್ಲ" },
  { value: 3, label: "3 — Fish were fine", kn: "ಮೀನುಗಳು ಚೆನ್ನಾಗಿದ್ದವು" },
];

export function FeedbackPanel({ pond, onUpdated }: { pond: Pond; onUpdated?: () => void }) {
  const [result, setResult] = useState<FeedbackResult | null>(null);
  const submit = useMutation(api.submitFeedback);

  return (
    <section className="card" aria-labelledby="fb-h">
      <div className="card-head">
        <div>
          <h2 id="fb-h">7 AM check-in</h2>
          <p>Were the fish gasping this morning? The reply tunes this pond&apos;s oxygen-use factor for future forecasts.</p>
        </div>
        <SimulatedTag label="Reply entered here" />
      </div>
      <div className="stack">
        <div className="row">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className="btn"
              disabled={submit.pending}
              onClick={async () => {
                try {
                  setResult(await submit.run(pond.id, o.value));
                  onUpdated?.();
                } catch {
                  /* shown below */
                }
              }}
            >
              <span>
                {o.label}
                <br />
                <span className="kn tiny muted" lang="kn">
                  {o.kn}
                </span>
              </span>
            </button>
          ))}
          {submit.pending && <Spinner />}
        </div>
        <div aria-live="polite">
          {result && (
            <Notice tone="success">
              Recorded reply {result.response}. Pond oxygen-use factor {result.oxygen_use_factor_before.toFixed(2)} →{" "}
              <strong>{result.oxygen_use_factor_after.toFixed(2)}</strong>
              {result.oxygen_use_factor_after === result.oxygen_use_factor_before ? " (no change)" : ""}. Rerun the forecast to see the effect.
            </Notice>
          )}
          {!!submit.error && <Notice tone="error">{describeError(submit.error)}</Notice>}
        </div>
        <p className="tiny muted">
          Current factor: {pond.oxygen_use_factor.toFixed(2)} from {pond.feedback_count} repl{pond.feedback_count === 1 ? "y" : "ies"}. This is basic per-pond calibration, not a trained model.
        </p>
      </div>
    </section>
  );
}
