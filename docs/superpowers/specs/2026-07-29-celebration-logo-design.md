# Feature: Feier-Effekte (Feenstaub & Feuerwerk) + Logo

**Datum:** 2026-07-29 · **Status:** vom Nutzer freigegeben

## Ziel

Positive Verstärkung im Sprint-Alltag: Konfetti („Feenstaub"), wenn das Tagesziel
des Vortags erreicht wurde, und ein Feuerwerk, wenn die Tickets des aktiven
Sprints auf 0 stehen. Zusätzlich ersetzt das Scrumi-Roboter-Logo den bisherigen
Farbverlaufs-Platzhalter in der Sidebar.

## Entscheidungen (mit Nutzer geklärt)

- **Tagesziel** = Ideallinie des Ticket-Burndowns: Der Ist-Wert des letzten
  Arbeitstags vor heute liegt auf oder unter der Ideallinie dieses Tages.
- **Orte:** Dashboard und Burndown-Seite.
- **Häufigkeit:** bei jedem Seitenaufruf, solange die Bedingung gilt (bewusst
  gegen die Empfehlung „1×/Tag" entschieden).
- **Feuerwerk** gewinnt, wenn beide Bedingungen zutreffen.
- Gefeiert wird nur der **aktive** Sprint (Dropdown-Auswahl anderer Sprints: kein Effekt).
- „Tickets auf 0" bezieht sich auf die offenen Board-Tickets ohne Bugs — dieselbe
  Kennzahl wie die „Restaufwand"-Karte; der Sprint muss überhaupt Tickets gehabt haben.

## Umsetzung

1. **Metrik `calcCelebration`** (`src/lib/metrics/celebration.ts`, pure, getestet):
   Eingaben: Sprint-State, Ticket-Burndown (ideal/actual aus `calcTicketBurndown`),
   offene/gesamte Board-Tickets, heutiges Datum. Ausgabe: `"fireworks" | "confetti" | null`.
   Vortag = letzter Ist-Punkt vor heute (Kalendertag-Vergleich), Ideal-Wert des gleichen Tages.
2. **Komponente `Celebration`** (`src/components/Celebration.tsx`, Client):
   Prop `effect`; spielt im `useEffect` die Animation über `canvas-confetti`
   (neue Dependency, ~10 kB) ab. Konfetti: kurzer Glitzer-Regen; Feuerwerk:
   mehrere Salven über ~3 s. Rendert kein DOM, blockiert keine Interaktion.
3. **Loader `loadCelebration(sprintId)`** (`src/lib/view/loaders.ts`): lädt Sprint,
   Issues und Burndown-Punkte, ruft `calcCelebration` auf. Dashboard- und
   Burndown-Page rendern `<Celebration effect={…} />`.
4. **Logo:** `scrumi_logo.png` zentriert quadratisch zugeschnitten nach
   `public/scrumi-logo.png` (256×256); Sidebar zeigt es statt des Verlaufs-Chips
   (22×22, abgerundet).

## Tests

- `celebration.test.ts`: Ziel erreicht/verfehlt, kein Vortagespunkt, Tickets auf 0,
  leerer Sprint (nie Tickets), nicht-aktiver Sprint, Feuerwerk vor Konfetti.
- `Celebration.test.tsx`: `canvas-confetti` gemockt — Aufruf bei confetti/fireworks,
  kein Aufruf bei `null`.
