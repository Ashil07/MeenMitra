"use client";

import { api } from "@/api";
import type { DatasetInfo, ModelInfoStatus } from "@/api/types";
import { Icon } from "@/components/Icon";
import { ModelResults } from "@/components/ModelResults";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState, LoadingState, Notice } from "@/components/States";
import { SourceTag } from "@/components/Tags";
import { DATASET_STATUS_LABEL, TRAINING_STATUS_LABEL, fmtInt } from "@/lib/labels";
import { formatDateTime } from "@/lib/time";
import { useApiQuery } from "@/lib/useApi";

const TASK_LABEL: Record<DatasetInfo["task"], string> = {
  oxygen_regression: "Oxygen prediction (regression)",
  disease_classification: "Disease classification",
  water_quality_reference: "Water-quality reference",
  weather: "Weather features",
};

export default function ModelsPage() {
  const q = useApiQuery(() => api.getMlStatus(), []);

  return (
    <>
      <PageHeader
        eyebrow="Transparency"
        title="Data & models"
        sub="What data MeenMitra uses, whether it is actually loaded, and the real training and evaluation status of each model. Every number on this page is reported by the backend; none are filled in by the frontend."
        actions={
          <button type="button" className="btn" onClick={q.reload} disabled={q.loading}>
            <Icon name="refresh" /> Refresh
          </button>
        }
      />

      {q.loading && !q.data && (
        <div className="card">
          <LoadingState rows={5} />
        </div>
      )}
      {!!q.error && (
        <div className="card">
          <ErrorState error={q.error} onRetry={q.reload} title="Could not load dataset and model status" />
        </div>
      )}

      {q.data && !q.error && (
        <>
          <div className="row small muted">
            <SourceTag source={q.data.data_source} /> Reported {formatDateTime(q.data.generated_at)}
          </div>
          {q.data.data_source === "demo" && (
            <Notice tone="info" title="Results from the backend's last training run.">
              In demo mode these numbers and predictions are exported from the backend&apos;s saved models (backend/scripts/export_demo_ml.py), which re-scores each model on
              its test data first. Models trained on simulated data are labelled.
            </Notice>
          )}

          <section className="stack" aria-labelledby="models-h" style={{ gap: 14 }}>
            <h2 id="models-h">Models</h2>
            {q.data.models.length === 0 ? (
              <div className="card">
                <EmptyState icon="model" title="No models reported" />
              </div>
            ) : (
              <div className="stack" style={{ gap: 14 }}>
                {q.data.models.map((m) => (
                  <ModelCard key={m.id} model={m} />
                ))}
              </div>
            )}
            <Notice tone="info">
              Disease classification and oxygen prediction are separate tasks with separate data. A disease model never feeds the oxygen forecast, and would only ever flag cases for referral to a fisheries officer.
            </Notice>
          </section>

          <section className="stack" aria-labelledby="ds-h" style={{ gap: 14 }}>
            <h2 id="ds-h">Datasets</h2>
            {q.data.datasets.length === 0 ? (
              <div className="card">
                <EmptyState icon="model" title="No datasets reported" />
              </div>
            ) : (
              <div className="grid grid-2">
                {q.data.datasets.map((d) => (
                  <DatasetCard key={d.id} ds={d} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

function ModelCard({ model: m }: { model: ModelInfoStatus }) {
  const trained = m.training_status === "trained";
  return (
    <article className="card" aria-labelledby={`m-${m.id}`}>
      <div className="card-head">
        <div>
          <h3 id={`m-${m.id}`}>{m.name}</h3>
          <p>{TASK_LABEL[m.task]}</p>
        </div>
        <span className={`tag ${trained ? "implemented" : m.training_status === "failed" ? "" : "planned"}`}>{TRAINING_STATUS_LABEL[m.training_status]}</span>
      </div>
      <dl className="kv small">
        <dt>Version</dt>
        <dd>{m.version ?? "—"}</dd>
        <dt>Trained at</dt>
        <dd>{m.trained_at ? formatDateTime(m.trained_at) : "—"}</dd>
        <dt>Used in forecast</dt>
        <dd>{m.used_in_forecast ? "Yes" : "No"}</dd>
        <dt>Validated (Karnataka)</dt>
        <dd>{m.validated_for_karnataka_ponds ? "Yes" : "No"}</dd>
        <dt>Datasets</dt>
        <dd className="mono">{m.dataset_ids.join(", ") || "—"}</dd>
        {m.data_origin && (
          <>
            <dt>Training data</dt>
            <dd>{m.data_origin === "external" ? "Real external dataset" : "Simulated (demo data)"}</dd>
          </>
        )}
      </dl>

      <h4 className="small" style={{ margin: "16px 0 8px", fontWeight: 800 }}>
        Evaluation metrics
      </h4>
      {m.metrics.length === 0 ? (
        <p className="small muted">No evaluation has been run, so there are no metrics to show.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th className="num">Model</th>
                <th className="num">Baseline</th>
                <th>Split</th>
              </tr>
            </thead>
            <tbody>
              {m.metrics.map((x) => (
                <tr key={`${x.name}-${x.split}`}>
                  <td>{x.name}</td>
                  <td className="num">
                    {x.value}
                    {x.unit ? ` ${x.unit}` : ""}
                  </td>
                  <td className="num">{x.baseline_value ?? "—"}</td>
                  <td>{x.split}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {m.results && (
        <>
          <h4 className="small" style={{ margin: "16px 0 8px", fontWeight: 800 }}>
            Test results
          </h4>
          <ModelResults results={m.results} />
        </>
      )}

      {m.limitations.length > 0 && (
        <>
          <h4 className="small" style={{ margin: "16px 0 8px", fontWeight: 800 }}>
            Limitations
          </h4>
          <ul className="list small">
            {m.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}

function DatasetCard({ ds: d }: { ds: DatasetInfo }) {
  const tone = d.status === "loaded" ? "implemented" : d.status === "available" ? "experimental" : "planned";
  return (
    <article className="card" aria-labelledby={`d-${d.id}`}>
      <div className="card-head">
        <div>
          <h3 id={`d-${d.id}`}>{d.name}</h3>
          <p>{TASK_LABEL[d.task]}</p>
        </div>
        <span className={`tag ${tone}`}>{DATASET_STATUS_LABEL[d.status]}</span>
      </div>
      <p className="small">{d.provenance}</p>
      <dl className="kv small" style={{ marginTop: 12 }}>
        <dt>Source</dt>
        <dd>
          {/^https?:\/\//.test(d.source_url) ? (
            <a href={d.source_url} target="_blank" rel="noreferrer noopener">
              {d.source_url.replace(/^https?:\/\//, "")}
            </a>
          ) : (
            <span className="mono">{d.source_url}</span>
          )}
        </dd>
        <dt>Licence</dt>
        <dd>{d.license ?? "Check source"}</dd>
        <dt>Records</dt>
        <dd>{d.record_count !== null ? fmtInt(d.record_count) : "Not loaded — no count available"}</dd>
        <dt>Last checked</dt>
        <dd>{d.last_checked_at ? formatDateTime(d.last_checked_at) : "—"}</dd>
      </dl>
      {d.error && (
        <div style={{ marginTop: 10 }}>
          <Notice tone="error">{d.error}</Notice>
        </div>
      )}
      <h4 className="small" style={{ margin: "16px 0 8px", fontWeight: 800 }}>
        Feature schema
      </h4>
      {d.feature_schema.length === 0 ? (
        <p className="small muted">Reported by the backend once the files are loaded.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Feature</th>
                <th>Type</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              {d.feature_schema.map((f) => (
                <tr key={f.name}>
                  <td className="mono">{f.name}</td>
                  <td>{f.type}</td>
                  <td>{f.unit ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
