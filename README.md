# ⚡ Scrumi

Self-hosted, quelloffenes Werkzeug zur Visualisierung des Scrum-Prozesses:
Burndown, Velocity-Trend und Kapazität/Effizienz — mit Jira-Cloud-Sync.

## Schnellstart (Self-Hosting)

1. `.env` anlegen (siehe `.env.example`) und `JIRA_BASE_URL`, `JIRA_EMAIL`,
   `JIRA_API_TOKEN` setzen.
2. Postgres starten: `docker compose up -d postgres`
3. Migration: `npx prisma migrate deploy`
4. Build & Start: `npm run build && npm start`
5. Im Browser: `http://localhost:3000` → unter **Teams / Jira** ein Team mit
   Jira-Board-ID anlegen.

Der Sync läuft automatisch im Intervall `SYNC_DEFAULT_INTERVAL` (Minuten) und
kann jederzeit über **🔄 Jetzt synchronisieren** ausgelöst werden.

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
