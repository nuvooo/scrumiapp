# Feature: Refinement-Sessions (Mehrbenutzer-Poker)

**Datum:** 2026-07-30 · **Status:** vom Nutzer freigegeben

## Ziel

Refinements wie bei EasyRetro: Session mit Namen anlegen, Tickets per
Jira-Suche zusammenstellen, Teilnehmer treten per URL + Namenseingabe bei,
verdecktes Planning Poker pro Ticket mit Aufdecken, der Admin übernimmt
die Schätzung (oder passt sie manuell an) und sie wird nach Jira
geschrieben.

## Entscheidungen (mit Nutzer geklärt)

- **Ticket-Quelle:** Live-Suche gegen die Jira-API (JQL) — auch
  Backlog-Tickets ohne Sprint.
- **Voting:** verdeckt, Admin deckt auf; danach Durchschnitt/Median.
- **Ein-Bildschirm-Poker der Planning-Seite wird ersetzt** (Planungs-Check
  und Ticketliste bleiben, Link auf Refinement).
- Kein Login: Beitritt über Session-URL + Namen; Geräte-Token im
  localStorage. Wer die Session anlegt, ist Admin.
- Synchronisation per Polling (~2 s) — kein Websocket.

## Datenmodell (Prisma)

- `Refinement`: teamId, name, state `DRAFT | RUNNING | DONE`,
  activeTicketId?, createdAt.
- `RefinementTicket`: refinementId, jiraKey, summary, issueType,
  previousPoints?, position, state `PENDING | VOTING | REVEALED |
  ESTIMATED`, finalPoints?; unique (refinementId, jiraKey).
- `RefinementParticipant`: refinementId, name, isAdmin, token (unique);
  unique (refinementId, name).
- `RefinementVote`: ticketId, participantId, points? (null = „?");
  unique (ticketId, participantId).

## Umsetzung

1. **Metrik `calcVoteStats`** (`src/lib/metrics/refinementVotes.ts`,
   pure, getestet): Durchschnitt und Median der numerischen Votes
   (auf eine Nachkommastelle gerundet), „?"-Votes (null) zählen nicht;
   leere Menge ⇒ beide null.
2. **`JiraClient.searchIssues(query)`**: `GET /rest/api/3/search/jql`
   mit JQL — sieht die Eingabe wie ein Ticket-Key aus (`ABC-123`), wird
   `key = … OR text ~ …` gesucht, sonst Volltext (`text ~ "…"`,
   `ORDER BY updated DESC`), max. 20 Treffer, Felder wie beim Sync.
   Anführungszeichen in der Eingabe werden escaped. Tests: JQL-Form,
   Key-Erkennung, Fehlerfall.
3. **Actions** (`src/app/(app)/refinement/actions.ts`):
   `createRefinement(teamId, name, adminName)` (legt Admin-Teilnehmer an,
   liefert Token), `joinRefinement(id, name)` (Name pro Session eindeutig),
   `searchJira(query)`, `addTicket`/`removeTicket`/`moveTicket` (Draft),
   `startRefinement`, `selectTicket` (setzt VOTING und löscht alte Votes
   des Tickets), `vote(token, ticketId, points|null)` (nur bei VOTING,
   Upsert), `revealVotes`, `acceptEstimate(ticketId, points)` (erst Jira
   `setStoryPoints`, dann RefinementTicket + lokale Issue-Zeilen
   nachziehen), `finishRefinement`. Admin-Aktionen prüfen das Token.
4. **State-Endpoint** `GET /api/refinement/[id]/state?token=…`: Session,
   Teilnehmer (mit „hat abgestimmt"-Flag), Tickets, aktives Ticket mit
   Votes (Werte nur bei REVEALED), eigene Rolle. Für das Polling der
   Clients.
5. **Seiten:** `/refinement` (Nav „Refinement" nach Planning) mit
   Session-Liste und „Neues Refinement" (Session-Name + eigener Name);
   `/refinement/[id]` rendert den Client-Raum: Beitrittsformular ohne
   Token, Draft-Editor (Jira-Suche, Hinzufügen, ↑/↓, Entfernen, Starten)
   für den Admin, Voting-Ansicht (Karten 1–20 und „?", verdeckt,
   Abstimm-Status aller), Aufdecken-Ansicht (alle Karten + Ø/Median,
   Übernehmen-Feld mit Median vorbelegt), Abschluss-Übersicht
   (Key, Titel, vorher → nachher).
6. **Planning-Seite:** „Schätzen"-Button, Poker-Overlay und
   `estimateIssue`-Action entfernen; Hinweis-Link auf `/refinement`.

## Tests

- `refinementVotes.test.ts`: Ø/Median, „?" ignoriert, leer ⇒ null,
  Rundung.
- `jiraClient.test.ts`: searchIssues (Volltext-JQL, Key-JQL, Escaping).
- Komponenten: Draft-Editor (Suche rendert Treffer, Hinzufügen),
  Voting-Ansicht (verdeckt bis REVEALED, Karte wählen ruft vote,
  Übernehmen mit Median vorbelegt).
- Live-Check per curl (Seiten + State-Endpoint).

## Nachtrag (2026-07-30)

- **Backlog-Vorschläge im Draft:** Der Vorbereitungsmodus zeigt dem Admin
  zusätzlich zur Suche eine Grid-Liste der unbewerteten, offenen Tickets
  aus dem Board-Backlog (`/rest/agile/1.0/board/{id}/backlog`, JQL
  `cf[<id>] is EMPTY AND statusCategory != Done ORDER BY Rank ASC`,
  max. 50, clientseitig nachgefiltert) mit „Hinzufügen"-Button je Karte.

## Nicht-Ziele

- Kein Login/Rechteverwaltung über das Session-Token hinaus, keine
  Websockets, kein Timer im Poker, keine Sprint-Zuordnung von Tickets.
