# Feature: Mobile-Optimierung

**Datum:** 2026-07-30 · **Status:** vom Nutzer freigegeben

## Ziel

Scrumi auf dem Handy benutzbar machen. Desktop-Ansicht bleibt unverändert.
Breakpoints: `lg` (~1024 px) für die Navigation, `md` (~768 px) für
Tabellen und Formulare.

## Entscheidungen (mit Nutzer geklärt)

- **Navigation:** kompakter Mobile-Header mit Burger-Button und
  Slide-in-Overlay (keine Bottom-Tab-Bar).
- **Breite Tabellen** (Velocity, Kapazität) werden auf schmalen Screens zu
  **Karten gestapelt** (kein horizontales Scrollen).

## Umsetzung

1. **Nav-Quelle extrahieren:** `NAV_GROUPS` aus der `Sidebar` nach
   `src/lib/view/nav.ts`; Sidebar und neue `MobileNav` importieren beide.
2. **Sidebar:** `hidden lg:flex` — ab `lg` unverändert wie heute.
3. **`MobileNav`** (Client, nur unter `lg` sichtbar): Kopfzeile mit Logo,
   Titel, Burger-Button; Overlay mit Nav-Gruppen (aktiver Eintrag markiert,
   Query-String bleibt erhalten — wie in der Sidebar) und Jira-Status unten.
   Schließt bei Link-Klick, Klick auf den Hintergrund und Escape.
4. **Layout:** Header und `main` reduzieren Padding unter `lg`
   (34 px → 16 px); Selector-Zeile mit `flex-wrap`.
5. **Tabellen zu Karten (unter `md`):** `VelocityTable` und
   `CapacityRoster` rendern doppelt — bestehende Grid-Tabelle mit
   `hidden md:grid`, zusätzlich je Zeile eine Karte (`md:hidden`) mit
   Label-Wert-Paaren. Bestehende Tests bei Doppel-Matches auf
   `getAllByText`/`within` umstellen.
6. **Formulare:** `TeamForm` und `TeamEditor` unter `md` einspaltig
   (`grid-cols-1 md:grid-cols-[…]`).
7. **Standup:** Ticket-Card bricht unter `md` in zwei Zeilen um (Key +
   Summary oben; Verweildauer, Typ, Status, Jira-Link darunter);
   Timer-Kopf `flex-wrap`, Uhr auf Mobile kleiner.
8. **Charts/KPIs:** bereits responsive (viewBox-SVGs, `auto-fit`-Grids) —
   keine strukturellen Änderungen.

## Tests

- Bestehende Suites bleiben grün (Selektoren ggf. auf Doppel-Rendering
  anpassen).
- `MobileNav`: Overlay öffnet/schließt (Burger, Link-Klick, Escape),
  aktiver Eintrag markiert.
- Karten-Rendering: Velocity-/Capacity-Karten enthalten die Kennzahlen mit
  Labels.

## Nicht-Ziele

- Keine Bottom-Tab-Bar, kein PWA/Offline, keine Touch-Gesten.
- Desktop-Layout bleibt pixelgleich.
