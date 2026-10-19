import type { ReactNode } from "react";
import { describeError } from "@/api";
import { Icon, type IconName } from "./Icon";

export function LoadingState({ label = "Loading…", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="stack" style={{ padding: "8px 0" }}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: i === 0 ? 22 : 14, width: `${92 - i * 14}%` }} />
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = "Something went wrong" }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <div className="state error" role="alert">
      <div className="state-icon">
        <Icon name="error" size={24} />
      </div>
      <h3>{title}</h3>
      <p>{describeError(error)}</p>
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          <Icon name="refresh" /> Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, body, icon = "pond", action }: { title: string; body?: ReactNode; icon?: IconName; action?: ReactNode }) {
  return (
    <div className="state">
      <div className="state-icon">
        <Icon name={icon} size={24} />
      </div>
      <h3>{title}</h3>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}

export function Notice({ tone = "info", children, title }: { tone?: "info" | "warn" | "error" | "success"; title?: string; children: ReactNode }) {
  const icon: IconName = tone === "error" ? "error" : tone === "warn" ? "warn" : tone === "success" ? "check" : "info";
  return (
    <div className={`notice ${tone}`} role={tone === "error" ? "alert" : undefined}>
      <Icon name={icon} />
      <div>
        {title && <strong>{title} </strong>}
        {children}
      </div>
    </div>
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}
