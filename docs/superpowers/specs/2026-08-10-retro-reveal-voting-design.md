# Retro: Aufdecken pro Teilnehmer + Voting-Status (Design)

Datum: 2026-08-10 · Status: vom Nutzer freigegeben

## Kontext

In der Retro gibt es heute nur den globalen Verdeckt-Schalter des Moderators
(`retro.hidden`) — alle fremden Karten sind gleichzeitig verdeckt oder sichtbar.
Beim Vortragen soll jeder Teilnehmer seine eigenen Karten selbst aufdecken
können. Außerdem soll sichtbar sein, wer beim Dot-Voting noch offene Stimmen
hat.

## Umsetzung

### 1. Aufdecken pro Teilnehmer

- Neues Feld `RetroParticipant.revealed Boolean @default(false)`.
- Sichtbarkeits-Berechnung (serverseitig, `src/app/api/retro/[id]/state/route.ts`):
  `covered = retro.hidden && !mine && !autor.revealed`. Verdeckte Inhalte
  verlassen den Server weiterhin nur geblurt/anonymisiert.
- **Teilnehmer**: Button „Meine Karten aufdecken / wieder verdecken" — jederzeit
  selbst umschaltbar.
- **Moderator**: kann in der Teilnehmerliste einzelne Teilnehmer auf-/zudecken;
  „Alle aufdecken" = `hidden` aus (wie bisher); „Alle verdecken" = `hidden` an
  **und** alle `revealed`-Flags zurücksetzen.
- Neue Server Action `setRetroParticipantRevealed(retroId, participantId, revealed)`
  — erlaubt für sich selbst, Moderator für alle (Prüfung via `requireParticipant`).

### 2. Offene Voting-Stimmen

- State-Endpoint liefert pro Teilnehmer `votesUsed` (Count `RetroVote` je
  `participantId`).
- Teilnehmerleiste zeigt bei offenem Voting „x/y" bzw. Haken bei „fertig
  gevotet". Wofür gestimmt wurde, bleibt anonym.

### Infrastruktur

Kein neuer Mechanismus nötig: Live-Updates über vorhandenen WebSocket-Ping +
State-Refresh (`bumpRetro`).

### Tests

- Sichtbarkeits-Logik (covered mit revealed-Flag) im State-Route-Test bzw.
  als extrahierte Pure Function
- Action-Berechtigungen (selbst vs. Moderator)
