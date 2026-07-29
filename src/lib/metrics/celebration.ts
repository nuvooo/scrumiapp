import type { SprintState } from "@/lib/domain/types";
import type { TicketBurndown } from "./burndown";

export type CelebrationEffect = "confetti" | "fireworks";

export interface CelebrationInput {
  sprintState: SprintState;
  ticketBurndown: TicketBurndown;
  /** Offene Board-Tickets ohne Bugs — dieselbe Kennzahl wie die Restaufwand-Karte. */
  openTickets: number;
  /** Offene + im Sprint erledigte Tickets; 0 = Sprint hatte nie Tickets. */
  totalTickets: number;
  today: Date;
}

/** Kalendertag als vergleichbarer Schlüssel (lokale Zeit). */
function dayKey(d: Date): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/**
 * Feier-Effekt für den aktiven Sprint: Feuerwerk, wenn alle Tickets erledigt
 * sind; Feenstaub (Konfetti), wenn der letzte Ist-Punkt vor heute auf oder
 * unter der Ideallinie des Ticket-Burndowns lag. Sonst nichts.
 */
export function calcCelebration(input: CelebrationInput): CelebrationEffect | null {
  if (input.sprintState !== "ACTIVE") return null;

  if (input.totalTickets > 0 && input.openTickets === 0) return "fireworks";

  const todayKey = dayKey(input.today);
  const sorted = [...input.ticketBurndown.actual].sort((a, b) => b.date.getTime() - a.date.getTime());
  const yesterdayPoint = sorted.find((p) => dayKey(p.date) < todayKey);
  if (!yesterdayPoint) return null;

  // Der erste Snapshot ist die Baseline der Ideallinie und liegt immer exakt
  // darauf — dafür gibt es noch keinen Feenstaub.
  const baseline = sorted[sorted.length - 1];
  if (dayKey(yesterdayPoint.date) === dayKey(baseline.date)) return null;

  const idealPoint = input.ticketBurndown.ideal.find(
    (p) => dayKey(p.date) === dayKey(yesterdayPoint.date),
  );
  if (!idealPoint) return null;

  return yesterdayPoint.remainingTickets <= idealPoint.remainingTickets ? "confetti" : null;
}
