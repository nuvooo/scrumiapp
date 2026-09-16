# Design: Roadmap-Blöcke (Umbau nach Design-Skizze „Roadmap Kundencockpit")

Datum: 2026-09-16
Status: Umsetzung nach Design-Artefakt des Nutzers (claude.ai/artifact/LJKXo3SkaHYhnAH66H2Vp8)
Ersetzt in Teilen: `2026-09-08-roadmap-design.md`, `2026-09-08-roadmap-erweiterungen-design.md`

## Ziel

Der Roadmap-Editor wird auf das Design der Skizze umgebaut: beliebig tief
geschachtelte, farbcodierte **Blöcke** auf einer **tagesgenauen** Zeitachse
(Zoom Quartal / Monat / Woche), Tickets je Block in **Spuren** (Streams wie
Frontend, Backend, UX), ein-/ausklappbar, per Drag & Drop verschiebbar und
umhängbar, Meilensteine als eigene Zeile, Abhängigkeitspfeile aus Jira-Links,
Präsentationsmodus.

## Entscheidungen

- **Blöcke** sind eigene Objekte (Name, Farbe optional, Parent, Reihenfolge),
  kein Jira-Epic-Spiegel. Start/Ende werden aus den Tickets berechnet (min/max).
  Farbe: eigener Farbton (Hue) oder vom nächsten Vorfahren geerbt.
- **Spuren** = die bestehenden `RoadmapLane`s (umbenannt in der UI zu
  „Streams"). Je Block eine Zeile pro Stream, in dem Tickets liegen.
  Parallele Tickets einer Spur stapeln sich („2 parallel").
- **Tagesgenau**: `startDate`/`endDate` (UTC-Tag) statt Monatsraster. Balken
  werden über Tag-Index × Tagbreite positioniert; Zoom ändert nur die
  Tagbreite (Quartal 2.9 px, Monat 7.4 px, Woche 17 px).
- **Eingangskorb**: Tickets ohne Block (`blockId` null) erscheinen in einer
  Pseudo-Block-Zeile „Eingangskorb" über den Blöcken und werden von dort in
  einen Block gezogen. Neue Tickets aus dem Offcanvas landen im Eingangskorb
  (bzw. direkt im Block, wenn auf eine Block-/Spurzeile gedroppt).
- **Abhängigkeiten** kommen lesend aus Jira (Issue-Links „is blocked by") und
  werden beim Status-Refresh an den Items gespeichert (`blockedBy String[]`).
  Pfeile nur zwischen Tickets, die beide auf der Roadmap sichtbar sind;
  abschaltbar.
- **Meilensteine** tagesgenau (`date`), eigene Zeile mit Raute + durchgehende
  gestrichelte Linie.
- **Labels** bleiben erhalten (Zuweisung und Anzeige im Detail-Drawer); auf den
  Balken werden sie nicht mehr gezeigt (Design: Statuspunkt, Key, Titel, SP).
- **Detailkarte** ist ein Drawer unten rechts (statt Modal). Für Moderatoren
  enthält er die Bearbeitung (Block, Stream, Datum, Ziel-Felder, Labels).
- **Präsentationsmodus**: klappt auf die obersten zwei Ebenen ein, blendet
  Werkzeugleiste, Jira-Keys und SP aus, vergrößert Typografie/Balken.
- **Klappzustand** pro Nutzer im localStorage (`roadmap-open:<id>`).
- Rollen wie bisher: Bearbeiten nur für Moderatoren (Profil-Rolle).

## Datenmodell (Prisma, Migration mit Datenübernahme)

```prisma
model RoadmapBlock {
  id        String         @id @default(cuid())
  roadmap   Roadmap        @relation(fields: [roadmapId], references: [id], onDelete: Cascade)
  roadmapId String
  parent    RoadmapBlock?  @relation("BlockTree", fields: [parentId], references: [id], onDelete: Cascade)
  parentId  String?
  children  RoadmapBlock[] @relation("BlockTree")
  name      String
  /// HSL-Farbton 0–359; null = erbt vom nächsten Vorfahren
  hue       Int?
  position  Int
  items     RoadmapItem[]
}
```

- `Roadmap.startMonth/endMonth` → `startDate/endDate` (Monatserster / letzter
  Monatstag des bisherigen Endmonats).
- `RoadmapItem.startMonth/endMonth` → `startDate/endDate` (analog),
  `+ blockId String?` (FK, `onDelete: SetNull` → Eingangskorb),
  `+ blockedBy String[] @default([])`.
- `RoadmapMilestone.month` → `date`.

## Backend

- Jira-Client: `getIssuesByKeys` fragt zusätzlich `issuelinks` ab und liefert
  `blockedBy` (Keys der inward-Links vom Typ „Blocks"/„is blocked by").
- Repository: Block-CRUD (`createBlock`, `updateBlock`, `moveBlock` mit
  Positionsvergabe unter Geschwistern und Zyklus-Schutz, `deleteBlock`),
  `shiftItems(ids, deltaDays)`, Items mit `blockId`/Daten.
- Actions (`ActionResult`-Muster): `createBlockAction`, `updateBlockAction`,
  `moveBlockAction(blockId, targetId|null, "before"|"after"|"into")`,
  `deleteBlockAction`, `shiftBlockAction(blockId, deltaDays)`,
  `moveItemAction(itemId, {blockId, laneId, startDate, endDate})`,
  Meilenstein/Ziel/Jira-Item mit Tagesdaten. Datumsformat über die Leitung:
  `"YYYY-MM-DD"` (UTC).

## View-Logik (`src/lib/view/`, getestet)

- `roadmapDays.ts`: Tag-Keys, `dayDiff`, `addDays`, ISO-Woche, Kopfzellen
  (Monate mit Quartalsmarkierung, Wochen/Sprints), Zoom-Breiten.
- `roadmapTree.ts`: Baum aus flacher Blockliste (Tiefe, Hue-Vererbung,
  Farbgruppe), `leaves`, `span`, `isAncestor`, Zeilenaufbau (Meilensteine,
  Eingangskorb, Blöcke, Spuren) abhängig vom Klappzustand und
  Präsentationsmodus, Spur-Stapelung.

## UI

- `roadmap.css`: die Design-Styles (Farbtreppe per `--rh`, Balken per `--h`,
  Sticky-Linksspalte, Overlay) auf das dunkle App-Theme abgestimmt.
- `RoadmapEditor.tsx`: Kopf mit Kennzahlen (Tickets, Erledigt, SP, Blöcke),
  Werkzeugleiste (Zoom, Ein-/Ausklappen, Abhängigkeiten, Legende,
  Präsentationsmodus, Moderator-Aktionen), Board mit Zeilen und SVG-Overlay
  (Heute-Linie, Meilensteinlinien, Pfeile), Drag-Logik (Ticket/Block
  horizontal, Ticket vertikal in Spur/Block, Griff zum Umhängen), Tastatur
  (←/→ tageweise, Shift = Woche, Enter = Details).
- `RoadmapItemDrawer.tsx` ersetzt `RoadmapItemDialog.tsx`.
- `RoadmapBlockDialog.tsx`: Block anlegen/umbenennen/färben/löschen.
- Ziel-/Meilenstein-Dialoge mit Datumsfeldern; Ziel-Dialog mit Block-Auswahl.
- Übersicht `/roadmap` bleibt monatsbasiert (aus den Tagesdaten abgeleitet).

## Nicht enthalten (spätere Ausbaustufen laut Skizze)

Baselines, Kapazität je Stream, Was-wäre-wenn, Filter/geteilte Links,
Änderungsverlauf, Rückschreiben nach Jira, PNG/PDF-Export.
