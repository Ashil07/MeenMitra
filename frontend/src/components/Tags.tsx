import type { DataSource, ImplementationStatus } from "@/api/types";

export function SourceTag({ source }: { source: DataSource }) {
  return source === "live" ? (
    <span className="tag live" title="Returned by the MeenMitra backend">
      Live API
    </span>
  ) : (
    <span className="tag demo" title="Demo fixture data generated in the browser — not from the backend">
      Demo data
    </span>
  );
}

export function EstimateTag() {
  return (
    <span className="tag estimate" title="Calculated by a model. Not a measurement from the pond.">
      Model estimate
    </span>
  );
}

export function MeasuredTag() {
  return (
    <span className="tag measured" title="Entered by the farmer from a test kit">
      Farmer measured
    </span>
  );
}

export function SimulatedTag({ label = "Simulated" }: { label?: string }) {
  return (
    <span className="tag sim" title="No real message, SMS or call was sent">
      {label}
    </span>
  );
}

const STATUS_LABEL: Record<ImplementationStatus, string> = {
  implemented: "Implemented (demo)",
  experimental: "Experimental",
  planned: "Planned",
};

export function StatusTag({ status }: { status: ImplementationStatus }) {
  return <span className={`tag ${status}`}>{STATUS_LABEL[status]}</span>;
}
