"use client";

import type { Alert } from "@/api/types";

/**
 * The pilot metrics promised in the proposal that the current data can actually support:
 * how many alerts reached farmers (simulated in the demo) and how many farmers replied.
 * Fish-kill events and feed saved need field records and are not computed here.
 */
export function PilotMetrics({ alerts, demo }: { alerts: Alert[]; demo: boolean }) {
  const delivered = alerts.filter((a) => a.deliveries.some((d) => d.status === "delivered"));
  const replied = delivered.filter((a) => a.status === "acknowledged");
  const rate = delivered.length ? Math.round((replied.length / delivered.length) * 100) : null;
  const notices = alerts.filter((a) => a.kind === "outbreak_notice");
  const drafts = alerts.filter((a) => a.status === "draft").length;

  const tiles: { label: string; value: string; note: string }[] = [
    { label: "Alerts delivered", value: String(delivered.length), note: demo ? "Simulated delivery" : "Reached a farmer's phone" },
    { label: "Alerts acted on", value: rate === null ? "—" : `${rate}%`, note: `${replied.length} farmer repl${replied.length === 1 ? "y" : "ies"} to delivered alerts` },
    { label: "Outbreak notices", value: String(notices.length), note: "Anonymous canal warnings" },
    { label: "Waiting to send", value: String(drafts), note: "Drafted alerts not yet sent" },
  ];

  return (
    <div className="grid grid-4">
      {tiles.map((t) => (
        <div key={t.label} className="stat">
          <div className="stat-label">{t.label}</div>
          <div className="stat-value">{t.value}</div>
          <div className="stat-note">{t.note}</div>
        </div>
      ))}
    </div>
  );
}
