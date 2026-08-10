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
 * Snapshots auf das Arbeitstags-Raster normalisieren: Wochenend-Snapshots (Sa/So)
 * werden auf den nächsten Arbeitstag verschoben; fallen dadurch mehrere Snapshots
 * auf denselben Tag, gewinnt der jüngste. Ergebnis ist nach Datum sortiert.
 */
function normalizeToWorkingDays(points: DomainBurndownPoint[]): DomainBurndownPoint[] {
  const byDay = new Map<number, DomainBurndownPoint>();
  const sorted = [...points].sort((a, b) => a.date.getTime() - b.date.getTime());
  for (const p of sorted) {
    const date = new Date(Date.UTC(p.date.getUTCFullYear(), p.date.getUTCMonth(), p.date.getUTCDate()));
    while (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
      date.setUTCDate(date.getUTCDate() + 1);
    }
    byDay.set(date.getTime(), { ...p, date });
  }
  return [...byDay.values()];
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
  const actual: BurndownLinePoint[] = normalizeToWorkingDays(points).map((p) => ({
    date: p.date,
    remainingPoints: p.remainingPoints,
  }));

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

  const sorted = normalizeToWorkingDays(points);
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
  ideal: TicketBurndownLinePoint[];
  actual: TicketBurndownLinePoint[];
}

/**
 * Ticket-Burndown: Ist-Linie aus den gespeicherten remainingTickets (nach Datum sortiert)
 * und eine lineare Ideallinie vom Ticket-Stand des ersten Snapshots auf 0 über die
 * Arbeitstage. Aufbau identisch zum Story-Point-Burndown, nur mit Ticket-Zahlen.
 * Ohne Sprint-Daten oder ohne Snapshots: leere Linien.
 */
export function calcTicketBurndown(
  sprint: DomainSprint,
  points: DomainBurndownPoint[],
): TicketBurndown {
  if (!sprint.startDate || !sprint.endDate || points.length === 0) {
    return { ideal: [], actual: [] };
  }

  const sorted = normalizeToWorkingDays(points);
  const startTickets = sorted[0].remainingTickets;

  const days = workingDaysBetween(sprint.startDate, sprint.endDate);
  const steps = days.length <= 1 ? 1 : days.length - 1;
  const ideal: TicketBurndownLinePoint[] = days.map((date, i) => ({
    date,
    remainingTickets: Math.max(0, days.length === 1 ? 0 : startTickets * (1 - i / steps)),
  }));

  const actual: TicketBurndownLinePoint[] = sorted.map((p) => ({
    date: p.date,
    remainingTickets: p.remainingTickets,
  }));

  return { ideal, actual };
}
