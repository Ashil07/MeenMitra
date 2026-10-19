/** All MeenMitra times are shown in India Standard Time (UTC+05:30, no DST). */
export const IST_OFFSET_MIN = 330;

function toIstParts(d: Date) {
  const ist = new Date(d.getTime() + IST_OFFSET_MIN * 60_000);
  return {
    y: ist.getUTCFullYear(),
    m: ist.getUTCMonth() + 1,
    d: ist.getUTCDate(),
    h: ist.getUTCHours(),
    min: ist.getUTCMinutes(),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD for the IST calendar day containing `d`. */
export function istDateString(d: Date = new Date()): string {
  const p = toIstParts(d);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

/** ISO string with +05:30 offset for `dateStr` (YYYY-MM-DD) at `hour` IST; hour may exceed 23. */
export function istIso(dateStr: string, hour: number, minute = 0): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utcMs = Date.UTC(y, m - 1, d, hour, minute) - IST_OFFSET_MIN * 60_000;
  const p = toIstParts(new Date(utcMs));
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.min)}:00+05:30`;
}

export function istHour(iso: string): number {
  return toIstParts(new Date(iso)).h;
}

/** "3:00 AM" in IST. */
export function formatClock(iso: string): string {
  const { h, min } = toIstParts(new Date(iso));
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(min)} ${suffix}`;
}

/** "3 AM" compact label for chart axes. */
export function formatHourShort(iso: string): string {
  const { h } = toIstParts(new Date(iso));
  const suffix = h < 12 ? "a" : "p";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${suffix}`;
}

/** "19 Oct, 5:12 PM" in IST. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const p = toIstParts(new Date(iso));
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][p.m - 1];
  return `${p.d} ${month}, ${formatClock(iso)}`;
}

export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
  return `${d} ${month} ${y}`;
}

/** "5 min ago", "3 h ago", "2 d ago". */
export function formatRelative(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "never";
  const diff = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff} min ago`;
  if (diff < 60 * 24) return `${Math.round(diff / 60)} h ago`;
  return `${Math.round(diff / (60 * 24))} d ago`;
}

export function daysBetween(fromDate: string, to: Date = new Date()): number {
  const [y, m, d] = fromDate.split("-").map(Number);
  return Math.floor((to.getTime() - Date.UTC(y, m - 1, d)) / 86_400_000);
}
