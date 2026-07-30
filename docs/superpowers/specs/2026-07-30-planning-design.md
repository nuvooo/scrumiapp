# Feature: Refinement & Planning

**Datum:** 2026-07-30 · **Status:** vom Nutzer freigegeben

## Ziel

Eine Planning-Seite für den nächsten geplanten Sprint: Planungs-Check
(eingeplante Punkte vs. Forecast), Refinement-Ticketliste und Planning
Poker am geteilten Bildschirm mit Rückschreiben der Schätzung nach Jira.

## Entscheidungen (mit Nutzer geklärt)

- **Eine Seite für beides:** Planungs-Check oben, Ticketliste darunter.
- **Planning Poker am geteilten Bildschirm** (ein Gerät, kein
  Mehrbenutzer-Sync): Fibonacci-Karten, Moderator tippt den Konsens an.
- **Schätzung wird nach Jira geschrieben** (PUT aufs Story-Points-Feld),
  danach die lokale Issue-Zeile nachgezogen. Jira-Fehler ⇒ Meldung, keine
  lokale Änderung.

## Umsetzung

1. **Metrik `calcPlanning`** (`src/lib/metrics/planning.ts`, pure,
   getestet): Eingaben Board-Issues des Sprints (nicht-DONE, onBoard) und
   `forecast | null`. Ausgaben: `plannedPoints` (SP-Summe),
   `unestimatedCount` (storyPoints ≤ 0), `verdict`: `ok` (≤ Forecast),
   `tight` (≤ 110 % Forecast), `over` (darüber), `null` ohne Forecast,
   plus `overBy` (SP über Forecast, gerundet).
2. **`JiraClient.setStoryPoints(issueKey, points)`**:
   `PUT /rest/api/3/issue/{key}` mit `{ fields: { [storyPointsField]:
   points } }`; wirft bei non-OK. Interface + Cloud-Implementierung + Tests
   (Request-Form, Fehlerfall).
3. **Loader `loadPlanning(teamId)`**: nächster FUTURE-Sprint des Teams
   (frühestes startDate, sonst Name), dessen Board-Issues (Key, Titel,
   Typ, Status, SP, Jira-URL), `totalPlanned` aus `loadCapacity`,
   Forecast über das vorhandene `loadForecast`, Ergebnis von
   `calcPlanning`. `null` ohne geplanten Sprint.
4. **Server Action `estimateIssue`**
   (`src/app/(app)/planning/actions.ts`): erst Jira (`setStoryPoints`),
   dann `prisma.issue.update` (alle Zeilen mit diesem jiraKey im Sprint),
   `revalidatePath("/planning")`. Rückgabe `{ ok } | { ok: false,
   error }`.
5. **Seite `/planning`** (Nav „Planning" nach Standup, Sprint-Dropdown
   wird ignoriert — wie beim Standup): KPI-Kacheln *Eingeplant*,
   *Forecast*, *Ohne Schätzung* plus Ampelzeile („7 SP über der
   Prognose"). Ohne geplanten Sprint: Hinweis.
6. **`PlanningList`** (Client): Ticket-Cards im Standup-Stil mit
   Punkte-Badge; unbewertete zuerst und hervorgehoben („ohne Schätzung");
   je Card „Schätzen"-Button. **Poker-Overlay:** großes Ticket,
   Fibonacci-Karten (1, 2, 3, 5, 8, 13, 20, „?"), Karte wählen →
   „Übernehmen" ruft die Action, danach automatisch das nächste
   unbewertete Ticket; „?" nur schließen/weiter ohne Schreiben.
   Fehlermeldung der Action wird im Overlay gezeigt. Escape/Hintergrund
   schließt.

## Tests

- `planning.test.ts`: Summen, Unbewertet-Zählung, Ampel-Schwellen
  (ok/tight/over, ohne Forecast), Rundung.
- `jiraClient.test.ts`: setStoryPoints Request-Form und Fehlerfall.
- `PlanningList.test.tsx`: unbewertete zuerst, Poker öffnet, Karte +
  Übernehmen ruft Action mit Punkten, Weiter zum nächsten unbewerteten,
  Fehleranzeige.

## Nicht-Ziele

- Kein Mehrbenutzer-Poker, keine Tickets in den Sprint ziehen (Scope
  bleibt in Jira), kein Timer im Poker.
