import type { ReactNode } from "react";

/**
 * Large, simple pictures for the farmer screen. They always sit next to text and are hidden
 * from screen readers (aria-hidden), so the meaning never depends on the picture alone.
 */
export type PictogramName =
  | "safe"
  | "watch"
  | "danger"
  | "unknown"
  | "aerator"
  | "water"
  | "noFeed"
  | "lessFeed"
  | "feed"
  | "sunrise"
  | "eye"
  | "officer"
  | "report"
  | "fishFine"
  | "fishGasping"
  | "question"
  | "speaker";

const P: Record<PictogramName, ReactNode> = {
  safe: (
    <>
      <circle cx="24" cy="24" r="19" />
      <path d="M15 24.5l6 6 12-13" />
    </>
  ),
  watch: (
    <>
      <path d="M24 6L44 41H4L24 6z" />
      <path d="M24 19v10" />
      <circle cx="24" cy="34.5" r="0.6" fill="currentColor" />
    </>
  ),
  danger: (
    <>
      <path d="M16 5h16l11 11v16L32 43H16L5 32V16L16 5z" />
      <path d="M24 14v13" />
      <circle cx="24" cy="33.5" r="0.6" fill="currentColor" />
    </>
  ),
  unknown: (
    <>
      <circle cx="24" cy="24" r="19" />
      <path d="M18.5 19a5.5 5.5 0 1 1 7.8 5c-1.6.8-2.3 1.9-2.3 3.6v1.4" />
      <circle cx="24" cy="34.5" r="0.6" fill="currentColor" />
    </>
  ),
  aerator: (
    <>
      <circle cx="24" cy="18" r="3.5" />
      <path d="M24 14.5V6M27 19.8l7.5 4.3M21 19.8l-7.5 4.3" />
      <path d="M24 21.5V30" />
      <path d="M4 36c3.3 0 3.3-2.5 6.7-2.5s3.3 2.5 6.6 2.5 3.4-2.5 6.7-2.5 3.3 2.5 6.6 2.5 3.4-2.5 6.7-2.5 3.3 2.5 6.7 2.5" />
      <path d="M4 42.5c3.3 0 3.3-2.5 6.7-2.5s3.3 2.5 6.6 2.5 3.4-2.5 6.7-2.5 3.3 2.5 6.6 2.5 3.4-2.5 6.7-2.5 3.3 2.5 6.7 2.5" />
    </>
  ),
  water: (
    <>
      <path d="M24 5c7 9 12 15.5 12 22a12 12 0 0 1-24 0c0-6.5 5-13 12-22z" />
      <path d="M18.5 29a5.5 5.5 0 0 0 5.5 5.5" />
    </>
  ),
  noFeed: (
    <>
      <path d="M9 22h30l-3.5 15h-23L9 22z" />
      <circle cx="19" cy="17" r="2" />
      <circle cx="26" cy="15" r="2" />
      <circle cx="31" cy="18.5" r="2" />
      <path d="M6 6l36 36" strokeWidth="3.4" />
    </>
  ),
  lessFeed: (
    <>
      <path d="M9 24h30l-3.5 15h-23L9 24z" />
      <circle cx="24" cy="19" r="2" />
      <path d="M24 5v8M20.5 9.5L24 13l3.5-3.5" />
    </>
  ),
  feed: (
    <>
      <path d="M9 24h30l-3.5 15h-23L9 24z" />
      <circle cx="18" cy="18.5" r="2" />
      <circle cx="24.5" cy="16" r="2" />
      <circle cx="31" cy="18.5" r="2" />
      <circle cx="21" cy="11.5" r="2" />
      <circle cx="28" cy="10.5" r="2" />
    </>
  ),
  sunrise: (
    <>
      <path d="M12 32a12 12 0 0 1 24 0" />
      <path d="M4 32h40M24 8v6M9.5 17.5l4 4M38.5 17.5l-4 4M4 39h40" />
    </>
  ),
  eye: (
    <>
      <path d="M3 24s7.5-13 21-13 21 13 21 13-7.5 13-21 13S3 24 3 24z" />
      <circle cx="24" cy="24" r="6" />
    </>
  ),
  officer: (
    <>
      <circle cx="24" cy="15" r="7" />
      <path d="M9 43c0-8.3 6.7-15 15-15s15 6.7 15 15" />
      <path d="M16.5 9.5h15" />
    </>
  ),
  report: (
    <>
      <path d="M8 8h32v24H22l-9 8v-8H8V8z" />
      <path d="M24 14v8" />
      <circle cx="24" cy="26.5" r="0.6" fill="currentColor" />
    </>
  ),
  fishFine: (
    <>
      <path d="M5 24c6-8 17-10 26-4l9-6v20l-9-6c-9 6-20 4-26-4z" />
      <circle cx="16" cy="22" r="1" fill="currentColor" />
    </>
  ),
  fishGasping: (
    <>
      <path d="M24 44c-8-6-10-17-4-26l-6-9h20l-6 9c6 9 4 20-4 26z" transform="rotate(180 24 26)" />
      <circle cx="24" cy="31" r="1" fill="currentColor" />
      <circle cx="34" cy="10" r="2.2" />
      <circle cx="38" cy="4.5" r="1.4" />
      <path d="M4 14h12" />
    </>
  ),
  question: (
    <>
      <path d="M16.5 17a7.5 7.5 0 1 1 10.6 6.8c-2.1 1-3.1 2.6-3.1 4.9v2" />
      <circle cx="24" cy="37" r="0.6" fill="currentColor" />
    </>
  ),
  speaker: (
    <>
      <path d="M7 18h8l10-8v28l-10-8H7V18z" />
      <path d="M32 17a9 9 0 0 1 0 14M37 12a16 16 0 0 1 0 24" />
    </>
  ),
};

export function Pictogram({ name, size = 48 }: { name: PictogramName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {P[name]}
    </svg>
  );
}
