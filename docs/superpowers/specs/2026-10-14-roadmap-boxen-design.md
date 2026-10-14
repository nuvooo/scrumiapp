# Design: Roadmap als verschachtelte Boxen (1:1 nach „Roadmap Kundencockpit.html“)

Datum: 2026-10-14
Status: Umsetzung der Design-Vorlage `Roadmap Kundencockpit.html` (Stand 22.09.2026) 1:1
Ersetzt: `2026-09-16-roadmap-bloecke-design.md` (Zeilen-Layout mit Namensspalte)

## Ziel

Der Roadmap-Editor übernimmt Aufbau, Verhalten und Optik der HTML-Vorlage:

- **Keine Namensspalte.** Jedes Objekt ist ein Block auf der Zeitachse, der Name
  steht im Block (sticky, bleibt beim Scrollen stehen).
- **Verschachtelte Boxen**: Projekt → Teilprojekt → Bereich (schachtelbar) →
  Ticket. Aufgeklappt wächst eine Box nach unten und enthält ihre Kinder;
  eingeklappt ist sie ein Balken mit Fortschritt `2/3`.
- **Kinder stapeln sich automatisch**: Überschneidungen (in Pixeln gemessen)
  rutschen eine Zeile tiefer.
- **Schriftgröße nach Ebene**: 15 / 13,5 / 12 / 11,5 px.
- **Zeitfenster wächst mit**: 100 Tage Luft vor dem frühesten, 150 Tage hinter
  dem spätesten Objekt (Tickets, leere Blöcke, Meilensteine, heute). Die
  Roadmap-Felder `startDate`/`endDate` bleiben für die Übersicht erhalten,
  werden im Editor aber nicht mehr angezeigt oder gepflegt.
- **Überschrittene Endtermine**: roter Balken an der linken Kante.
- **Bewegen**: Kopfzeile ziehen = Termin (ganzer Inhalt wandert mit), auf einen
  anderen Block (oder ein Ticket darin) ziehen = umhängen (Ziel markiert, nicht
  in den eigenen Teilbaum, nicht auf den eigenen Elternblock). Snap auf Tage,
  mit Umschalt auf Wochen. Nur Tickets und leere Blöcke sind in der Breite
  änderbar. Undo per Strg+Z.
- **Karte bewegen**: freie Fläche, Zeitleiste und Innenfläche eines offenen
  Blocks ziehen (horizontal das Board, vertikal die Seite); mit Leertaste oder
  mittlerer Maustaste überall.
- **Werkzeugleiste** in vier Gruppen: „+ Hinzufügen“ (Projekt, Teilprojekt,
  Bereich, Ticket aus Jira …, Meilenstein, jeweils mit Zielort aus dem
  Kontext), Zeitraster Quartal/Monat/Woche + „Heute“, Ein-/Ausklappen und
  Abhängigkeiten als Icon-Buttons, Suche, rechts „Verwalten“-Menü (Tickets aus
  Jira, Spuren, Labels; Roadmap löschen) und „Präsentation“.
- **Suche** dimmt Nicht-Treffer, umrandet Treffer und klappt Blöcke mit
  Treffern auf.
- **Meilensteine** in eigener Leiste unter der Zeitleiste mit gestrichelter
  Linie; Heute-Linie mit Marke „heute“; Abhängigkeitspfeile aus Jira-Links,
  abschaltbar.
- **Präsentation**: nur Roadmap formatfüllend (Vollbild), Blöcke bis Ebene 2
  offen, keine Keys/SP/Pfeile/Anfasser, Höhe wird bis Faktor 1,7 gestreckt,
  Escape beendet.
- **Legende** unter dem Board (Offen, In Bearbeitung, Ausgeführt, Endtermin
  überschritten, „Bedienung“ aufklappbar).
- **Detailkarte** unten rechts: Ticket (Zuordnung, Zeitraum, Dauer, Spur,
  Status, Story Points, Blockiert von; Moderator: bearbeiten, „Aus Roadmap
  entfernen“). Für Blöcke: Typ, Zeitraum, Fortschritt; Moderator: Bearbeiten
  (Name/Farbe), Löschen. Löschen erscheint damit an der Auswahl, nicht in der
  Leiste.

Die Karten „Anforderungen für die Umsetzung“ der Vorlage sind Dokumentation
der Skizze und werden nicht als UI übernommen; ihre Inhalte sind in diese Spec
eingeflossen.

## Datenmodell

`RoadmapBlock` erhält `startDate`/`endDate` (nullable, UTC-Tag): die geplante
Spanne eines **leeren** Blocks (Vorlage: `ps`/`pe`). Sobald der Block Tickets
oder Unterblöcke hat, ergibt sich seine Spanne aus dem Inhalt. Neue Blöcke
starten heute mit vier Wochen Länge.

## Backend

- `createBlock(..., startDate, endDate)`, `updateBlock` mit Spanne,
  `shiftBlockSpans(ids, delta)`.
- `createBlockAction(roadmapId, name, parentId, hue, startDate, endDate)`,
  `updateBlockSpanAction(blockId, startDate, endDate)`,
  `shiftBlockAction` verschiebt Tickets **und** geplante Spannen im Teilbaum.
- `moveBlockAction(blockId, targetId, "into")` hängt ans Ende der Kinder.
- Seite liefert zusätzlich `sprintAnchor` (Start des aktiven Sprints) als
  Anker für das 14-Tage-Sprintraster; ohne Sprint Montag 2026-08-31.

## View-Logik (`src/lib/view/`, getestet)

- `roadmapLayout.ts` (neu): `computeView` (Zeitfenster), `measure` (rekursive
  Boxhöhe, Zeilenpackung in Pixeln, Einrückung `INSET`), `addTarget`
  (Zielort je Objekttyp aus dem Kontextblock), `matchesQuery`.
- `roadmapTree.ts`: Baum, Spannen, `leaves`, `isAncestor`, Fortschritt;
  Zeilenaufbau (`buildRows`, `packTracks`) entfällt.
- `roadmapDrag.ts`: `deltaDays`, `shiftedSpan`, `issueDurationDays`; das
  Klemmen an den Roadmap-Rand entfällt (das Fenster wächst).
- Tag-Indizes sind absolute Tagesnummern (`dayNumber(key)`), damit das
  wachsende Fenster keine Umrechnung braucht.

## UI

- `RoadmapBoard.tsx`: Zeitleiste (Monate mit Quartalen, Wochen/Sprints),
  Meilensteinleiste, Canvas mit rekursiven Boxen, SVG-Overlay (Heute,
  Meilensteinlinien, Pfeile aus dem Layout berechnet), Drag per Pointer-Events
  wie in der Vorlage (Verschieben, Umhängen, Breite ändern, Karte bewegen),
  Drop aus der Jira-Seitenleiste. `@dnd-kit` entfällt.
- `RoadmapEditor.tsx`: Kopf (Eyebrow, Name, Kennzahlen), Werkzeugleiste,
  Legende, Toast, Undo-Stapel, Detailkarten, Dialoge, Präsentationsmodus.
- `roadmap.css`: Styles der Vorlage (dunkle Tokens) unter `.rm`.
