# Scrumi — Design-Spezifikation

**Datum:** 2026-05-21
**Status:** Entwurf, abgestimmt im Brainstorming

## 1. Überblick

Scrumi ist ein self-hosted, quelloffenes Werkzeug zur Visualisierung und Auswertung des
Scrum-Prozesses. Es synchronisiert Sprint- und Issue-Daten aus **Jira Cloud**, ergänzt sie um
manuell gepflegte Kapazitätsdaten (Personen und Personentage) und stellt daraus die zentralen
Scrum-Kennzahlen als gut sichtbare Diagramme dar: **Burndown**, **Velocity-Trend**,
**Kapazität/Effizienz** und ein aggregiertes **Dashboard**.

### Ziele
- Klare, visuelle Sicht auf den Scrum-Fortschritt (Trendlinien, Auf-/Abwärtstrend).
- Einfaches Self-Hosting („für jeden nutzbar"): ein `docker-compose up`.
- Quelloffen mit niedriger Contributor-Hürde.

### Nicht-Ziele (v1, YAGNI)
- Authentifizierung / Rollen / Benutzerkonten (läuft im geschützten internen Netz hinter Reverse-Proxy).
- Jira Server / Data Center (nur Cloud REST v3 in v1; Adapter ist erweiterbar).
- Mehrere Jira-Instanzen, Echtzeit-Websockets, Export/PDF, E-Mail-Benachrichtigungen.

## 2. Grundsatzentscheidungen

| Thema | Entscheidung |
|------|--------------|
| Framework | Next.js 15 (App Router), React, TypeScript |
| Jira-Rolle | Hybrid: Import/Sync aus Jira **+** eigene DB-Kopie + manuelle Anreicherung |
| Jira-Variante | Jira Cloud, REST API v3 (Adapter hinter Interface, später erweiterbar) |
| Nutzermodell | Multi-Team, **keine Auth** in v1 (internes Netz) |
| Datenbank | PostgreSQL via Prisma ORM |
| Sync | Automatisch per Intervall (node-cron via `instrumentation.ts`) + manueller Fallback-Button |
| Layout | Seitenleiste + fokussierte Detailseiten (Layout B) |
| Architektur | Monolithische Next.js-App (ein Deployable) |

## 3. Architektur

Monolithische Next.js-App mit klar gekapselten Schichten. Kernprinzip: die
**Berechnungslogik ist vollständig von Jira und der DB entkoppelt** und arbeitet auf eigenen
Domänentypen – dadurch ohne Mocks testbar und der Jira-Adapter austauschbar.

1. **UI-Schicht** — Next.js-Seiten/Komponenten. Server Components für Datenanzeige,
   Client Components nur für Charts und Eingabeformulare.
2. **Service/Domain-Schicht** (`lib/metrics/`) — reine Geschäftslogik: Velocity-, Burndown-,
   Kapazitätsberechnung. Framework-unabhängig, isoliert testbar.
3. **Jira-Adapter** (`lib/jira/`) — hinter Interface `JiraClient`; v1-Implementierung für Cloud REST v3.
4. **Persistenz-Schicht** (`lib/repositories/`) — Prisma-Repositories als einzige DB-Zugriffsstelle.
5. **Sync-Schicht** (`lib/sync/`) — Hintergrund-Job, ruft Jira-Adapter auf, speichert über Repositories.

### Tech-Stack
- UI: Tailwind CSS + shadcn/ui
- Charts: Recharts
- ORM/DB: Prisma → PostgreSQL
- Scheduler: node-cron (Start via `instrumentation.ts`)
- Tests: Vitest + React Testing Library (Playwright optional, später)
- Betrieb: Docker + docker-compose (App + Postgres)

## 4. Datenmodell (Prisma / Postgres)

```
Team
  id, name, jiraBoardId, syncIntervalMinutes, lastSyncedAt, lastSyncError, createdAt

Sprint
  id, teamId → Team
  jiraSprintId, name, state (ACTIVE | CLOSED | FUTURE)
  startDate, endDate, completeDate
  committedPoints   // Story Points zu Sprint-Beginn (Commitment)
  completedPoints   // erledigte Story Points am Sprint-Ende (= Velocity)
  // carriedOver = committedPoints - completedPoints (berechnet, nicht gespeichert)

Issue
  id, sprintId → Sprint
  jiraKey, summary, storyPoints, status, statusCategory (TODO | IN_PROGRESS | DONE)
  resolvedAt, addedAfterSprintStart (Bool — Scope-Change)

BurndownPoint            // ein Punkt pro Tag, vom Sync erzeugt/aktualisiert
  id, sprintId → Sprint
  date, remainingPoints, completedPoints

TeamMember               // wiederverwendbar über Sprints
  id, teamId → Team, name

CapacityEntry            // Personentage pro Person pro Sprint (rein manuell)
  id, sprintId → Sprint, teamMemberId → TeamMember (nullable), name, personDays
  // Sprint-Kapazität = Summe(personDays)
```

**Eindeutigkeit / Idempotenz:** Upsert über `jiraSprintId` (Sprint) bzw. `jiraKey` innerhalb eines Sprints (Issue).

**Jira-Zugangsdaten:** global per Env (`JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`).
Eine Jira-Instanz; mehrere Teams mappen auf je eine `jiraBoardId`. Keine Secrets in der DB.

## 5. Abgeleitete Kennzahlen (Domain-Schicht)

Reine Funktionen in `lib/metrics/`, nehmen Domänentypen, geben Chart-fertige Daten zurück:

- `calcVelocityTrend(sprints)` — Velocity (`completedPoints`) je Sprint über N Sprints; Trendrichtung.
- `calcBurndown(sprint, burndownPoints)` — Ist-Linie aus `BurndownPoint` + Ideallinie
  (linear von `committedPoints` → 0 über die Arbeitstage).
- `calcCapacityEfficiency(sprint, capacityEntries)` — `completedPoints / Σ personDays` (SP pro Personentag).
- `calcCarryOver(sprint)` — `committedPoints − completedPoints` („mitgenommen").

Randfälle, die getestet werden: leerer Sprint, fehlende Story Points (als 0), Scope-Change,
Sprint ohne Kapazitätsdaten, laufender vs. abgeschlossener Sprint.

## 6. Seiten & Routen (Layout B)

Linke Seitenleiste als Navigation. Team & Sprint werden oben gewählt; Kontext via URL-Query
(`?team=…&sprint=…`), damit Ansichten teil- und verlinkbar sind.

```
/                  → Redirect auf /dashboard
/dashboard         → KPI-Karten (Velocity, Commitment, Kapazität, offen/erledigt) + Mini-Charts
/burndown          → Burndown: Ist- vs. Ideallinie
/velocity          → Velocity über N Sprints, Commitment vs. geliefert + Carry-over
/capacity          → Personen & Personentage eingeben/bearbeiten; Effizienz
/settings/teams    → Teams anlegen, jiraBoardId mappen, Sync-Intervall, Sync-Status

/api/teams         → Route Handler (CRUD Teams)
/api/sprints       → Route Handler (Lesen)
/api/capacity      → Route Handler (CRUD Kapazität)
/api/sync          → Route Handler (manueller Sync-Trigger)
```

**Komponenten-Aufteilung:** Server Components laden über Repositories und reichen fertige
Domänen-Objekte an; Client Components nur für Recharts-Charts und Kapazitäts-Eingabeformulare.

## 7. Jira-Sync & Fehlerbehandlung

**Ablauf (Hintergrund-Job, Intervall pro Team):**
1. `instrumentation.ts` startet beim App-Start einen node-cron-Scheduler.
2. Pro Tick: für jedes Team mit fälligem Intervall → `JiraClient.fetchBoardSprints(jiraBoardId)`.
3. Für aktive + kürzlich geschlossene Sprints: Issues inkl. Story Points laden (REST v3, paginiert).
4. Domain-Schicht berechnet `committedPoints`, `completedPoints`, Status-Kategorien.
5. Repositories schreiben Sprint/Issue idempotent (Upsert).
6. `BurndownPoint` für „heute" wird angelegt/aktualisiert → ergibt über die Tage die Ist-Linie.
7. `Team.lastSyncedAt` setzen.

**Grenze des Hybrid-Modells:** Der Sync überschreibt **nie** manuell gepflegte Kapazitätsdaten.
Jira liefert nur Sprint/Issue-Daten; Personentage bleiben rein manuell.

**Fehlerbehandlung:**
- Jira nicht erreichbar / 401 / Rate-Limit → Sync für dieses Team überspringen; letzte gute Daten
  bleiben sichtbar (eigene DB-Kopie); Fehler wird geloggt und als `lastSyncError` im UI angezeigt.
- Teil-Fehler eines Teams bricht andere Teams nicht ab.
- Rate-Limits: einfacher Backoff/Retry im Adapter.
- Fehlende Story Points → als 0 behandelt + Datenqualitäts-Hinweis im UI.
- Manueller „Jetzt synchronisieren"-Button löst denselben Sync sofort aus (Komfort/Fallback).

## 8. Teststrategie

- **Domain-Schicht (Schwerpunkt):** Unit-Tests für alle `calc*`-Funktionen, viele Randfälle,
  keine Mocks. TDD (Test zuerst).
- **Jira-Adapter:** Tests gegen Fixtures aufgezeichneter REST-Antworten inkl. Pagination und
  Fehlerfälle (401, Rate-Limit). TDD.
- **Repositories:** Integrationstests gegen Test-Postgres.
- **UI:** leichte Komponententests (Vitest + RTL) für Eingabeformulare; Charts nicht streng getestet.

## 9. Deployment / Self-Hosting

- `docker-compose.yml`: Services `scrumi` (Next.js) + `postgres` + Volume.
- Konfiguration über Env (`DATABASE_URL`, `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`,
  `SYNC_DEFAULT_INTERVAL`), dokumentiert in `.env.example`.
- Prisma-Migrationen laufen beim Container-Start automatisch.
- Open-Source-Beiwerk: `README.md` (Quickstart), `LICENSE` (MIT), `CONTRIBUTING.md`,
  GitHub-Actions-CI (Lint + Test + Build).

## 10. Erweiterbarkeit (Ausblick, nicht v1)

Architektur lässt folgende Erweiterungen ohne Umbau zu: Auth-Schicht, Jira Server/DC-Adapter
(zweite `JiraClient`-Implementierung), Auslagerung des Sync in einen separaten Worker,
weitere Charts/Exports.
