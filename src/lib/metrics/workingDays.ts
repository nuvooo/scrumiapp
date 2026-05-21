/**
 * Liste der Arbeitstage (Mo–Fr) inklusive Start und Ende, normalisiert auf Mitternacht UTC.
 *
 * Annahme: Die übergebenen Date-Objekte müssen so erzeugt sein, dass ihr UTC-Kalenderdatum
 * dem gewünschten Tag entspricht. Daten, die aus Jira-Datetime-Strings geparst werden,
 * erfüllen diese Bedingung bereits, da die Jira-API Datumswerte in UTC liefert.
 */
export function workingDaysBetween(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

  while (cursor.getTime() <= last.getTime()) {
    const dow = cursor.getUTCDay(); // 0 = So, 6 = Sa
    if (dow !== 0 && dow !== 6) {
      days.push(new Date(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}
