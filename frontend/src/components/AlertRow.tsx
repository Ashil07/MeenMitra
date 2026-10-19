import Link from "next/link";
import type { Alert } from "@/api/types";
import { ALERT_KIND_LABEL, ALERT_STATUS_LABEL } from "@/lib/labels";
import { formatRelative } from "@/lib/time";
import { RiskBadge } from "./RiskBadge";
import { SimulatedTag } from "./Tags";

export function AlertRow({ alert }: { alert: Alert }) {
  const simulated = alert.deliveries.some((d) => d.simulated);
  return (
    <Link href={`/alerts?id=${encodeURIComponent(alert.id)}`} className="alert-row">
      <span className="row" style={{ gap: 6 }}>
        <RiskBadge level={alert.risk_level} />
        {simulated && <SimulatedTag />}
      </span>
      <strong>{alert.title}</strong>
      <span className="small muted">
        {ALERT_KIND_LABEL[alert.kind]} · {ALERT_STATUS_LABEL[alert.status]} · {formatRelative(alert.created_at)}
      </span>
    </Link>
  );
}
