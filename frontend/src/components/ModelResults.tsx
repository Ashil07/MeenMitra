"use client";

import { useId } from "react";
import type { ModelResults as Results } from "@/api/types";

const INPUT_LABEL: Record<string, string> = {
  dissolved_oxygen: "DO (mg/L)",
  ph: "pH",
  ammonia: "Ammonia (mg/L)",
  temperature: "Temp (°C)",
  turbidity: "Turbidity (cm)",
};

/** The saved model's real outputs on held-out test data, as reported by the last training run. */
export function ModelResults({ results: r }: { results: Results }) {
  return (
    <div className="stack" style={{ gap: 12 }}>
      <p className="small muted">
        Trained on {r.n_train.toLocaleString("en-IN")} rows, tested on{" "}
        {r.n_test.toLocaleString("en-IN")} rows it never saw. Split: {r.split}.
      </p>
      {r.samples && r.samples.length > 0 && <Samples samples={r.samples} />}
      {r.confusion_matrix && <Confusion cm={r.confusion_matrix} />}
      {r.series && <Series series={r.series} />}
    </div>
  );
}

function Samples({ samples }: { samples: NonNullable<Results["samples"]> }) {
  const keys = Object.keys(samples[0].inputs);
  return (
    <div>
      <p className="small" style={{ fontWeight: 800, marginBottom: 6 }}>
        Model predictions on test samples
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {keys.map((k) => (
                <th key={k} className="num">
                  {INPUT_LABEL[k] ?? k}
                </th>
              ))}
              <th>Actual grade</th>
              <th>Predicted</th>
              <th className="num">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {samples.map((s, i) => (
              <tr key={i}>
                {keys.map((k) => (
                  <td key={k} className="num">
                    {s.inputs[k]}
                  </td>
                ))}
                <td>{s.actual}</td>
                <td>
                  <strong
                    style={{
                      color:
                        s.predicted === s.actual
                          ? "var(--safe)"
                          : "var(--danger)",
                    }}
                  >
                    {s.predicted}
                  </strong>
                </td>
                <td className="num">{Math.round(s.confidence * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Confusion({ cm }: { cm: NonNullable<Results["confusion_matrix"]> }) {
  return (
    <div>
      <p className="small" style={{ fontWeight: 800, marginBottom: 6 }}>
        Confusion matrix (rows: actual, columns: predicted)
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th />
              {cm.labels.map((l) => (
                <th key={l} className="num">
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cm.matrix.map((row, i) => (
              <tr key={cm.labels[i]}>
                <th scope="row">{cm.labels[i]}</th>
                {row.map((n, j) => (
                  <td
                    key={j}
                    className="num"
                    style={
                      i === j
                        ? { fontWeight: 800, color: "var(--safe)" }
                        : n
                          ? { color: "var(--danger)" }
                          : undefined
                    }
                  >
                    {n}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const W = 360;
const H = 170;
const PAD = { l: 34, r: 10, t: 10, b: 24 };

function Series({ series: s }: { series: NonNullable<Results["series"]> }) {
  const titleId = useId();
  const pts = s.points;
  const values = pts.flatMap((p) => [p.actual, p.predicted, p.baseline]);
  const lo = Math.floor(Math.min(...values));
  const hi = Math.ceil(Math.max(...values));
  const x = (i: number) =>
    PAD.l + (i / Math.max(pts.length - 1, 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) =>
    PAD.t + (1 - (v - lo) / Math.max(hi - lo, 1)) * (H - PAD.t - PAD.b);
  const line = (key: "actual" | "predicted" | "baseline") =>
    pts
      .map(
        (p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`,
      )
      .join(" ");
  const hourLabel = (iso: string) => {
    const h = new Date(iso).getUTCHours();
    return `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
  };
  const ticks = pts.map((p, i) => ({ i, p })).filter(({ i }) => i % 6 === 0);
  const meanErr = (key: "predicted" | "baseline") =>
    pts.reduce((sum, p) => sum + Math.abs(p[key] - p.actual), 0) / pts.length;

  return (
    <figure style={{ margin: 0 }} aria-labelledby={titleId}>
      <figcaption id={titleId} className="small" style={{ fontWeight: 800 }}>
        Model predictions vs actual · {s.label}
      </figcaption>
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Next-hour oxygen, ${s.unit}. Average error over these ${pts.length} hours: model ${meanErr("predicted").toFixed(2)}, ${s.baseline_label.toLowerCase()} ${meanErr("baseline").toFixed(2)}.`}
        style={{ marginTop: 8 }}
      >
        {[lo, (lo + hi) / 2, hi].map((v) => (
          <g key={v}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--line)"
            />
            <text
              x={PAD.l - 5}
              y={y(v) + 3}
              fontSize="10"
              fill="var(--muted)"
              textAnchor="end"
            >
              {v}
            </text>
          </g>
        ))}
        {ticks.map(({ i, p }) => (
          <text
            key={i}
            x={x(i)}
            y={H - 7}
            fontSize="10"
            fill="var(--muted)"
            textAnchor="middle"
          >
            {hourLabel(p.hour)}
          </text>
        ))}
        <path
          d={line("baseline")}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
        <path
          d={line("actual")}
          fill="none"
          stroke="var(--ink)"
          strokeWidth={2.5}
        />
        <path
          d={line("predicted")}
          fill="none"
          stroke="var(--brand-2)"
          strokeWidth={2.5}
          strokeDasharray="1 0"
          opacity={0.9}
        />
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(p.predicted)}
            r={2.2}
            fill="var(--brand-2)"
          />
        ))}
      </svg>
      <div className="legend" style={{ marginTop: 6 }}>
        <span className="legend-item">
          <span
            className="swatch"
            style={{ background: "var(--ink)", height: 3 }}
          />{" "}
          Actual ({s.unit})
        </span>
        <span className="legend-item">
          <span
            className="swatch"
            style={{ background: "var(--brand-2)", height: 3 }}
          />{" "}
          Model prediction · avg error {meanErr("predicted").toFixed(2)}
        </span>
        <span className="legend-item">
          <span
            className="swatch"
            style={{
              background: "transparent",
              borderTop: "2px dashed var(--muted)",
              height: 0,
            }}
          />{" "}
          {s.baseline_label} · avg error {meanErr("baseline").toFixed(2)}
        </span>
      </div>
    </figure>
  );
}
