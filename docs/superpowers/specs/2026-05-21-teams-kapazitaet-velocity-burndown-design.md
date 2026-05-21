# Design: Team-Verwaltung, Kapazität Ist/Soll, Velocity-Tabelle, Burndown-Tickets

Datum: 2026-05-21
Branch-Kontext: baut auf `feat/bug-burndown` auf (Bug-Burndown bereits vorhanden).

## Ziel

Vier zusammenhängende Erweiterungen entlang der bestehenden Schichtung
(Prisma → Repository → Domain-Mapper → reine Metrik → View-Loader → Seite):

1. **Teams bearbeiten** und **Personen dauerhaft im Team** verwalten (Roster).
2. **Kapazität mit Ist/Soll** pro Person und Sprint, als Historie (Krankheit senkt das Ist).
3. **Velocity als Tabelle** (zusätzlich zum bestehenden Chart) mit Delta/Trend.
4. **Burndown: Ticket-Anzahl inkl. Sub-Tickets** als eigene Verlaufslinie.

## Nicht-Ziele (YAGNI)

- Keine separate Abwesenheits-/Krankheits-Historie mit Datum/Grund (Ist ist ein direkt
  editierbarer Wert).
- Keine Personenzahl-Spalte ("Köpfe") in der Velocity-Tabelle — nur Personentage (PT).
- Kein Archivieren/Deaktivieren von Teammitgliedern; Entfernen genügt (Historie bleibt
  über den `name`-Snapshot erhalten).
- Kein Ausschluss von Sub-Task-Story-Points aus den SP-Summen (Sub-Tasks tragen
  üblicherweise 0 SP; sie zählen nur für die Ticket-Anzahl).

---

## Feature 1 — Team bearbeiten + Roster

### Schema
`TeamMember` existiert bereits (`id`, `teamId`, `name`, `capacityEntries`). Keine Änderung nötig.

### Repository
- `teamRepository`:
  - `updateTeam(id, { name, jiraBoardId, syncIntervalMinutes })` → `Team`
  - `deleteTeam(id)` → `Team` (Cascade entfernt Sprints/Issues/Burndown/Kapazität)
- Neu `teamMemberRepository`:
  - `listMembersForTeam(teamId)` → `TeamMember[]` (sortiert nach `name`)
  - `addMember(teamId, name)` → `TeamMember`
  - `renameMember(id, name)` → `TeamMember`
  - `removeMember(id)` → `TeamMember`

### Actions (`settings/teams/actions.ts`)
- `addTeam` (vorhanden), neu `updateTeam`, `deleteTeam`
- `addMember`, `renameMember`, `removeMember`
- Jede Action validiert Pflichtfelder und ruft `revalidatePath("/settings/teams")` (Kapazität
  zusätzlich, wo relevant).

### UI (`settings/teams/page.tsx`)
- `TeamForm` (Anlegen) bleibt oben.
- Jedes Team als Karte:
  - `TeamEditor`: Felder Name / Board-ID / Sync-Intervall + „Speichern" + „Löschen"
    (Löschen mit `confirm`-Bestätigung im Client).
  - `TeamMembers`: Liste der Mitglieder mit Inline-Umbenennen + Entfernen, plus Feld
    „Mitglied hinzufügen".
- Sync-Status-Anzeige bleibt erhalten.

---

## Feature 2 — Kapazität Ist/Soll (Historie, aus Roster)

### Schema (`CapacityEntry`, Migration erforderlich)
- Entfernen: `personDays Float`
- Hinzufügen:
  - `plannedPersonDays Float @default(0)` — Soll
  - `actualPersonDays  Float @default(0)` — Ist
- `@@unique([sprintId, teamMemberId])` für Upsert (Postgres erlaubt mehrere NULLs →
  verwaiste Alt-Einträge bleiben zulässig).
- `name` bleibt als Snapshot (Historie überlebt Umbenennen/Entfernen).
- Datenmigration: bestehende Zeilen → `plannedPersonDays = personDays`,
  `actualPersonDays = personDays`.

### Repository (`capacityRepository`)
- Ersetzen `addCapacityEntry` durch
  `upsertCapacityEntry(sprintId, teamMemberId, { name, plannedPersonDays, actualPersonDays })`
  (Upsert auf `sprintId_teamMemberId`).
- `removeCapacityEntry(id)` bleibt.
- `listCapacityForSprint(sprintId)` liefert neue Felder.
- Neu `listCapacityForSprints(sprintIds: string[])` für die Velocity-Aggregation
  (eine Abfrage statt N).

### Domain / Mapper
- `DomainCapacityEntry`: `{ teamMemberId: string | null, name, plannedPersonDays, actualPersonDays }`.
- `toDomainCapacityEntry` entsprechend anpassen.

### Metrik (`capacity.ts`)
- `calcCapacityEfficiency(sprint, entries)` → `{ totalPlanned, totalActual, efficiency }`
- `totalPlanned = Σ plannedPersonDays`, `totalActual = Σ actualPersonDays`
- `efficiency = totalActual === 0 ? 0 : completedPoints / totalActual` (Ist als Basis).

### Workflow & UI (`capacity/page.tsx`) — Variante A: virtuelle Zeilen + Upsert
- Loader `loadCapacity(sprintId)` liefert:
  - `sprintName`, `completedPoints`
  - `rows`: für jedes Teammitglied des Teams eine Zeile —
    vorhandener `CapacityEntry` ODER Default
    (`plannedPersonDays = workingDaysBetween(start, end).length`, `actualPersonDays = planned`,
    `id = null`).
  - Totale: `totalPlanned`, `totalActual`, `efficiency`.
- Seite rendert pro Mitglied ein Inline-Formular mit zwei Number-Inputs (Soll/Ist) und
  einem Speichern-Button; Action ruft `upsertCapacityEntry`.
- **Kein** Schreibzugriff während des Renders.
- Stat-Karten oben: „Personentage Soll", „Personentage Ist", „Geliefert (SP)", „Effizienz (SP/PT)".
- Leerer Zustand: Hinweis „Team hat noch keine Mitglieder — unter Einstellungen → Teams anlegen."
- Freitext-Eingabe von Personen entfällt (Roster ist die einzige Quelle).

### Default-Soll
- Default = Anzahl Arbeitstage (Mo–Fr) des Sprints via `workingDaysBetween(startDate, endDate)`.
- Falls Sprint keine Start/Enddaten hat: Default `0` (Nutzer trägt manuell ein).

---

## Feature 3 — Velocity-Tabelle (zusätzlich zum Chart)

### Metrik (`velocity.ts`)
- `VelocityPoint` erweitern um:
  - `plannedPersonDays`, `actualPersonDays`
  - `velocityDelta` (number, Velocity − Vorsprint-Velocity; erster Sprint = 0)
  - `velocityTrend` (`TrendDirection`: UP/DOWN/FLAT je Zeile)
- `calcVelocityTrend` nimmt künftig pro Sprint die PT-Summen entgegen, z.B.:
  ```ts
  interface VelocityInput { sprint: DomainSprint; plannedPersonDays: number; actualPersonDays: number; }
  calcVelocityTrend(inputs: VelocityInput[]): VelocityTrend
  ```
- `average` und der Gesamt-`trend` (erster vs. letzter) bleiben erhalten.

### Format (`format.ts`)
- Neu `formatDelta(n)` → `"+3"` / `"−2"` / `"±0"` (de-DE, Minuszeichen „−").
- `trendSymbol` (▲▼▬) bleibt.

### View-Loader (`loadVelocity(teamId)`)
- Sprints (state ≠ FUTURE) laden, Kapazität via `listCapacityForSprints` aggregieren,
  `VelocityInput[]` bauen, `calcVelocityTrend` aufrufen.

### UI (`velocity/page.tsx`)
- `VelocityChart` bleibt oben.
- Neue `VelocityTable` darunter. Spalten:
  | Sprint | Commitment (SP) | PT Soll | PT Ist | Erledigt/Velocity (SP) | Δ Vorsprint |
  - Δ-Zelle: `trendSymbol(velocityTrend)` + `formatDelta(velocityDelta)`,
    farblich (grün UP / rot DOWN / grau FLAT).

---

## Feature 4 — Burndown: Ticket-Anzahl inkl. Sub-Tickets

### Schema (`BurndownPoint`, Migration)
- Hinzufügen `remainingTickets Int @default(0)`.

### Mapper (`mapper.ts`)
- Neu `countOpenTickets(issues)` = Anzahl Issues mit `statusCategory !== "DONE"`
  (alle Typen inkl. Sub-Tasks).
- SP-Summen (`computeSprintPoints`) bleiben unverändert.

### Sync (`syncTeam.ts`)
- Bei aktivem Sprint zusätzlich `countOpenTickets(issues)` ermitteln und an
  `recordBurndownPoint(...)` durchreichen.
- `recordBurndownPoint` und `burndownRepository` um `remainingTickets` erweitern
  (create + update).

### Domain / Mapper
- `DomainBurndownPoint` um `remainingTickets: number` erweitern; `toDomainBurndownPoint` anpassen.

### Metrik (`burndown.ts`)
- Neu `calcTicketBurndown(sprint, points)` analog zu `calcBugBurndown`
  (Ideallinie vom ersten Snapshot-Stand auf 0; Ist-Linie aus `remainingTickets`).

### View-Loader (`loadBurndown`)
- Zusätzlich `ticketBurndown` zurückgeben.

### UI (`burndown/page.tsx`)
- Dritter Abschnitt „Offene Tickets" mit `BurndownChart` (`actualName="Offene Tickets"`).

### Verifikation (im Plan, vor Implementierung)
- Prüfen, ob `/rest/agile/1.0/sprint/{id}/issue` Sub-Tasks bereits liefert.
  - Falls ja: keine Änderung am Client nötig.
  - Falls nein: Sub-Tasks separat nachladen und in die Issue-Liste mischen
    (nur für die Ticket-Zählung relevant; SP bleiben 0).

---

## Teststrategie

- **Unit (reine Metriken/Helfer):**
  - `capacity`: Soll/Ist-Summen, Effizienz auf Ist-Basis, Division durch 0.
  - `velocity`: PT-Durchreichung, `velocityDelta`/`velocityTrend` pro Zeile, erster Sprint Delta 0.
  - `mapper`: `countOpenTickets` (inkl. Sub-Task-Typ, DONE ausgeschlossen).
  - `burndown`: `calcTicketBurndown` (Ideallinie, leere Eingaben).
  - `format`: `formatDelta` (+/−/±0).
- **Repository:** `teamMemberRepository` (CRUD), `updateTeam`/`deleteTeam`,
  `upsertCapacityEntry` (Insert + Update), `listCapacityForSprints`,
  `recordBurndownPoint` mit `remainingTickets`.
- **Komponenten/Seite:** Roster-Kapazitätsformular (Rendern der Zeilen + Upsert-Submit),
  `VelocityTable` (Spalten + Trendzeichen).
- **Anpassen:** bestehende Tests, die `personDays` referenzieren (z.B. `CapacityForm.test.tsx`,
  `capacityRepository.test.ts`, `capacity.test.ts`).

## Umsetzung in 4 Phasen (Abhängigkeitsreihenfolge)

1. **Team-Edit + Roster** — `teamMemberRepository`, `updateTeam`/`deleteTeam`, Actions, UI.
2. **Kapazität Ist/Soll** — Migration, `capacityRepository`-Upsert, Metrik, Roster-Seite. (hängt an 1)
3. **Velocity-Tabelle** — Metrik-Erweiterung, `formatDelta`, Loader, `VelocityTable`. (hängt an 2 wegen PT)
4. **Burndown-Ticketlinie** — Migration, `countOpenTickets`, Sync, Metrik, UI. (eigenständig)

Jede Phase endet mit grünen Tests, bevor die nächste beginnt.
