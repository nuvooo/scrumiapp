import type { DomainSprint, DomainCapacityEntry } from "@/lib/domain/types";

export interface CapacityResult {
  totalPlanned: number; // Soll-Personentage
  totalActual: number; // Ist-Personentage
  efficiency: number; // Story Points pro Ist-Personentag
}

/**
 * Median der Arbeitstage vergangener Sprints — die "typische" Sprintlänge eines
 * Teams. 0, wenn keine verwertbaren Längen vorliegen.
 */
export function typicalSprintLength(workingDayCounts: number[]): number {
  const usable = workingDayCounts.filter((n) => n > 0).sort((a, b) => a - b);
  if (usable.length === 0) return 0;
  const mid = Math.floor(usable.length / 2);
  return usable.length % 2 === 1 ? usable[mid] : (usable[mid - 1] + usable[mid]) / 2;
}

/**
 * Skaliert Standard-Personentage (bezogen auf die typische Sprintlänge des Teams)
 * anteilig auf die tatsächliche Sprintlänge, kaufmännisch auf halbe Tage gerundet.
 * Ist eine der Längen unbekannt (0), wird der Standardwert unverändert übernommen.
 */
export function scaleToSprintLength(
  defaultPersonDays: number,
  workingDayCount: number,
  referenceDayCount: number,
): number {
  if (workingDayCount <= 0 || referenceDayCount <= 0) return defaultPersonDays;
  return Math.round(((defaultPersonDays * workingDayCount) / referenceDayCount) * 2) / 2;
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
