# Feature: Sprint-Report zum Teilen

**Datum:** 2026-07-30 · **Status:** vom Nutzer freigegeben

## Ziel

Ein teilbarer Sprint-Bericht: Report-Seite mit Druck-/PDF-Ansicht plus
Markdown-Export für Wiki/Confluence/Teams.

## Entscheidungen (mit Nutzer geklärt)

- **Beides:** druckoptimierte Report-Seite (PDF über den Browser-Druckdialog)
  **und** Markdown-Download.
- **Sprints:** abgeschlossene als „Abschlussbericht", der aktive als
  „Zwischenstand". Geplante Sprints zeigen nur einen Hinweis.

## Umsetzung

1. **`ReportData` + `buildReportMarkdown`** (`src/lib/report/markdown.ts`,
   pure, getestet): Team, Sprintname, Zeitraum, Stand-Badge, Kennzahlen
   (Commitment, geliefert, Zielerreichung, Differenz, Carry-Over,
   Tickets/Bugs, Kapazität), Kapazitätstabelle je Mitglied, Ticket-Listen
   „Geliefert" und „Nicht geschafft" (mit Punkten, Status und Jira-Link).
   Leere Listen ⇒ „– keine –".
2. **Loader `loadReport(sprintId)`** in `loaders.ts`: komponiert
   `loadDashboard` (KPIs, Carry-Over) und `loadCapacity` (PT-Zeilen) und
   ergänzt die Ticket-Listen (geliefert = im Sprint-Zeitraum erledigt,
   offen = nicht-DONE auf dem Board). Rückgabe: `null` | `{ state:
   "FUTURE", sprintName }` | `{ state, data: ReportData }`.
3. **Seite `/report`** (Nav-Punkt „Report" unter Analyse, Team-/Sprint-
   Selector wie überall): Kopf mit Sprintname, Zeitraum, Badge
   (Abschlussbericht/Zwischenstand) und Generierungsdatum; KPI-Kacheln
   (`KpiCard`), Story-Points-Burndown (`BurndownChart` aus `loadBurndown`),
   Kapazitätstabelle, Ticket-Listen. Client-Komponente `ReportActions`:
   „Drucken / PDF" (`window.print()`) und „Als Markdown"-Link, beide
   `print:hidden`.
4. **Markdown-Route** `GET /api/report/[sprintId]/markdown`: liefert den
   Markdown-Report als Download (`Content-Disposition: attachment`,
   Dateiname aus dem Sprintnamen ge-slugged); 404 für geplante/unbekannte
   Sprints.
5. **Druck-Stile** (`globals.css`, `@media print`): weißer Hintergrund,
   dunkle Schrift, Sidebar/Header ausgeblendet, Karten ohne Schatten mit
   hellem Rand und `break-inside: avoid`.

## Tests

- `markdown.test.ts`: KPI-Tabelle, Kapazitätstabelle, Ticket-Listen mit
  Links, leere Listen („– keine –"), Zwischenstand- vs.
  Abschlussbericht-Kennzeichnung.
- Seiten-Smoke-Test per curl gegen den Dev-Server (Badge, Nav-Punkt,
  Markdown-Endpoint).

## Nicht-Ziele

- Kein serverseitiges PDF-Rendering, kein Chart im Markdown, kein
  automatischer Versand.
