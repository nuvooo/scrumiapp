/**
 * Reine Rechenhilfen für das Drag & Drop der Roadmap: Pixel → Tage (Tages-
 * bzw. Wochenraster), neue Zeitspanne nach Verschieben/Ziehen am Rand,
 * Zielspur/-block nach dem Ablegen und die Drop-Position beim Umhängen im Baum.
 */

import type { DropPosition } from "./roadmapTree";

export type DragMode = "move" | "resizeL" | "resizeR";

export interface DaySpan {
  /** Tag-Indizes im Raster (inklusive) */
  start: number;
  end: number;
}

/** Drop-Ziel auf dem Board (aus den Droppable-Daten der Zeilen). */
export type DropTarget =
  | { kind: "cell"; laneId: string; blockId: string | null }
  | { kind: "row"; blockId: string | null }
  | { kind: "miles" };

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

/**
 * Zeitspanne in den Roadmap-Zeitraum [0, total-1] klemmen. Beim Verschieben
 * wandert die ganze Spanne, beim Ziehen am Rand nur der bewegte Rand.
 */
export function clampSpan(span: DaySpan, mode: DragMode, total: number): DaySpan {
  const max = Math.max(total - 1, 0);
  if (mode === "move") {
    const len = span.end - span.start;
    let start = Math.max(0, Math.min(span.start, max - len));
    if (start < 0) start = 0;
    return { start, end: Math.min(start + len, max) };
  }
  if (mode === "resizeR") return { start: span.start, end: Math.max(span.start, Math.min(span.end, max)) };
  return { start: Math.min(span.end, Math.max(span.start, 0)), end: span.end };
}

/**
 * Spur und Block eines Tickets nach dem Ablegen: Spurzelle = Spur + Block,
 * Blockzeile = Block (Spur bleibt), Meilensteinzeile/nichts = unverändert.
 */
export function ticketTarget(
  own: { laneId: string; blockId: string | null },
  over: DropTarget | null,
): { laneId: string; blockId: string | null } {
  if (!over || over.kind === "miles") return { laneId: own.laneId, blockId: own.blockId };
  if (over.kind === "cell") return { laneId: over.laneId || own.laneId, blockId: over.blockId };
  return { laneId: own.laneId, blockId: over.blockId };
}

/** Relative Höhe (0–1) in der Zielzeile → davor / hinein / danach (Umhängen im Baum). */
export function treeDropPosition(rel: number): DropPosition {
  if (rel < 0.28) return "before";
  if (rel > 0.72) return "after";
  return "into";
}

/** Dauer in Tagen, mit der ein Jira-Ticket neu auf die Timeline kommt: Sprintlänge, sonst 2 Wochen. */
export const DEFAULT_ISSUE_DAYS = 14;

export function issueDurationDays(issue: { sprintStart?: string | null; sprintEnd?: string | null }, dayDiff: (a: string, b: string) => number): number {
  if (issue.sprintStart && issue.sprintEnd) {
    const d = dayDiff(issue.sprintStart, issue.sprintEnd) + 1;
    if (d >= 1) return d;
  }
  return DEFAULT_ISSUE_DAYS;
}
