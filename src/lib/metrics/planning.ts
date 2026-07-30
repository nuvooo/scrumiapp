export interface PlanningIssueLike {
  storyPoints: number;
  statusCategory: string;
  onBoard: boolean;
}

export interface PlanningSummary {
  /** Summe der Story Points der offenen Board-Tickets. */
  plannedPoints: number;
  /** Offene Board-Tickets ohne Schätzung (storyPoints ≤ 0). */
  unestimatedCount: number;
  /** ok ≤ Forecast, tight ≤ 110 % Forecast, over darüber; null ohne Forecast. */
  verdict: "ok" | "tight" | "over" | null;
  /** SP über dem Forecast (0, wenn im Rahmen), auf eine Nachkommastelle gerundet. */
  overBy: number;
}

/** Planungs-Check: eingeplante Punkte des Sprints gegen die Prognose stellen. */
export function calcPlanning(issues: PlanningIssueLike[], forecast: number | null): PlanningSummary {
  const open = issues.filter((i) => i.statusCategory !== "DONE" && i.onBoard);
  const plannedPoints = open.reduce((sum, i) => sum + i.storyPoints, 0);
  const unestimatedCount = open.filter((i) => i.storyPoints <= 0).length;

  if (forecast === null) {
    return { plannedPoints, unestimatedCount, verdict: null, overBy: 0 };
  }
  const overBy = Math.max(0, Math.round((plannedPoints - forecast) * 10) / 10);
  const verdict = plannedPoints <= forecast ? "ok" : plannedPoints <= forecast * 1.1 ? "tight" : "over";
  return { plannedPoints, unestimatedCount, verdict, overBy };
}
