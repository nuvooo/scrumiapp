import type { DomainSprint, TrendDirection } from "@/lib/domain/types";
import { calcCarryOver } from "./carryOver";

export interface VelocityPoint {
  sprintName: string;
  velocity: number;
  committed: number;
  carriedOver: number;
}

export interface VelocityTrend {
  points: VelocityPoint[];
  average: number;
  trend: TrendDirection;
}

/** Velocity je Sprint plus Durchschnitt und Trendrichtung (erster vs. letzter Sprint). */
export function calcVelocityTrend(sprints: DomainSprint[]): VelocityTrend {
  const points: VelocityPoint[] = sprints.map((s) => ({
    sprintName: s.name,
    velocity: s.completedPoints,
    committed: s.committedPoints,
    carriedOver: calcCarryOver(s),
  }));

  if (points.length === 0) {
    return { points, average: 0, trend: "FLAT" };
  }

  const average =
    points.reduce((sum, p) => sum + p.velocity, 0) / points.length;

  const first = points[0].velocity;
  const last = points[points.length - 1].velocity;
  const trend: TrendDirection = last > first ? "UP" : last < first ? "DOWN" : "FLAT";

  return { points, average, trend };
}
