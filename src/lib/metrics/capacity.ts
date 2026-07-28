import type { DomainSprint, DomainCapacityEntry } from "@/lib/domain/types";

export interface CapacityResult {
  totalPlanned: number; // Soll-Personentage
  totalActual: number; // Ist-Personentage
  efficiency: number; // Story Points pro Ist-Personentag
}

/** Arbeitstage eines Referenz-Sprints (2 Wochen), auf den sich Standard-PT beziehen. */
export const REFERENCE_SPRINT_DAYS = 10;

/**
 * Skaliert Standard-Personentage (bezogen auf einen 10-Arbeitstage-Sprint) auf die
 * tatsächliche Sprintlänge, kaufmännisch auf halbe Tage gerundet. Ohne bekannte
 * Sprintlänge (0 Arbeitstage) wird der Standardwert unverändert übernommen.
 */
export function scaleToSprintLength(defaultPersonDays: number, workingDayCount: number): number {
  if (workingDayCount <= 0) return defaultPersonDays;
  return Math.round(((defaultPersonDays * workingDayCount) / REFERENCE_SPRINT_DAYS) * 2) / 2;
}

/** Soll-/Ist-Summen und Effizienz (completedPoints / Ist-Personentage). */
export function calcCapacityEfficiency(
  sprint: DomainSprint,
  entries: DomainCapacityEntry[],
): CapacityResult {
  const totalPlanned = entries.reduce((sum, e) => sum + e.plannedPersonDays, 0);
  const totalActual = entries.reduce((sum, e) => sum + e.actualPersonDays, 0);
  // Effizienz = Durchsatz pro tatsächlich verfügbarem Personentag (Ist).
  const efficiency = totalActual === 0 ? 0 : sprint.completedPoints / totalActual;
  return { totalPlanned, totalActual, efficiency };
}
