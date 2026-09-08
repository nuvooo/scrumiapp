# Design: Roadmap

Datum: 2026-09-08
Status: Entwurf, vom Nutzer abgenommen (Brainstorming-Dialog)

## Ziel

Ein neues Feature „Roadmap": Pro Team lassen sich mehrere Roadmaps anlegen. Eine
Roadmap ist eine monatsgenaue Zeitleiste (Monate, gruppiert nach Quartalen) mit
frei anlegbaren horizontalen Bahnen (Swimlanes). Auf die Timeline lassen sich
Jira-Tickets und Epics ziehen (aus gesyncten Sprint-Issues oder per
Live-Jira-Suche) sowie eigene Ziele mit Titel und Beschreibung anlegen. Eine
Gesamtübersicht zeigt alle Roadmaps des aktiven Teams read-only auf einer
gemeinsamen Zeitachse.

## Entscheidungen aus dem Brainstorming

- Layout: Zeitleiste mit Monatsspalten, gruppiert nach Quartalen.
- Datenquellen für Jira-Einträge: beides — gesyncte Sprint-Issues (Seitenleiste)
  und Live-Jira-Suche (findet auch Epics und Backlog-Tickets).
- Swimlanes: frei anlegbar pro Roadmap, benennbar, sortierbar.
- Granularität: monatsgenau (Start-/Endmonat je Eintrag).
- Gesamtübersicht: kombinierte read-only Timeline aller Roadmaps des Teams.
- Team-Bezug: Roadmaps gehören zum aktiven Team (wie Sprints, Retros usw.).
- Status: Jira-Einträge zeigen den Jira-Status farblich; er wird beim Öffnen
  der Roadmap per Batch-Abfrage aufgefrischt und am Item gecacht. Eigene Ziele
  haben einen manuell setzbaren Status.
- Technik: Eigenbau mit CSS-Grid und nativen Pointer-Events, keine neue
  Dependency (kein Gantt-/DnD-Package).

## Datenmodell (Prisma)

Drei neue Modelle. Kein Foreign Key auf `Issue` — der Sync ersetzt Issues per
delete+create, daher Referenz nur über `jiraKey` (Muster wie `CarryOverPlan`).

```prisma
model Roadmap {
  id         String   @id @default(cuid())
  team       Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  teamId     String
  name       String
  /// Sichtbarer Zeitraum, monatsgenau (jeweils 1. des Monats, UTC)
  startMonth DateTime
  endMonth   DateTime
  createdAt  DateTime @default(now())
  lanes      RoadmapLane[]
  items      RoadmapItem[]
}

model RoadmapLane {
  id        String        @id @default(cuid())
  roadmap   Roadmap       @relation(fields: [roadmapId], references: [id], onDelete: Cascade)
  roadmapId String
  name      String
  position  Int
  items     RoadmapItem[]
}

model RoadmapItem {
  id             String      @id @default(cuid())
  roadmap        Roadmap     @relation(fields: [roadmapId], references: [id], onDelete: Cascade)
  roadmapId      String
  lane           RoadmapLane @relation(fields: [laneId], references: [id], onDelete: Cascade)
  laneId         String
  /// null = eigenes Ziel; sonst Jira-Referenz (sync-fest, bewusst kein FK auf Issue)
  jiraKey        String?
  /// Momentaufnahme aus Jira ("Epic", "Story", …); null bei eigenen Zielen
  issueType      String?
  /// Bei Jira-Items der Summary-Snapshot, bei Zielen der Titel
  title          String
  /// Nur für eigene Ziele
  description    String?
  startMonth     DateTime
  endMonth       DateTime
  /// "new" | "indeterminate" | "done"; Jira-Items: beim Öffnen aufgefrischt,
  /// Ziele: manuell gesetzt
  statusCategory String?
  /// Anzeigename, z. B. "In Arbeit"
  statusLabel    String?
  /// Reihenfolge innerhalb der Bahn (Stapel-Reihenfolge bei Überlappung)
  position       Int
}
```

Team bekommt die Rückrelation `roadmaps Roadmap[]`.

## Backend

### Jira-Client

- Neue Methode `getIssuesByKeys(keys: string[])`: eine Batch-JQL-Abfrage
  (`key in (…)`) mit den Feldern Key, Summary, Issue-Type, Status,
  Status-Kategorie. Für die Status-Auffrischung.
- Live-Suche nutzt das vorhandene `searchIssues(query)`.

### Repository

`src/lib/repositories/roadmapRepository.ts` (+ Tests):

- Roadmaps: `listRoadmaps(teamId)`, `getRoadmap(id)` (inkl. Bahnen + Items),
  `createRoadmap(teamId, name, startMonth, endMonth)`, `renameRoadmap`,
  `updateRoadmapRange`, `deleteRoadmap`.
- Bahnen: `createLane`, `renameLane`, `moveLane` (Positionstausch),
  `deleteLane` (Cascade löscht Items).
- Items: `createItem` (Jira-Item oder Ziel), `updateItem` (Zeitraum, Bahn,
  Titel/Beschreibung/Status bei Zielen), `deleteItem`,
  `updateItemStatuses(roadmapId, statusByKey)` für die Auffrischung.

### Server Actions

`src/app/(app)/roadmap/actions.ts`, `ActionResult`-Muster wie im Planning:

- Roadmap anlegen / umbenennen / Zeitraum ändern / löschen.
- Bahn anlegen / umbenennen / sortieren / löschen.
- Item hinzufügen (Jira oder Ziel), verschieben (Bahn + Zeitraum), bearbeiten,
  löschen; Status eigener Ziele setzen.
- `searchJira(query)`: Live-Suche; Fehler → `ActionResult.error`.
- `refreshStatuses(roadmapId)`: holt Status aller Jira-Keys der Roadmap per
  Batch, speichert `statusCategory`/`statusLabel` an den Items, gibt die
  aktualisierten Werte zurück.

Validierung überall: `startMonth <= endMonth`, Bahn gehört zur Roadmap,
Roadmap gehört zum Team.

### Seitenleisten-Daten

Gesyncte Issues (aktiver + geplante Sprints des Teams) werden serverseitig auf
der Seite geladen — kein eigener Endpoint.

## UI

### Navigation & Routen

- Sidebar-Gruppe „Analyse": neuer Eintrag „Roadmap" nach „Planning".
- `/roadmap`: Gesamtübersicht. `/roadmap/[id]`: Editor.

### Editor (`/roadmap/[id]`)

- CSS-Grid: eine Spalte pro Monat des Roadmap-Zeitraums; Kopfzeile mit
  Quartals- und Monatsbeschriftung; „Heute"-Markierung im aktuellen Monat.
- Linke Spalte: Bahnennamen (inline umbenennbar), „+ Bahn", Sortier-Pfeile.
- Balken: Typ-Badge (Epic / Ticket / Ziel), Titel, Statusfarbe
  (grau = offen, blau = in Arbeit, grün = fertig, ohne Status = neutral).
  Überlappende Balken einer Bahn stapeln sich in Unterzeilen (`position`).
- Drag&Drop mit Pointer-Events, Snap auf Monatsgrenzen:
  horizontal ziehen = Zeitraum verschieben, vertikal = Bahn wechseln,
  Kanten ziehen = Start/Ende ändern. Optimistisches UI; bei Fehler springt der
  Balken zurück und ein Hinweis erscheint.
- Klick auf Balken → Dialog: Details, bei Zielen Titel/Beschreibung/Status
  bearbeiten, bei Jira-Items Link zu Jira, Zeitraum per Monatsauswahl ändern
  (Touch-/Mobile-Fallback), löschen.
- Rechte Seitenleiste (einklappbar), zwei Tabs:
  - „Sprint-Tickets": gesyncte Issues, filterbar per Textfeld.
  - „Jira-Suche": Live-Suche nach Key oder Titel (auch Epics).
  Einträge per Drag auf die Timeline ziehen; alternativ „+"-Klick legt sie in
  den aktuellen Monat der ersten Bahn. Bereits enthaltene Keys sind markiert
  und nicht erneut hinzufügbar.
- „+ Ziel"-Button: Dialog mit Titel, Beschreibung, Bahn; landet im aktuellen
  Monat (bzw. im ersten Monat der Roadmap, wenn heute außerhalb liegt).
- Beim Öffnen läuft `refreshStatuses` im Hintergrund; Balkenfarben
  aktualisieren sich nach Antwort.

### Gesamtübersicht (`/roadmap`)

- Alle Roadmaps des aktiven Teams untereinander auf einer gemeinsamen
  Zeitachse (frühester Startmonat bis spätester Endmonat aller Roadmaps),
  read-only, kompakt ohne Bahnen-Beschriftung.
- Klick auf Titel oder Balken öffnet den Editor.
- „Neue Roadmap"-Button (Dialog: Name, Start-/Endmonat; eine Standard-Bahn
  „Allgemein" wird mit angelegt). Leerer Zustand mit Hinweistext.
- Schmale Bildschirme: Timeline scrollt horizontal.

## Fehlerbehandlung

- Jira nicht konfiguriert/erreichbar: Suche-Tab zeigt Hinweis;
  `refreshStatuses` scheitert leise, letzter bekannter Status bleibt stehen
  (dezenter Hinweis „Status evtl. veraltet"). Roadmap funktioniert vollständig
  ohne Jira.
- Speichern nach Drag&Drop fehlgeschlagen: Rollback des Balkens + Hinweis.
- Bahn löschen mit Items: Bestätigungsdialog (Items werden mitgelöscht).
- Roadmap-Zeitraum verkleinern löscht keine Items; außerhalb liegende Balken
  werden am Rand abgeschnitten und mit Pfeil-Indikator dargestellt.

## Tests

- `roadmapRepository.test.ts`: CRUD, Bahn-Positionen, Item-Verschiebung,
  Status-Batch-Update.
- Reine View-Logik ausgelagert nach `src/lib/view/roadmap*.ts` (+ Tests):
  - Monatsraster: Zeitraum → Spalten mit Quartalsgruppen.
  - Balken-Stapelung: Überlappungen → Unterzeilen.
  - Drag-Geometrie: Pixel-Offset → Monats-Snap.
- `jiraClient.test.ts`: `getIssuesByKeys` (JQL-Aufbau, Mapping).
- Keine Browser-E2E-Tests (im Projekt nicht etabliert); Verifikation über
  Unit-Tests und Build (`NEXT_DIST_DIR=.next-verify`).

## Ausdrücklich nicht enthalten (YAGNI)

- Kein Zurückschreiben nach Jira (Roadmap ist rein lokal).
- Keine Abhängigkeiten/Pfeile zwischen Einträgen.
- Keine teamübergreifende Gesamtübersicht.
- Keine Tages-/Wochengranularität, kein Zoom.
- Kein Fortschritts-Rollup von Epics (z. B. „4/10 Tickets fertig").
