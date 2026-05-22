import type { DomainSprint, DomainBurndownPoint } from "@/lib/domain/types";
import { workingDaysBetween } from "./workingDays";

export interface BurndownLinePoint {
  date: Date;
  remainingPoints: number;
}

export interface Burndown {
  ideal: BurndownLinePoint[];
  actual: BurndownLinePoint[];
}

/**
 * Burndown-Daten: Ideallinie (linear committed -> 0 über die Arbeitstage des Sprints)
 * und Ist-Linie aus den gespeicherten BurndownPoints (nach Datum sortiert).
 */
export function calcBurndown(
  sprint: DomainSprint,
  points: DomainBurndownPoint[],
): Burndown {
  if (!sprint.startDate || !sprint.endDate) {
    return { ideal: [], actual: [] };
  }

  const days = workingDaysBetween(sprint.startDate, sprint.endDate);
  const steps = days.length <= 1 ? 1 : days.length - 1;
  const ideal: BurndownLinePoint[] = days.map((date, i) => ({
    date,
    remainingPoints: Math.max(
      0,
      days.length === 1 ? 0 : sprint.committedPoints * (1 - i / steps),
    ),
  }));

  // Ist-Linie: In v1 wird nur remainingPoints geplottet. Das in DomainBurndownPoint
  // enthaltene completedPoints wird zwar gespeichert/persistiert, aber hier bewusst
  // nicht dargestellt.
  const actual: BurndownLinePoint[] = [...points]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((p) => ({ date: p.date, remainingPoints: p.remainingPoints }));

  return { ideal, actual };
}

export interface BugBurndownLinePoint {
  date: Date;
  remainingBugs: number;
}

export interface BugBurndown {
  ideal: BugBurndownLinePoint[];
  actual: BugBurndownLinePoint[];
}

/**
 * Bug-Burndown: Ist-Linie aus den gespeicherten remainingBugs (nach Datum sortiert)
 * und eine lineare Ideallinie vom Bug-Stand des ersten Snapshots auf 0 über die
 * Arbeitstage. Ohne Sprint-Daten oder ohne Snapshots: leere Linien.
 */
export function calcBugBurndown(
  sprint: DomainSprint,
  points: DomainBurndownPoint[],
): BugBurndown {
  if (!sprint.startDate || !sprint.endDate || points.length === 0) {
    return { ideal: [], actual: [] };
  }

  const sorted = [...points].sort((a, b) => a.date.getTime() - b.date.getTime());
  const startBugs = sorted[0].remainingBugs;

  const days = workingDaysBetween(sprint.startDate, sprint.endDate);
  const steps = days.length <= 1 ? 1 : days.length - 1;
  const ideal: BugBurndownLinePoint[] = days.map((date, i) => ({
    date,
    remainingBugs: Math.max(0, days.length === 1 ? 0 : startBugs * (1 - i / steps)),
  }));

  const actual: BugBurndownLinePoint[] = sorted.map((p) => ({
    date: p.date,
    remainingBugs: p.remainingBugs,
  }));

  return { ideal, actual };
}

export interface TicketBurndownLinePoint {
  date: Date;
  remainingTickets: number;
}

export interface TicketBurndown {
  /** Gemessene offene Tickets pro Tag (Balken). */
  actual: TicketBurndownLinePoint[];
  /** Lineare Regressionslinie (kleinste Quadrate) durch die Ist-Werte. */
  trend: TicketBurndownLinePoint[];
}

/**
 * Ticket-Burndown: Balken aus den gespeicherten remainingTickets (nach Datum sortiert)
 * und eine Trendlinie als lineare Regression durch genau diese Ist-Werte. Die x-Achse
 * der Regression sind Tage seit dem ersten Snapshot. Ohne Snapshots: leere Listen.
 */
export function calcTicketBurndown(
  _sprint: DomainSprint,
  points: DomainBurndownPoint[],
): TicketBurndown {
  if (points.length === 0) {
    return { actual: [], trend: [] };
  }

  const sorted = [...points].sort((a, b) => a.date.getTime() - b.date.getTime());
  const actual: TicketBurndownLinePoint[] = sorted.map((p) => ({
    date: p.date,
    remainingTickets: p.remainingTickets,
  }));

  // x = Tage seit dem ersten Snapshot, y = offene Tickets.
  const dayMs = 1000 * 60 * 60 * 24;
  const t0 = sorted[0].date.getTime();
  const xs = sorted.map((p) => (p.date.getTime() - t0) / dayMs);
  const ys = sorted.map((p) => p.remainingTickets);
  const n = xs.length;
  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = ys.reduce((s, y) => s + y, 0) / n;

  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - meanX) * (ys[i] - meanY);
    sxx += (xs[i] - meanX) ** 2;
  }
  // Einzelner Punkt (oder alle x gleich): flache Linie auf dem Mittelwert.
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = meanY - slope * meanX;

  const trend: TicketBurndownLinePoint[] = sorted.map((p, i) => ({
    date: p.date,
    remainingTickets: intercept + slope * xs[i],
  }));

  return { actual, trend };
}
