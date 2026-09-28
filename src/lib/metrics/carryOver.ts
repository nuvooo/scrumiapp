/**
 * Übernommene ("carry-over") Story Points: Punkte der zum Commitment zählenden
 * Issues, die bereits im vorherigen Sprint enthalten waren.
 */
export function calcCarryOver(
  committedIssues: { jiraKey: string; storyPoints: number }[],
  previousSprintKeys: Set<string>,
): number {
  return committedIssues
    .filter((i) => previousSprintKeys.has(i.jiraKey))
    .reduce((sum, i) => sum + i.storyPoints, 0);
}

export interface CarriedPlan {
  jiraKey: string;
  remainingPoints: number;
}

export interface CommitmentSplit {
  /** Mitgenommene Story Points (Rest-SP aus dem Planning bzw. automatisch erkannt). */
  carried: number;
  /** Neu eingeplante Story Points. */
  fresh: number;
  /** Commitment = mitgenommen + neu. */
  total: number;
  /** "planning" = im Planning gespeicherte Rest-SP, "auto" = aus dem Vorsprint erkannt. */
  source: "planning" | "auto";
}

/**
 * Commitment aufteilen in „mitgenommen" und „neu". Gibt es im Planning
 * gespeicherte Mitnahmen für den Sprint, zählen deren Rest-SP statt der vollen
 * Ticket-Schätzung; neu ist der Rest des Commitments ohne diese Tickets.
 * Ohne Mitnahmen bleibt das Commitment unverändert und „mitgenommen" ist der
 * automatisch erkannte Carry-Over (Tickets, die schon im Vorsprint waren).
 */
export function calcCommitmentSplit(
  committedPoints: number,
  committedIssues: { jiraKey: string; storyPoints: number }[],
  plans: CarriedPlan[],
  autoCarried: number,
): CommitmentSplit {
  if (plans.length === 0) {
    return { carried: autoCarried, fresh: Math.max(0, committedPoints - autoCarried), total: committedPoints, source: "auto" };
  }
  const carriedKeys = new Set(plans.map((p) => p.jiraKey));
  const carried = plans.reduce((sum, p) => sum + p.remainingPoints, 0);
  const carriedFull = committedIssues
    .filter((i) => carriedKeys.has(i.jiraKey))
    .reduce((sum, i) => sum + i.storyPoints, 0);
  const fresh = Math.max(0, committedPoints - carriedFull);
  return { carried, fresh, total: carried + fresh, source: "planning" };
}
