# Feature: Standup-Modus mit Redezeit-Timer

**Datum:** 2026-07-29 · **Status:** vom Nutzer freigegeben

## Ziel

Eine Standup-Seite, die pro Person zeigt, woran sie gerade arbeitet (wie die
Jira-Board-Sicht), mit einem einstellbaren Redezeit-Countdown pro Person.

## Entscheidungen (mit Nutzer geklärt)

- **Inhalt pro Person:** offene Board-Tickets (inkl. Bugs, mit Typ und Status)
  plus seit dem letzten Arbeitstag erledigte Tickets (dezent markiert).
- **Timer:** Countdown mit einstellbarer Redezeit (Standard 2:00, localStorage);
  läuft bei 0 rot ins Minus weiter; „Weiter"-Button und Leertaste wechseln zur
  nächsten Person. Am Ende Zusammenfassung (Gesamtzeit, Überzieher).
- **Reihenfolge:** pro Standup zufällig gemischt.
- Bezug ist immer der **aktive Sprint** des gewählten Teams; das Sprint-Dropdown
  wird ignoriert. Unzugewiesene Tickets als Gruppe „Ohne Bearbeiter" am Ende;
  Personen ohne Tickets erscheinen nicht.

## Umsetzung

1. **Bearbeiter synchronisieren:** `Issue.assignee String?` (Migration),
   Jira-Feld `assignee` (displayName) im Sprint-Issue-Fetch, Mapper und
   Repository durchreichen. Der aktive Sprint wird bei jedem Sync neu geladen —
   normaler Sync genügt, um die Bearbeiter zu befüllen.
2. **Metrik `buildStandupGroups`** (`src/lib/metrics/standup.ts`, pure, getestet):
   Eingaben: Issues des aktiven Sprints, Referenzdatum „seit wann gilt erledigt".
   Gruppiert nach Bearbeiter (alphabetisch, „Ohne Bearbeiter" zuletzt): offene
   Board-Tickets + im Fenster erledigte Tickets. Hilfsfunktion
   `previousWorkingDay(today)` (Wochenende überspringen).
3. **Loader `loadStandup(teamId)`**: aktiver Sprint des Teams, Issues laden,
   Gruppen bauen. Ohne aktiven Sprint: `null` (Seite zeigt Hinweis).
4. **Seite `/standup`** (Navigation „Analyse"): Server-Page mit Team-Param wie
   die anderen Seiten; rendert `StandupBoard`.
5. **Komponente `StandupBoard`** (Client): mischt die Gruppen beim Mount,
   zeigt aktive Person groß mit Ticketliste, Warteschlange ausgegraut,
   Countdown (mm:ss, einstellbar, localStorage-Key `scrumi.standup.seconds`),
   Überziehung rot/negativ, Weiter per Button/Leertaste, Abschluss-Screen.

## Tests

- `standup.test.ts`: Gruppierung nach Bearbeiter, Erledigt-Fenster (inkl.
  Wochenende), „Ohne Bearbeiter" zuletzt, Personen ohne Tickets fehlen,
  `previousWorkingDay` (Mo → Fr).
- `StandupBoard.test.tsx`: Countdown läuft (Fake-Timer), Überziehung negativ,
  Weiter-Button wechselt Person, Abschluss nach letzter Person.
