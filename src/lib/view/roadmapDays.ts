/** Tagesraster der Roadmap-Timeline. Tage als "YYYY-MM-DD"-Keys (UTC), Positionen als Tag-Index. */

export const DAY_MS = 86_400_000;

export type Zoom = "q" | "m" | "w";

/** Breite eines Tages in Pixeln je Zoomstufe — Zoomwechsel ist nur ein anderer Wert. */
export const ZOOM_DAY_WIDTH: Record<Zoom, number> = { q: 2.9, m: 7.4, w: 17 };

export const MONTH_SHORT = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"] as const;

export function dayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

export function isDayKey(key: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && !Number.isNaN(parseDayKey(key).getTime());
}

export function addDays(key: string, n: number): string {
  return dayKey(new Date(parseDayKey(key).getTime() + n * DAY_MS));
}

/** Anzahl Tage von `fromKey` bis `toKey` (negativ, wenn `toKey` früher liegt). */
export function dayDiff(fromKey: string, toKey: string): number {
  return Math.round((parseDayKey(toKey).getTime() - parseDayKey(fromKey).getTime()) / DAY_MS);
}

/** ISO-8601-Kalenderwoche (Montag = Wochenstart). */
export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((t.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
}

/** "16.09.2026" */
export function formatDay(key: string): string {
  const d = parseDayKey(key);
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
}

/** "16.09." */
export function formatDayShort(key: string): string {
  const d = parseDayKey(key);
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.`;
}

export interface HeaderMonth {
  /** "YYYY-MM" */
  key: string;
  /** "Q4 · Okt 26" am Quartalsanfang, sonst "Nov 26" */
  label: string;
  /** Tag-Index der ersten sichtbaren Zelle */
  start: number;
  /** Sichtbare Tage (am Rand beschnitten) */
  days: number;
  quarterStart: boolean;
}

/** Monatszellen der Kopfzeile, am Roadmap-Rand beschnitten. */
export function monthHeaders(startKey: string, endKey: string): HeaderMonth[] {
  const total = dayDiff(startKey, endKey) + 1;
  if (total <= 0) return [];
  const out: HeaderMonth[] = [];
  const first = parseDayKey(startKey);
  let d = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1));
  for (;;) {
    const start = Math.max(0, dayDiff(startKey, dayKey(d)));
    if (start >= total) break;
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    const end = Math.min(total, dayDiff(startKey, dayKey(next)));
    const q = d.getUTCMonth() % 3 === 0;
    const yy = String(d.getUTCFullYear()).slice(2);
    const prefix = q ? `Q${Math.floor(d.getUTCMonth() / 3) + 1} · ` : "";
    out.push({
      key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      label: `${prefix}${MONTH_SHORT[d.getUTCMonth()]} ${yy}`,
      start,
      days: end - start,
      quarterStart: q,
    });
    d = next;
  }
  return out;
}

export interface HeaderWeek {
  start: number;
  days: number;
  label: string;
}

/** Tag-Index des Montags der Woche, in der `startKey` liegt (0 oder negativ). */
export function weekOffset(startKey: string): number {
  const d = parseDayKey(startKey);
  return 0 - ((d.getUTCDay() + 6) % 7) || 0;
}

/**
 * Wochenzellen (Monat/Woche: ISO-KW; Quartal: 4-Wochen-Zellen „S1–2" als
 * Sprint-Paare), an Montagen ausgerichtet und am Rand beschnitten.
 */
export function weekHeaders(startKey: string, endKey: string, zoom: Zoom): HeaderWeek[] {
  const total = dayDiff(startKey, endKey) + 1;
  if (total <= 0) return [];
  const out: HeaderWeek[] = [];
  const step = zoom === "q" ? 28 : 7;
  let i = weekOffset(startKey);
  let n = 0;
  while (i < total) {
    const start = Math.max(0, i);
    const end = Math.min(total, i + step);
    if (end > start) {
      const week = isoWeek(parseDayKey(addDays(startKey, i)));
      const label = zoom === "q" ? `S${n * 2 + 1}–${n * 2 + 2}` : zoom === "w" ? `KW ${week}` : String(week);
      out.push({ start, days: end - start, label });
    }
    i += step;
    n += 1;
  }
  return out;
}

/** Tag-Index aus einem Pixel-Offset im Rasterbereich (Drop-Ziel). */
export function dayIndexFromOffset(offsetPx: number, dayWidth: number, totalDays: number): number {
  if (dayWidth <= 0) return 0;
  return Math.min(Math.max(Math.floor(offsetPx / dayWidth), 0), Math.max(totalDays - 1, 0));
}
