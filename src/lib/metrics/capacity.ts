import type { DomainSprint, DomainCapacityEntry } from "@/lib/domain/types";

export interface CapacityResult {
  totalPersonDays: number;
  efficiency: number; // Story Points pro Personentag
}

/** Gesamtkapazität (Summe Personentage) und Effizienz (completedPoints / Personentage). */
export function calcCapacityEfficiency(
  sprint: DomainSprint,
  entries: DomainCapacityEntry[],
): CapacityResult {
  const totalPersonDays = entries.reduce((sum, e) => sum + e.personDays, 0);
  // Effizienz = Durchsatz pro Personentag; daher bewusst completedPoints (nicht committedPoints).
  const efficiency = totalPersonDays === 0 ? 0 : sprint.completedPoints / totalPersonDays;
  return { totalPersonDays, efficiency };
}
