# Design: Daten-Export/-Import (Backup & Sync) + Passwort-Login

Datum: 2026-08-03
Status: vom Nutzer freigegeben

## Ziel

1. Den kompletten Datenbestand der App als Datei exportieren und in einer anderen
   Instanz (z. B. Coolify-Deployment) wieder importieren können — Sync lokal ↔ Server.
2. Ein simpler, per Env-Variable schaltbarer Passwort-Login, der die gesamte App
   (inkl. API-Routen) schützt und Nutzer über ein Cookie dauerhaft angemeldet hält.

## Teil 1: Backup (Export/Import)

### Ansatz

JSON-Backup über Prisma. Kein `pg_dump` im Container, kein SQL — der Export liest
alle Tabellen per `findMany`, der Import schreibt sie per `createMany` zurück.
Funktioniert komplett über den Browser, ohne direkten DB-Zugriff auf den Server.

### Export — `GET /api/backup`

Liest alle 10 Modelle und liefert eine Download-Datei
`scrumi-backup-YYYY-MM-DD.json` (Header `Content-Disposition: attachment`):

```json
{
  "format": "scrumi-backup",
  "version": 1,
  "exportedAt": "2026-08-03T10:00:00.000Z",
  "data": {
    "teams": [], "teamMembers": [], "sprints": [], "issues": [],
    "burndownPoints": [], "capacityEntries": [], "refinements": [],
    "refinementTickets": [], "refinementParticipants": [], "refinementVotes": []
  }
}
```

Datumsfelder werden als ISO-8601-Strings serialisiert (Standard von `JSON.stringify`).

### Import — `POST /api/backup`

- Body: die Backup-JSON-Datei.
- Validierung vor jeder Schreiboperation: `format === "scrumi-backup"`,
  `version === 1`, `data`-Objekt mit allen zehn Arrays vorhanden.
  Ungültige Dateien → 400, DB bleibt unangetastet.
- **Import-Modus: komplett ersetzen.** Eine `prisma.$transaction`:
  1. `team.deleteMany()` — alle übrigen Tabellen hängen per `onDelete: Cascade`
     (direkt oder transitiv) an `Team` und werden mitgelöscht.
  2. `createMany` in FK-Reihenfolge:
     Team → TeamMember → Sprint → Issue → BurndownPoint → CapacityEntry →
     Refinement → RefinementTicket → RefinementParticipant → RefinementVote.
- **Original-IDs bleiben erhalten** (cuid-Strings werden 1:1 übernommen).
  Dadurch bleiben alle Relationen sowie Refinement-Teilnehmer-Tokens intakt.
- Prisma akzeptiert ISO-Strings für `DateTime`-Felder — keine manuelle Konvertierung
  nötig; `createMany` reicht die Werte durch.
- Antwort: Zusammenfassung der importierten Zeilen pro Tabelle.
- Schlägt ein Schritt fehl, rollt die Transaktion zurück — die Ziel-DB bleibt
  unverändert.

### UI — neue Seite „Einstellungen → Daten“ (`src/app/(app)/settings/data/page.tsx`)

- Sidebar-Link „Daten“ unterhalb von „Teams / Jira“.
- **Export:** Button „Backup herunterladen“ → lädt `GET /api/backup` als Datei.
- **Import:** Dateiauswahl → Client liest die Datei, zeigt eine Zusammenfassung
  („3 Teams, 24 Sprints, 812 Issues …“) → Bestätigungsschritt mit deutlichem
  Hinweis „Ersetzt ALLE vorhandenen Daten dieser Instanz“ → `POST /api/backup`
  → Erfolgs- bzw. Fehlermeldung.

### Code-Aufteilung

- `src/lib/backup.ts`: `exportBackup()`, `importBackup(payload)`,
  `validateBackup(payload)` — die gesamte Logik, testbar ohne HTTP.
- `src/app/api/backup/route.ts`: dünne GET/POST-Handler.
- `src/components/BackupPanel.tsx`: Client-Komponente für Export/Import-UI.

### Sync-Ablauf (Anwendersicht)

Lokal „Backup herunterladen“ → Scrumi auf Coolify öffnen → Datei importieren.
Funktioniert genauso in Gegenrichtung.

## Teil 2: Passwort-Login

### Steuerung per Env-Variable `APP_PASSWORD`

- Nicht gesetzt oder leer → Login deaktiviert, App offen wie bisher (lokal praktisch).
- Gesetzt → alle Seiten und API-Routen erfordern Anmeldung.

### Ablauf

- Neue Seite `/login` (außerhalb des `(app)`-Layouts) mit einem Passwortfeld.
- `POST /api/login`: vergleicht das eingegebene Passwort mit `APP_PASSWORD`.
  Bei Erfolg wird ein **HttpOnly-Cookie** `scrumi_auth` gesetzt:
  - Wert: SHA-256-Hex-Hash von `APP_PASSWORD` (nicht das Passwort selbst).
  - `maxAge` 1 Jahr, `sameSite: lax`, `path: /` → dauerhaft angemeldet.
- Stateless: keine Session-Tabelle. Ändert man `APP_PASSWORD`, passt der Hash
  nicht mehr → alle Geräte sind automatisch abgemeldet.

### Durchsetzung — `src/middleware.ts`

- Läuft auf jeder Anfrage. Wenn `APP_PASSWORD` leer → durchlassen.
- Ausnahmen: `/login`, `/api/login`, Next-interne Pfade (`/_next`, Favicon,
  statische Assets).
- Cookie-Hash stimmt → durchlassen. Sonst: Seiten → Redirect auf `/login`,
  API-Anfragen → 401 JSON.
- Hash-Berechnung mit Web Crypto (`crypto.subtle.digest`) — Edge-Runtime-kompatibel.

### Konsequenzen

- Auch Refinement-Teilnehmer brauchen das (eine, geteilte) Passwort, bevor sie
  einer Session beitreten. Einmal eingegeben, sind sie per Cookie dauerhaft drin.
- Der Backup-Endpunkt ist damit ebenfalls geschützt.
- `docker-compose.yml` und Coolify erhalten `APP_PASSWORD` als Env-Variable.

## Tests

- `src/lib/backup.test.ts`: Validierung (gültig/ungültig/falsche Version),
  Import-Reihenfolge und Round-Trip mit gemocktem Prisma-Client.
- Login: Test der Hash-/Vergleichslogik (`src/lib/auth.ts`), Middleware-Verhalten
  (aktiviert/deaktiviert/falsches Cookie).

## Bewusst weggelassen (YAGNI)

- Kein Merge-/Teilimport — nur „komplett ersetzen“.
- Keine Benutzerverwaltung, keine Rollen — ein geteiltes Passwort.
- Keine automatische Synchronisation — Export/Import ist ein manueller Vorgang.
