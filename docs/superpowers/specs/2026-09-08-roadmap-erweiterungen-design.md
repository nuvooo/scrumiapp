# Design: Roadmap-Erweiterungen (Karten, Labels, Meilensteine, Offcanvas, Fortschritt)

Datum: 2026-09-08
Status: Entwurf, vom Nutzer abgenommen (Brainstorming-Dialog)
Baut auf: `2026-09-08-roadmap-design.md` (Grundfeature, bereits in `master`)

## Ziel

Fünf Erweiterungen des Roadmap-Features:

1. **Größere Eintrags-Karten** mit mehr Informationen (Key + Typ, Story Points,
   Bearbeiter, Status, Label-Chips).
2. **Labels** — frei definierbare farbige Tags pro Roadmap, mehrere je Eintrag.
3. **Meilensteine** — roadmap-weite Zeitpunkt-Marker (vertikale Linie über alle
   Bahnen).
4. **Offcanvas** — das Reinziehen von Tickets läuft über ein von rechts
   einschwebendes Overlay statt der festen Seitenleiste.
5. **Fortschrittsanzeige pro Bahn** — mehrfarbiger Balken (nach Status) mit
   Story-Points-Summe „X/Y SP".

## Entscheidungen aus dem Brainstorming

- Labels und Meilensteine sind zwei getrennte Konzepte (farbige Tags vs.
  roadmap-weite Marker).
- Story Points liegen pro Roadmap-Eintrag: bei Jira-Tickets aus Jira gezogen und
  beim Status-Refresh aktualisiert, bei eigenen Zielen manuell gepflegt.
- Fortschritt wird pro Bahn (Swimlane) aggregiert — keine Epic-Kind-Aggregation
  aus Jira (bewusst ausgeklammert, siehe YAGNI).
- Karten zeigen: Jira-Key + Typ-Badge, Story Points, Bearbeiter, Status,
  Label-Chips.
- Meilensteine roadmap-weit als vertikale Linie + Rauten-Marker in einer Zeile
  über den Bahnen.
- Labels pro Roadmap (eigene Palette), ein Eintrag kann mehrere tragen.
- Reinziehen per Drag aus dem Offcanvas (Panel wird beim Drag durchlässig).
- Fortschrittsbalken in der linken Bahn-Beschriftung unter dem Namen.
- Bearbeiten weiterhin nur für Moderatoren (Profil-Rolle, siehe Grundfeature);
  neue Bearbeiten-Funktionen ebenso.

## Datenmodell (Prisma)

`RoadmapItem` wird additiv erweitert:

```prisma
  storyPoints  Float          @default(0)
  /// Anzeigename des Bearbeiters aus Jira (null bei eigenen Zielen)
  assignee     String?
  labels       RoadmapLabel[]
```

Zwei neue Modelle plus Roadmap-Rückrelationen (`labels`, `milestones`):

```prisma
/// Farbiges Label pro Roadmap; m:n zu Einträgen.
model RoadmapLabel {
  id        String        @id @default(cuid())
  roadmap   Roadmap       @relation(fields: [roadmapId], references: [id], onDelete: Cascade)
  roadmapId String
  name      String
  /// Hex-Farbe aus fester Palette (z. B. "#4c9fc4")
  color     String
  position  Int
  items     RoadmapItem[]
}

/// Roadmap-weiter Zeitpunkt-Marker (vertikale Linie über alle Bahnen).
model RoadmapMilestone {
  id        String   @id @default(cuid())
  roadmap   Roadmap  @relation(fields: [roadmapId], references: [id], onDelete: Cascade)
  roadmapId String
  title     String
  /// UTC-Monatserster
  month     DateTime
  /// Hex-Farbe aus fester Palette
  color     String
}
```

Entscheidungen:
- Meilenstein als eigenes Modell (nicht als `RoadmapItem`), weil roadmap-weit,
  ohne Bahn und ohne Dauer.
- Labels als implizite m:n-Relation (Prisma-Join-Tabelle). Label löschen
  entfernt nur die Verknüpfungen, nicht die Items.
- Migration additiv: `storyPoints` Default 0, `assignee`/Labels/Meilensteine
  optional — bestehende Roadmaps bleiben gültig.
- Feste Farbpalette als Konstante im Code (kein freier Color-Picker), damit die
  Farben zum Theme passen.

## Backend

### Jira-Client

- `getIssuesByKeys` liefert zusätzlich `storyPoints` (aus dem konfigurierten
  Story-Points-Feld) und `assignee` (Anzeigename). Das Interface
  `JiraIssueStatus` wird entsprechend erweitert; die Feldliste der JQL-Abfrage
  ergänzt `assignee` und das Story-Points-Feld.

### Repository (`roadmapRepository.ts`)

- Labels: `createLabel(roadmapId, name, color)`, `updateLabel(id, {name?, color?})`,
  `deleteLabel(id)`, `setItemLabels(itemId, labelIds)`.
- Meilensteine: `createMilestone(roadmapId, title, month, color)`,
  `updateMilestone(id, {title?, month?, color?})`, `deleteMilestone(id)`.
- `NewRoadmapItem`/`RoadmapItemPatch` um `storyPoints` und `assignee` erweitert.
- `updateItemStatuses` aktualisiert je Jira-Key zusätzlich `storyPoints` und
  `assignee` (aus dem Refresh).
- `getRoadmap`/`listRoadmaps` laden `labels` (sortiert nach position),
  `milestones` und je Item die verknüpften Labels mit.

### Server Actions (`roadmap/actions.ts`)

Alle nach dem `ActionResult`-Muster, Validierung (Zugehörigkeit zur Roadmap,
Monat gültig, Name/Titel nicht leer):

- `createLabelAction`, `updateLabelAction`, `deleteLabelAction`,
  `setItemLabelsAction(itemId, labelIds)`.
- `createMilestoneAction`, `updateMilestoneAction`, `deleteMilestoneAction`.
- `addGoalAction`/`updateGoalAction` erweitert um Story Points (nur eigene
  Ziele; Jira-Items beziehen SP aus Jira).
- `addJiraItemAction` übernimmt `storyPoints`/`assignee` aus der Eingabe.

### Fortschritts-Logik (`src/lib/view/roadmapProgress.ts`, getestet)

- `laneProgress(items: { storyPoints: number; statusCategory: string | null }[])`
  → `{ done, inProgress, open, total }` (SP-Summen je Statuskategorie) plus
  abgeleitete Prozentwerte für die Balken-Segmente.
- Randfälle: leere Bahn → alles 0; `total === 0` → keine Division durch Null,
  Balken leer, Anzeige „0 SP".

## UI

### Größere Eintrags-Karten

- Balken werden höhere Karten (`ROW_HEIGHT` wächst). Aufbau:
  - Kopfzeile: Typ-Badge, Jira-Key, Story-Points, Bearbeiter.
  - Titel-Zeile.
  - Label-Chips (farbig).
- Statusfarbe wie bisher (Rahmen/Hintergrund). Sehr schmale Karten kürzen;
  vollständige Infos im Detail-Dialog.

### Offcanvas (statt fester Seitenleiste)

- `RoadmapSidePanel` wird zu einem von rechts einschwebenden Overlay
  (`fixed`, Slide-in). Trigger: der vorhandene „Tickets"-Button (nur
  Moderatoren). Schließen per ✕ oder Klick auf den abgedunkelten Hintergrund.
- Beim Drag-Start eines Eintrags wird das Panel durchlässig
  (`pointer-events-none` + reduzierte Deckkraft), damit die Bahnen darunter
  Drop-Ziele bleiben; nach `dragend` wieder normal.
- Inhalt unverändert: Tabs „Sprint-Tickets" und „Jira-Suche".

### Fortschrittsbalken pro Bahn

- In der linken Bahn-Beschriftung unter dem Namen: schmaler mehrfarbiger Balken
  (Fertig grün, In Arbeit blau, Offen grau) + „X/Y SP" (X = erledigte SP,
  Y = Gesamt). Für alle sichtbar. Die linke Spalte wird etwas breiter.

### Meilensteine

- Roadmap-weite vertikale gestrichelte Linien im jeweiligen Monat, mit
  Rauten-Marker + Titel in einer schmalen Meilenstein-Zeile über den Bahnen,
  in der Meilenstein-Farbe.
- „+ Meilenstein"-Button (Moderatoren); Dialog mit Titel, Monat, Farbwahl.
  Klick auf einen Marker öffnet den Bearbeiten-/Löschen-Dialog (Moderatoren).

### Labels

- „Labels verwalten"-Dialog (Moderatoren): Palette der Roadmap anlegen,
  umbenennen, färben (feste Palette), löschen.
- Im Eintrags-Dialog: Labels per Mehrfachauswahl aus der Palette zuweisen
  (`setItemLabelsAction`).
- Auf den Karten als farbige Chips; im read-only Dialog nur Anzeige.
- Bei eigenen Zielen zusätzlich Story-Points-Feld im Dialog editierbar
  (Jira-Items: SP read-only, aus Jira).

### Moderator-Gating

- Neue Bearbeiten-Funktionen (Labels verwalten, Label-Zuweisung, Meilensteine,
  SP bei Zielen, Offcanvas/Reinziehen) nur für Moderatoren.
- Betrachter sehen Karten inkl. Label-Chips, Meilensteine und
  Fortschrittsbalken read-only; Klick auf eine Karte öffnet den Detail-Dialog
  im Read-only-Modus.

## Fehlerbehandlung

- Jira nicht erreichbar: SP/Assignee/Status bleiben auf dem letzten Stand
  (Hinweis „Status evtl. veraltet" wie bisher).
- Speichern nach Drag/Änderung fehlgeschlagen: Rollback + Hinweis (bestehendes
  Muster).
- Label löschen, das noch zugewiesen ist: Verknüpfungen werden entfernt, Items
  bleiben; Bestätigungsdialog.
- Meilenstein außerhalb des Roadmap-Zeitraums: wird am nächstgelegenen Rand
  angezeigt (analog zu abgeschnittenen Balken).

## Tests

- `roadmapProgress.test.ts`: SP-Summen je Status, Randfälle (leer, total 0).
- `roadmapRepository.test.ts`: Label-CRUD + Zuweisung (m:n), Meilenstein-CRUD,
  `storyPoints`/`assignee` an Items, `updateItemStatuses` aktualisiert SP +
  Assignee.
- `jiraClient.test.ts`: `getIssuesByKeys` liefert SP + Assignee (JQL-Felder,
  Mapping).
- Reine View-Logik weiterhin ohne Browser-E2E; Verifikation über Unit-Tests und
  Build (`NEXT_DIST_DIR=.next-verify`).

## Ausdrücklich nicht enthalten (YAGNI)

- Keine Epic-Kind-Aggregation aus Jira (Fortschritt basiert auf den
  Roadmap-Einträgen selbst).
- Keine teamweiten Labels (nur pro Roadmap).
- Kein freier Color-Picker (feste Palette).
- Keine Gruppierung nach Label (Gruppierung bleibt die Bahn).
- Kein Umschalten der Gruppierung.
