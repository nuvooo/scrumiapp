# Planning: Carry-Over-Sektion (Design)

Datum: 2026-08-10 · Status: vom Nutzer freigegeben

## Kontext

Beim Sprint Planning (SP1) fehlt der Blick auf die offen gebliebenen Tickets des
laufenden Sprints. Das Team muss entscheiden, welche Tickets mitgenommen werden
und mit wie vielen Rest-Story-Points — ohne die Schätzung am Jira-Ticket zu
verändern. Zusätzlich sollen Tickets schon jetzt in geplante (FUTURE-)Sprints
verschoben werden können.

## Entscheidungen (mit Nutzer abgestimmt)

- Quelle der offenen Tickets: **aktiver Sprint** (`statusCategory !== DONE && onBoard`).
- Rest-SP der als „mitnehmen" markierten Tickets **fließen in die KPI
  „Eingeplant" und den Forecast-Verdict ein**.
- Verschieben in geplante Sprints ist ein **echtes Jira-Verschieben**
  (Agile-API), gilt **nur für Carry-Over-Tickets**. Story Points werden dabei
  nicht angefasst.

## Umsetzung

### Datenmodell

Neue Prisma-Tabelle `CarryOverPlan` — sync-resistent (der Issue-Sync ersetzt
Issues per delete+create, Felder am Issue-Modell würden verloren gehen):

```prisma
model CarryOverPlan {
  id              String  @id @default(cuid())
  sprintId        String            // aktiver Sprint, aus dem das Ticket stammt
  jiraKey         String
  takeAlong       Boolean @default(true)
  remainingPoints Float   @default(0)
  updatedAt       DateTime @updatedAt
  sprint          Sprint  @relation(...)
  @@unique([sprintId, jiraKey])
}
```

Durch die Bindung an den aktiven Sprint setzen sich Markierungen beim
Sprintwechsel automatisch zurück.

### Jira-Client

Neue Methode `moveIssuesToSprint(jiraSprintId, issueKeys[])` via
`POST /rest/agile/1.0/sprint/{id}/issue` — nach dem Muster von
`setStoryPoints` (`src/lib/jira/jiraClient.ts:129`).

### Server Actions (`src/app/(app)/planning/actions.ts`, neu)

- `saveCarryOverMark(sprintId, jiraKey, takeAlong, remainingPoints)` — nur DB.
- `moveIssueToPlannedSprint(issueKey, targetSprintId)` — erst Jira, dann lokale
  DB in `$transaction` (Issue-Row in Zielsprint umhängen, Mark löschen) —
  Muster wie `acceptEstimate` (`src/app/(app)/refinement/actions.ts:352`).
- Beide mit `revalidatePath("/planning")`.

### UI (Planning-Seite)

Neue Sektion „Offen aus [aktiver Sprint]" oberhalb der Planungsliste, als
Client-Komponente `CarryOverList`:

- pro Ticket: Checkbox „mitnehmen", Rest-SP-Eingabe (vorbefüllt mit aktuellen
  SP), Original-SP, Status, Jira-Link
- beide Listen (Carry-Over + Planung) zeigen keine Subtasks und keine Tickets
  ohne Story Points — geplant wird auf Story-Ebene (Nachtrag vom Nutzer);
  die KPI „Ohne Schätzung" zählt weiterhin alle offenen Board-Tickets
- Dropdown „Verschieben nach…" mit FUTURE-Sprints des Teams
- KPI „Eingeplant" = Planungs-SP + Rest-SP der mitgenommenen Tickets; Verdict
  rechnet damit; neue Card „Carry-Over" (Anzahl + Rest-SP-Summe)

Bestehende `PlanningList` bleibt unverändert.

### Tests

- Metrik: kombinierte Eingeplant-Rechnung (Planungs-SP + Rest-SP)
- Repository-Test `CarryOverPlan`
- JiraClient-Mock um `moveIssuesToSprint` erweitern
