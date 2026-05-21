import type { DomainSprint, TrendDirection } from "@/lib/domain/types";
import { calcCarryOver } from "./carryOver";

export interface VelocityPoint {
  sprintName: string;
  velocity: number;
  committed: number;
  carriedOver: number;
  plannedPersonDays: number;
  actualPersonDays: number;
  velocityDelta: number; // Velocity − Vorsprint-Velocity (erster Sprint: 0)
  velocityTrend: TrendDirection;
}

export interface VelocityInput {
  sprint: DomainSprint;
  plannedPersonDays: number;
  actualPersonDays: number;
}

export interface VelocityTrend {
  points: VelocityPoint[];
  average: number;
  trend: TrendDirection;
}

/** Velocity je Sprint mit PT-Summen, Delta/Trend zum Vorsprint sowie Gesamt-Durchschnitt und -Trend. */
export function calcVelocityTrend(inputs: VelocityInput[]): VelocityTrend {
  const points: VelocityPoint[] = inputs.map((inp, i) => {
    const velocity = inp.sprint.completedPoints;
    const prev = i > 0 ? inputs[i - 1].sprint.completedPoints : null;
    const velocityDelta = prev === null ? 0 : velocity - prev;
    const velocityTrend: TrendDirection =
      velocityDelta > 0 ? "UP" : velocityDelta < 0 ? "DOWN" : "FLAT";
    return {
      sprintName: inp.sprint.name,
      velocity,
      committed: inp.sprint.committedPoints,
      carriedOver: calcCarryOver(inp.sprint),
      plannedPersonDays: inp.plannedPersonDays,
      actualPersonDays: inp.actualPersonDays,
      velocityDelta,
      velocityTrend,
    };
  });

  if (points.length === 0) {
    return { points, average: 0, trend: "FLAT" };
  }

  const average = points.reduce((sum, p) => sum + p.velocity, 0) / points.length;
  const first = points[0].velocity;
  const last = points[points.length - 1].velocity;
  const trend: TrendDirection = last > first ? "UP" : last < first ? "DOWN" : "FLAT";

  return { points, average, trend };
}
