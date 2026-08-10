import type { BurndownRow } from "@/components/charts/BurndownChart";
import { formatDateShort } from "@/lib/format";

export interface BurndownRowPoint {
  date: Date;
  value: number | null;
}

/**
 * Ideal- und Ist-Linie zu Chart-Rows mergen. Gemerged wird über den Zeitstempel
 * (Mitternacht UTC), sortiert wird nach Datum — Ist-Punkte, die nicht auf der
 * Ideal-Achse liegen, landen damit chronologisch richtig statt hinten angehängt.
 */
export function mergeBurndownRows(
  ideal: BurndownRowPoint[],
  actual: BurndownRowPoint[],
): BurndownRow[] {
  const byTime = new Map<number, { date: Date; ideal: number | null; actual: number | null }>();
  for (const p of ideal) {
    byTime.set(p.date.getTime(), { date: p.date, ideal: p.value, actual: null });
  }
  for (const p of actual) {
    const entry = byTime.get(p.date.getTime()) ?? { date: p.date, ideal: null, actual: null };
    entry.actual = p.value;
    byTime.set(p.date.getTime(), entry);
  }
  return [...byTime.values()]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((e) => ({ label: formatDateShort(e.date), ideal: e.ideal, actual: e.actual }));
}
