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

  const actual: BurndownLinePoint[] = [...points]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((p) => ({ date: p.date, remainingPoints: p.remainingPoints }));

  return { ideal, actual };
}
