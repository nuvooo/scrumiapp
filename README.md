![Scrumi-Logo](docs/assets/scrumi-logo-readme.png)

# Scrumi

Self-hosted, quelloffenes Werkzeug zur Visualisierung des Scrum-Prozesses —
mit automatischem Jira-Cloud-Sync.

---

Scrumi holt sich Sprints und Tickets direkt vom Jira-Board und macht daraus
die Ansichten, die im Sprint-Alltag wirklich gebraucht werden — ohne
Jira-Plugins, ohne Cloud-Abo, auf eigener Infrastruktur.

## Features

- **Dashboard** — der aktuelle Sprint auf einen Blick: Commitment, erledigte
  Punkte, offene Tickets und Bugs.
- **Burndown** — Punkte-Burndown des Sprints plus separates Ticket- und
  Bug-Burndown; wird bei jedem Sync fortgeschrieben. Läuft der Sprint gut,
  gibt es Feenstaub und Feuerwerk. 🎆
- **Velocity** — Velocity-Trend über die abgeschlossenen Sprints inklusive
  Carry-Over-Quote (was wurde committet, aber nicht fertig?).
- **Kapazität & Forecast** — geplante vs. tatsächliche Personentage je
  Mitglied, Team-Effizienz und daraus abgeleitete Prognose fürs nächste
  Sprint-Commitment.
- **Standup** — Standup-Modus für den laufenden Sprint: pro Person die
  offenen Board-Tickets und das seit dem letzten Arbeitstag Erledigte,
  zufällige Reihenfolge, Redezeit-Countdown mit Überzieh-Statistik. Jede
  Card zeigt, wie lange das Ticket schon im aktuellen Status hängt — ab
  mehr als 5 Arbeitstagen mit roter Warnung.
- **Jira-Sync** — automatisch im Intervall oder per Klick; Board-Spalten,
  Bearbeiter und Status-Historie kommen direkt aus der Jira-Cloud-API.

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
- Damit im Standup jede Person ihren Redeslot bekommt, müssen die
  Teammitglieder unter **Teams / Jira** gepflegt sein und den
  Jira-Anzeigenamen entsprechen.

## Tech-Stack

Next.js 15 (App Router) · React 19 · Prisma + PostgreSQL · Vitest

## Entwicklung
- `npm run dev` — Dev-Server
- `npm test` — Tests (Vitest)
- `npx prisma migrate dev` — Migrationen

## Lizenz
MIT
