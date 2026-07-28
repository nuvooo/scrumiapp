export interface ForecastInput {
  /** Abgeschlossene Story Points eines vergangenen Sprints. */
  velocity: number;
  /** Tatsächlich verfügbare Personentage dieses Sprints. */
  actualPersonDays: number;
}

export interface Forecast {
  /** Gepoolte historische Effizienz in SP pro Personentag. */
  efficiency: number;
  /** Prognostizierte Story Points für die geplanten Personentage. */
  possiblePoints: number;
  /** Anzahl der Sprints, auf denen die Prognose basiert. */
  basedOnSprints: number;
}

/**
 * Prognose: Wie viele Story Points sind mit den geplanten Personentagen möglich?
 * Effizienz wird über die Summen gepoolt (Σ Velocity / Σ Ist-PT), damit kurze
 * Sprints nicht überproportional gewichtet werden. Sprints ohne Ist-PT werden
 * ignoriert. Ohne verwertbare Historie wird null geliefert.
 */
export function calcForecast(history: ForecastInput[], plannedPersonDays: number): Forecast | null {
  const usable = history.filter((h) => h.actualPersonDays > 0);
  const totalDays = usable.reduce((sum, h) => sum + h.actualPersonDays, 0);
  if (usable.length === 0 || totalDays === 0) return null;

  const totalVelocity = usable.reduce((sum, h) => sum + h.velocity, 0);
  const efficiency = totalVelocity / totalDays;
  return {
    efficiency,
    possiblePoints: efficiency * plannedPersonDays,
    basedOnSprints: usable.length,
  };
}
