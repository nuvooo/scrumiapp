# ⚡ Scrumi

Self-hosted, quelloffenes Werkzeug zur Visualisierung des Scrum-Prozesses:
Burndown, Velocity-Trend und Kapazität/Effizienz — mit Jira-Cloud-Sync.

## Schnellstart (Self-Hosting)

Voraussetzung: Docker + Docker Compose.

1. `.env` anlegen (siehe `.env.example`) und die `JIRA_*`-Variablen setzen
   (für den ersten Start optional — Teams lassen sich auch ohne Sync anlegen).
2. Alles starten: `docker compose up -d`
   — startet Postgres **und** Scrumi; die Datenbank-Migrationen laufen beim
   Start des Scrumi-Containers automatisch (`prisma migrate deploy`).
3. Im Browser: `http://localhost:3000` → unter **Teams / Jira** ein Team mit
   Jira-Board-ID anlegen.

Der Sync läuft automatisch im Intervall `SYNC_DEFAULT_INTERVAL` (Minuten) und
kann jederzeit über **🔄 Jetzt synchronisieren** ausgelöst werden.

### Ohne Docker (lokal)

1. Postgres bereitstellen und `DATABASE_URL` in `.env` setzen.
2. `npm ci`
3. `npx prisma migrate deploy`
4. `npm run build && npm start`

## Hinweise
- Kein eingebautes Login — für den Betrieb im geschützten internen Netz gedacht
  (z. B. hinter einem Reverse-Proxy).
- Story-Points-Feld konfigurierbar über `JIRA_STORY_POINTS_FIELD`
  (Standard `customfield_10016`).

## Entwicklung
- `npm run dev` — Dev-Server
- `npm test` — Tests (Vitest)
- `npx prisma migrate dev` — Migrationen

## Lizenz
MIT
