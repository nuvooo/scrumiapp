# Bug-Burndown — Design

**Datum:** 2026-05-21
**Status:** Freigegeben (Design), Implementierung ausstehend

## Ziel

Ein zweites Burndown-Chart, das die **Anzahl offener Bugs** über einen Sprint
zeigt — getrennt vom bestehenden, story-point-basierten Burndown. Bugs haben in
der Praxis oft 0 Story Points; ein punktbasierter Bug-Burndown wäre daher meist
leer. Deshalb misst dieses Chart Bug-**Anzahlen**, nicht Punkte.

## Designentscheidungen

| Frage | Entscheidung |
|-------|--------------|
| Metrik (Y-Achse) | Anzahl offener (nicht-DONE) Bugs pro Tag |
| Platzierung | Zweites Chart auf der bestehenden Burndown-Seite, unter dem Story-Burndown |
| Bug-Erkennung | Konfigurierbar via `JIRA_BUG_ISSUE_TYPES`, Default `"Bug,Fehler"`, case-insensitive |
| Linien | Ist-Linie + lineare Ideallinie |

## Architektur & Datenfluss

Jira → Sync → Snapshot (`BurndownPoint`) → Metrik (`calcBugBurndown`) → View-Loader → Chart.

Der Bug-Burndown nutzt dieselbe Snapshot-Mechanik wie der Story-Burndown: Jira
liefert keine historischen Tageswerte, daher wird bei jedem Sync eines ACTIVE-
Sprints der aktuelle Stand als Tages-Snapshot festgehalten.

## 1. Datenmodell (Prisma-Migration)

- **`Issue.issueType String @default("")`** — Vorgangstyp-Name aus Jira (z.B.
  "Bug", "Story", "Fehler"). Bestehende Zeilen werden beim nächsten Sync via
  `replaceIssuesForSprint` ohnehin neu geschrieben; der Default deckt die
  Migration der Altbestände ab.
- **`BurndownPoint.remainingBugs Int @default(0)`** — Tages-Snapshot der Anzahl
  offener Bugs.

**Limitierung (bewusst):** Der Bug-Verlauf wächst erst ab dem ersten Sync nach
dem Release. Für vergangene Tage / bestehende Snapshots steht `remainingBugs = 0`
(kein Backfill, da Jira die Historie nicht hergibt).

## 2. Sync / Jira

- `JiraIssueRaw` (in `src/lib/jira/types.ts`) um `issuetype: { name: string }`
  erweitern.
- `mapIssue` (in `src/lib/jira/mapper.ts`) setzt
  `issueType: raw.fields.issuetype.name`.
- `DomainIssue` (in `src/lib/domain/types.ts`) um `issueType: string` erweitern.
- `replaceIssuesForSprint` (in `src/lib/repositories/issueRepository.ts`)
  persistiert `issueType`.
- **Neue Config** `getBugIssueTypes()`: liest `JIRA_BUG_ISSUE_TYPES`, splittet an
  Komma, trimmt, lowercased → `Set<string>`. Default `["bug", "fehler"]` wenn die
  Variable fehlt oder leer ist.
- **Neuer Helper** `countOpenBugs(issues, bugTypes)`: Anzahl der Issues mit
  `issueType.toLowerCase() ∈ bugTypes` **und** `statusCategory !== "DONE"`.
- In `syncTeam` (nur für ACTIVE-Sprint, im bestehenden `recordBurndownPoint`-
  Block) `countOpenBugs` berechnen und durchreichen.

## 3. Persistenz

- `recordBurndownPoint(sprintId, date, remainingPoints, completedPoints, remainingBugs)`
  — neuer Parameter `remainingBugs`, in `create`/`update` aufgenommen.

## 4. Metrik

- **Neue Funktion** `calcBugBurndown(sprint, points)` in
  `src/lib/metrics/burndown.ts` (oder eigene Datei `bugBurndown.ts`), analog zu
  `calcBurndown`:
  - **Ist:** je Snapshot `{ date, remaining: remainingBugs }`, nach Datum
    sortiert.
  - **Ideal:** linear vom Bug-Stand des **ersten** (frühesten) Snapshots auf 0
    über die Arbeitstage des Sprints. Es gibt keinen „committed"-Wert für Bugs;
    der erste gemessene Stand ist der ehrlichste Startpunkt.
  - Ohne `startDate`/`endDate` oder ohne Snapshots: `{ ideal: [], actual: [] }`.

## 5. View-Schicht

- `DomainBurndownPoint` (in `src/lib/domain/types.ts`) um `remainingBugs: number`
  erweitern.
- `toDomainBurndownPoint` (in `src/lib/view/mappers.ts`) mappt `remainingBugs`.
- `loadBurndown` (in `src/lib/view/loaders.ts`) gibt zusätzlich `bugBurndown`
  (Ergebnis von `calcBugBurndown`) zurück.

## 6. UI

- `BurndownChart` (in `src/components/charts/BurndownChart.tsx`) minimal
  generalisieren: optionale Props für die Bezeichnung der Ist-Serie (Default
  "Ist"), damit das Bug-Chart die Linie z.B. "Offene Bugs" nennen kann. Sonst
  unverändert wiederverwenden.
- `burndown/page.tsx`: nach dem Story-Chart einen zweiten Block "Bug-Burndown"
  mit eigenem Datensatz (aufgebaut wie der vorhandene `byLabel`-Merge, aber aus
  `data.bugBurndown`). Eigener Empty-State, wenn keine Bug-Snapshots existieren.
  Bug-Anzahlen sind ganzzahlig — kein `roundTo1`, sondern ganze Zahlen.

## 7. Tests (TDD)

- `mapper.test.ts`: `issueType` wird übernommen; fehlender Typ → Default.
- `countOpenBugs`: zählt nur Bug-Typen mit Status ≠ DONE; case-insensitive;
  mehrere konfigurierte Typen.
- `calcBugBurndown`: Ist- und Ideallinie korrekt; leere Eingabe → leer.
- `syncTeam.test.ts`: `remainingBugs` wird beim ACTIVE-Sprint gespeichert.
- View-Mapper-Test: `remainingBugs` wird gemappt.

## 8. Konfiguration / Doku

- `.env` und `.env.example` um `JIRA_BUG_ISSUE_TYPES="Bug,Fehler"` ergänzen.
- README: kurzer Hinweis auf die neue Variable und das Bug-Burndown-Chart.

## Nicht im Scope

- Kein Backfill historischer Bug-Stände.
- Kein umschaltbarer Modus (Anzahl vs. Punkte) — nur Anzahl.
- Keine eigene Bug-spezifische Seite/Navigation.
