# Feature: Status-Verweildauer im Standup

**Datum:** 2026-07-30 · **Status:** vom Nutzer freigegeben

## Ziel

Im Standup auf jeder offenen Ticket-Card zeigen, wie lange das Ticket schon im
aktuellen Status ist. Hängt es länger als 5 Arbeitstage, warnt ein rotes Icon.

## Entscheidungen (mit Nutzer geklärt)

- **Exakter Status, nicht Status-Kategorie:** Auch ein Wechsel „In Arbeit →
  Review" setzt die Uhr zurück. Datenquelle ist das Issue-Changelog, nicht das
  Feld `statuscategorychangedate`.
- **Arbeitstage (Mo–Fr)** als Zählbasis, Warnung bei **mehr als 5 Arbeitstagen**.
- Nur **offene Tickets** bekommen die Anzeige; bei erledigten ist sie wertlos.

## Umsetzung

1. **Sync — `statusSince` aus dem Changelog:** Der Sprint-Issue-Abruf bekommt
   `expand=changelog` und das Feld `created` dazu. Pure Funktion
   `statusSinceFromChangelog(raw)` im Mapper: Zeitpunkt des letzten Eintrags mit
   einem `status`-Item; ohne Status-Wechsel gilt `created`. Ist das
   Inline-Changelog abgeschnitten (`histories.total > histories.maxResults` —
   Jira liefert die ältesten zuerst, die neuesten fehlen dann), wird für genau
   diese Issues das Changelog über
   `/rest/api/3/issue/{key}/changelog?startAt=…` nachgeladen (letzte Seite
   reicht).
2. **Datenmodell:** `Issue.statusSince DateTime?` (Prisma-Migration),
   `DomainIssue.statusSince: Date | null`, Repository/Sync reichen es durch.
   Bestehende Zeilen bleiben `null` — bis zum nächsten Sync wird schlicht
   nichts angezeigt.
3. **Metrik `workingDaysInStatus(statusSince, today)`** in
   `src/lib/metrics/standup.ts` (pure, getestet): Arbeitstage seit dem Wechsel
   auf Basis von `workingDaysBetween`, exklusive des Wechseltags selbst
   (Wechsel heute ⇒ 0). Schwellwert-Konstante `STALE_AFTER_WORKING_DAYS = 5`.
4. **Loader `loadStandup`:** gibt je offenem Ticket `daysInStatus`
   (`number | null`) und `stale` (`boolean`) mit an die View.
5. **Anzeige `StandupBoard`:** auf offenen Cards dezenter Text „seit 3 Tagen"
   („heute" bei 0). Bei `stale` wird der Text rot und ein rotes Warn-Dreieck
   mit Tooltip „Seit 8 Arbeitstagen in ‚Review'" erscheint. `null` ⇒ keine
   Anzeige.

## Tests

- Mapper: letzter Status-Wechsel gewinnt, Nicht-Status-Einträge ignoriert,
  kein Wechsel ⇒ `created`, abgeschnittenes Changelog wird nachgeladen.
- `standup.test.ts`: `workingDaysInStatus` (heute ⇒ 0, über Wochenende,
  Schwellwert bei 5/6 Tagen), `null`-Durchreichung.
- `StandupBoard.test.tsx`: Text „seit X Tagen", Warn-Icon nur bei `stale`,
  keine Anzeige bei `null` und auf erledigten Cards.

## Hinweis Betrieb

Nach dem Deploy einen Sync ausführen, damit `statusSince` befüllt wird (der
aktive Sprint wird bei jedem Sync ohnehin neu geladen — normaler Sync genügt).
