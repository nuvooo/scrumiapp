import type { DomainSprint } from "@/lib/domain/types";

/** Nicht abgeschlossene ("mitgenommene") Story Points eines Sprints. Nie negativ. */
export function calcCarryOver(sprint: DomainSprint): number {
  return Math.max(0, sprint.committedPoints - sprint.completedPoints);
}
