/**
 * Reine Rechenhilfen für das Drag & Drop der Roadmap: Pixel → Tage (Tages-
 * bzw. Wochenraster) und die neue Zeitspanne nach Verschieben oder Ziehen am
 * Rand. Das Zeitfenster wächst mit dem Inhalt, geklemmt wird nicht.
 */

import type { DaySpan } from "./roadmapTree";

export type DragMode = "move" | "resizeL" | "resizeR";

/** Horizontale Verschiebung in Pixeln → ganze Tage; mit `weeks` auf 7-Tage-Schritte gerastert. */
export function deltaDays(px: number, dayWidth: number, weeks = false): number {
  if (dayWidth <= 0 || !Number.isFinite(px)) return 0;
  const d = Math.round(px / dayWidth);
  return weeks ? Math.round(d / 7) * 7 : d;
}

/** Zeitspanne nach Verschieben oder Ziehen am linken/rechten Rand; Dauer bleibt ≥ 1 Tag. */
export function shiftedSpan(span: DaySpan, mode: DragMode, delta: number): DaySpan {
  if (mode === "move") return { start: span.start + delta, end: span.end + delta };
  if (mode === "resizeR") return { start: span.start, end: Math.max(span.start, span.end + delta) };
  return { start: Math.min(span.end, span.start + delta), end: span.end };
}

/** Dauer in Tagen, mit der ein Jira-Ticket neu auf die Timeline kommt: Sprintlänge, sonst 2 Wochen. */
export const DEFAULT_ISSUE_DAYS = 14;

export function issueDurationDays(
  issue: { sprintStart?: string | null; sprintEnd?: string | null },
  dayDiff: (a: string, b: string) => number,
): number {
  if (issue.sprintStart && issue.sprintEnd) {
    const d = dayDiff(issue.sprintStart, issue.sprintEnd) + 1;
    if (d >= 1) return d;
  }
  return DEFAULT_ISSUE_DAYS;
}
