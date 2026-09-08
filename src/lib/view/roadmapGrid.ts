/** Monatsraster der Roadmap-Timeline. Monate als "YYYY-MM"-Keys (UTC-Monatserster). */

export const MONTH_LABELS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"] as const;

export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function parseMonthKey(key: string): Date {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, 1));
}

export function addMonths(key: string, n: number): string {
  const d = parseMonthKey(key);
  return monthKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)));
}

export function monthDiff(fromKey: string, toKey: string): number {
  const a = parseMonthKey(fromKey);
  const b = parseMonthKey(toKey);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

export interface MonthColumn {
  key: string;
  label: string;
}

export function monthColumns(startKey: string, endKey: string): MonthColumn[] {
  const count = Math.max(monthDiff(startKey, endKey) + 1, 0);
  return Array.from({ length: count }, (_, i) => {
    const key = addMonths(startKey, i);
    return { key, label: MONTH_LABELS[parseMonthKey(key).getUTCMonth()] };
  });
}

export interface QuarterGroup {
  label: string;
  span: number;
}

export function quarterGroups(startKey: string, endKey: string): QuarterGroup[] {
  const groups: QuarterGroup[] = [];
  for (const col of monthColumns(startKey, endKey)) {
    const d = parseMonthKey(col.key);
    const label = `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.span += 1;
    else groups.push({ label, span: 1 });
  }
  return groups;
}

export interface BarGeometry {
  /** 0-basierter Startindex im Raster */
  start: number;
  /** Anzahl Monate (>= 1) */
  span: number;
  clippedLeft: boolean;
  clippedRight: boolean;
}

/** Balkenposition im Raster; null, wenn der Eintrag komplett außerhalb liegt. */
export function barGeometry(
  gridStartKey: string,
  monthCount: number,
  itemStartKey: string,
  itemEndKey: string,
): BarGeometry | null {
  const rawStart = monthDiff(gridStartKey, itemStartKey);
  const rawEnd = monthDiff(gridStartKey, itemEndKey);
  if (rawEnd < rawStart || rawEnd < 0 || rawStart > monthCount - 1) return null;
  const start = Math.max(rawStart, 0);
  const end = Math.min(rawEnd, monthCount - 1);
  return { start, span: end - start + 1, clippedLeft: rawStart < 0, clippedRight: rawEnd > monthCount - 1 };
}

/** Monatsindex aus einem Pixel-Offset im Rasterbereich (Drop-Ziel, Drag-Snap). */
export function monthIndexFromOffset(offsetPx: number, monthWidth: number, monthCount: number): number {
  if (monthWidth <= 0) return 0;
  const i = Math.floor(offsetPx / monthWidth);
  return Math.min(Math.max(i, 0), monthCount - 1);
}
