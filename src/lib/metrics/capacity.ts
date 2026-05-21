import type { DomainSprint, DomainCapacityEntry } from "@/lib/domain/types";

export interface CapacityResult {
  totalPlanned: number; // Soll-Personentage
  totalActual: number; // Ist-Personentage
  efficiency: number; // Story Points pro Ist-Personentag
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
