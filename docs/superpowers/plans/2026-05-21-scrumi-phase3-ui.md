# Scrumi Phase 3: UI + Charts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Voraussetzung:** Phase 1 und Phase 2 sind vollständig umgesetzt.

**Goal:** Die sichtbare Scrumi-Oberfläche nach Layout B (linke Seitenleiste + fokussierte Detailseiten): Dashboard, Burndown, Velocity, Kapazität (mit Eingabe) und Teams/Jira-Einstellungen — mit Recharts-Diagrammen inkl. Trendanzeige, Team/Sprint-Auswahl über URL-Query, und manuellem Sync-Button.

**Architecture:** Server Components laden über Repositories + Metrik-Funktionen fertige, serialisierbare View-Modelle und reichen sie an kleine Client-Komponenten (nur Charts und Formulare sind `"use client"`). Auswahl von Team/Sprint läuft über `?team=…&sprint=…`; reine Auswahl-Resolver entscheiden Defaults (getestet). Schreibzugriffe (Team anlegen, Kapazität pflegen) laufen über Server Actions.

**Tech Stack:** Next.js 15 App Router, React Server/Client Components, Tailwind CSS, Recharts, Vitest. (shadcn/ui bewusst nicht eingerichtet — Komponenten direkt mit Tailwind, deterministisch und ohne CLI-Init; lässt sich später ergänzen.)

---

## Datei-Struktur (in diesem Plan erstellt)

```
src/lib/view/mappers.ts          + Test    Prisma -> Domain (reine Konverter)
src/lib/view/selection.ts        + Test    Default-Auswahl Team/Sprint (rein)
src/lib/view/loaders.ts                     Server-Datenlader (Repos + Metriken -> View-Modelle)
src/lib/format.ts                           Zahlen-/Datumsformatierung
src/components/Sidebar.tsx                  Navigation (client, aktiver Link)
src/components/TeamSprintSelector.tsx       Auswahl-Dropdowns (client, URL-Query)
src/components/KpiCard.tsx                   KPI-Kachel
src/components/SyncButton.tsx               Manueller Sync (client)
src/components/charts/BurndownChart.tsx     Recharts (client)
src/components/charts/VelocityChart.tsx     Recharts (client)
src/components/CapacityForm.tsx             Kapazitätseingabe (client)
src/components/TeamForm.tsx                  Team anlegen (client)
src/app/page.tsx                 (Modify)   Redirect -> /dashboard
src/app/(app)/layout.tsx                     Sidebar-Layout + Selektor
src/app/(app)/dashboard/page.tsx
src/app/(app)/burndown/page.tsx
src/app/(app)/velocity/page.tsx
src/app/(app)/capacity/page.tsx
src/app/(app)/capacity/actions.ts            Server Action: Kapazität
src/app/(app)/settings/teams/page.tsx
src/app/(app)/settings/teams/actions.ts      Server Action: Team anlegen
```

---

## Task 1: Recharts installieren + jsdom für Komponententests

**Files:**
- Modify: `package.json`, `vitest.config.ts`

- [ ] **Step 1: Abhängigkeiten installieren**

```bash
npm install recharts
npm install -D @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: vitest.config.ts auf Projekte umstellen (node + jsdom)**

Replace `vitest.config.ts` mit getrennten Umgebungen (Repositories/Domain laufen in `node`, Komponenten in `jsdom`):

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
});
```

Create `vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Bestehende Tests laufen weiterhin**

Run: `npm test`
Expected: alle bisherigen Tests grün (jetzt im „node"-Projekt gelistet).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts
git commit -m "chore: add recharts and jsdom test project"
```

---

## Task 2: Prisma→Domain-Konverter

**Files:**
- Create: `src/lib/view/mappers.ts`, `src/lib/view/mappers.test.ts`

- [ ] **Step 1: Failing test schreiben**

Create `src/lib/view/mappers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toDomainSprint, toDomainBurndownPoint, toDomainCapacityEntry } from "./mappers";

describe("toDomainSprint", () => {
  it("copies the fields the metrics layer needs", () => {
    const start = new Date("2026-05-18");
    const sprint = toDomainSprint({
      id: "s1", teamId: "t1", jiraSprintId: "100", name: "Sprint 1",
      state: "ACTIVE", startDate: start, endDate: null, completeDate: null,
      committedPoints: 40, completedPoints: 12,
    });
    expect(sprint).toEqual({
      id: "s1", name: "Sprint 1", state: "ACTIVE",
      startDate: start, endDate: null, completeDate: null,
      committedPoints: 40, completedPoints: 12,
    });
  });
});

describe("toDomainBurndownPoint", () => {
  it("maps date and remaining/completed points", () => {
    const date = new Date("2026-05-19");
    const point = toDomainBurndownPoint({ id: "b1", sprintId: "s1", date, remainingPoints: 30, completedPoints: 10 });
    expect(point).toEqual({ date, remainingPoints: 30, completedPoints: 10 });
  });
});

describe("toDomainCapacityEntry", () => {
  it("maps name and personDays", () => {
    const entry = toDomainCapacityEntry({ id: "c1", sprintId: "s1", teamMemberId: null, name: "Alice", personDays: 8 });
    expect(entry).toEqual({ name: "Alice", personDays: 8 });
  });
});
```

- [ ] **Step 2: Test ausführen (fails)**

Run: `npm test -- mappers`
Expected: FAIL — „Cannot find module './mappers'".

- [ ] **Step 3: Implementierung schreiben**

Create `src/lib/view/mappers.ts`:

```ts
import type { Sprint, BurndownPoint, CapacityEntry } from "@prisma/client";
import type { DomainSprint, DomainBurndownPoint, DomainCapacityEntry } from "@/lib/domain/types";

export function toDomainSprint(s: Sprint): DomainSprint {
  return {
    id: s.id,
    name: s.name,
    state: s.state,
    startDate: s.startDate,
    endDate: s.endDate,
    completeDate: s.completeDate,
    committedPoints: s.committedPoints,
    completedPoints: s.completedPoints,
  };
}

export function toDomainBurndownPoint(p: BurndownPoint): DomainBurndownPoint {
  return { date: p.date, remainingPoints: p.remainingPoints, completedPoints: p.completedPoints };
}

export function toDomainCapacityEntry(c: CapacityEntry): DomainCapacityEntry {
  return { name: c.name, personDays: c.personDays };
}
```

- [ ] **Step 4: Test ausführen (passes)**

Run: `npm test -- mappers`
Expected: PASS, 3 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add src/lib/view/mappers.ts src/lib/view/mappers.test.ts
git commit -m "feat: add prisma-to-domain view mappers"
```

---

## Task 3: Auswahl-Resolver (Team/Sprint-Defaults)

**Files:**
- Create: `src/lib/view/selection.ts`, `src/lib/view/selection.test.ts`

- [ ] **Step 1: Failing test schreiben**

Create `src/lib/view/selection.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveTeamId, resolveSprintId } from "./selection";

const teams = [{ id: "t1" }, { id: "t2" }];
const sprints = [
  { id: "s1", state: "CLOSED" as const },
  { id: "s2", state: "ACTIVE" as const },
  { id: "s3", state: "FUTURE" as const },
];

describe("resolveTeamId", () => {
  it("uses the query team when it exists", () => {
    expect(resolveTeamId(teams, "t2")).toBe("t2");
  });
  it("falls back to the first team when query is missing or invalid", () => {
    expect(resolveTeamId(teams, undefined)).toBe("t1");
    expect(resolveTeamId(teams, "nope")).toBe("t1");
  });
  it("returns undefined when there are no teams", () => {
    expect(resolveTeamId([], "t1")).toBeUndefined();
  });
});

describe("resolveSprintId", () => {
  it("uses the query sprint when it exists", () => {
    expect(resolveSprintId(sprints, "s1")).toBe("s1");
  });
  it("prefers the ACTIVE sprint when query is missing", () => {
    expect(resolveSprintId(sprints, undefined)).toBe("s2");
  });
  it("falls back to the last sprint when none is ACTIVE", () => {
    const noActive = [{ id: "s1", state: "CLOSED" as const }, { id: "s2", state: "CLOSED" as const }];
    expect(resolveSprintId(noActive, undefined)).toBe("s2");
  });
  it("returns undefined when there are no sprints", () => {
    expect(resolveSprintId([], undefined)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Test ausführen (fails)**

Run: `npm test -- selection`
Expected: FAIL — „Cannot find module './selection'".

- [ ] **Step 3: Implementierung schreiben**

Create `src/lib/view/selection.ts`:

```ts
export interface HasId {
  id: string;
}
export interface SprintLike extends HasId {
  state: "ACTIVE" | "CLOSED" | "FUTURE";
}

export function resolveTeamId<T extends HasId>(teams: T[], queryTeam: string | undefined): string | undefined {
  if (queryTeam && teams.some((t) => t.id === queryTeam)) return queryTeam;
  return teams[0]?.id;
}

export function resolveSprintId<T extends SprintLike>(sprints: T[], querySprint: string | undefined): string | undefined {
  if (querySprint && sprints.some((s) => s.id === querySprint)) return querySprint;
  const active = sprints.find((s) => s.state === "ACTIVE");
  if (active) return active.id;
  return sprints[sprints.length - 1]?.id;
}
```

- [ ] **Step 4: Test ausführen (passes)**

Run: `npm test -- selection`
Expected: PASS, alle Tests grün.

- [ ] **Step 5: Commit**

```bash
git add src/lib/view/selection.ts src/lib/view/selection.test.ts
git commit -m "feat: add team/sprint selection resolvers"
```

---

## Task 4: Formatierungs-Helfer

**Files:**
- Create: `src/lib/format.ts`, `src/lib/format.test.ts`

- [ ] **Step 1: Failing test schreiben**

Create `src/lib/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatPoints, formatDateShort, trendSymbol } from "./format";

describe("formatPoints", () => {
  it("shows up to one decimal, trims trailing zeros", () => {
    expect(formatPoints(34)).toBe("34");
    expect(formatPoints(2.5)).toBe("2,5");
  });
});

describe("formatDateShort", () => {
  it("formats as DD.MM.", () => {
    expect(formatDateShort(new Date("2026-05-19T00:00:00.000Z"))).toBe("19.05.");
  });
});

describe("trendSymbol", () => {
  it("maps trend direction to an arrow", () => {
    expect(trendSymbol("UP")).toBe("▲");
    expect(trendSymbol("DOWN")).toBe("▼");
    expect(trendSymbol("FLAT")).toBe("▬");
  });
});
```

- [ ] **Step 2: Test ausführen (fails)**

Run: `npm test -- format`
Expected: FAIL — „Cannot find module './format'".

- [ ] **Step 3: Implementierung schreiben**

Create `src/lib/format.ts`:

```ts
import type { TrendDirection } from "@/lib/domain/types";

export function formatPoints(value: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(value);
}

export function formatDateShort(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.`;
}

export function trendSymbol(trend: TrendDirection): string {
  return trend === "UP" ? "▲" : trend === "DOWN" ? "▼" : "▬";
}
```

- [ ] **Step 4: Test ausführen (passes)**

Run: `npm test -- format`
Expected: PASS, alle Tests grün.

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts
git commit -m "feat: add formatting helpers"
```

---

## Task 5: Server-Datenlader

**Files:**
- Create: `src/lib/view/loaders.ts`

> Glue-Schicht ohne eigene Unit-Tests (die Logik darin ist über die getesteten Metrik- und
> Konverter-Funktionen abgedeckt; verifiziert wird über Build + manuellen Smoke-Test in Task 13).

- [ ] **Step 1: Loader schreiben**

Create `src/lib/view/loaders.ts`:

```ts
import { listTeams, getTeam } from "@/lib/repositories/teamRepository";
import { listSprintsForTeam } from "@/lib/repositories/sprintRepository";
import { listBurndownForSprint } from "@/lib/repositories/burndownRepository";
import { listCapacityForSprint } from "@/lib/repositories/capacityRepository";
import { prisma } from "@/lib/db";
import { toDomainSprint, toDomainBurndownPoint, toDomainCapacityEntry } from "./mappers";
import { calcBurndown } from "@/lib/metrics/burndown";
import { calcVelocityTrend } from "@/lib/metrics/velocity";
import { calcCapacityEfficiency } from "@/lib/metrics/capacity";
import { calcCarryOver } from "@/lib/metrics/carryOver";

export async function loadTeams() {
  return listTeams();
}

export async function loadSprints(teamId: string) {
  return listSprintsForTeam(teamId);
}

export async function loadTeamWithSyncStatus(teamId: string) {
  return getTeam(teamId);
}

export async function loadDashboard(sprintId: string) {
  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (!sprint) return null;
  const domain = toDomainSprint(sprint);
  const caps = (await listCapacityForSprint(sprintId)).map(toDomainCapacityEntry);
  const capacity = calcCapacityEfficiency(domain, caps);
  return {
    sprintName: sprint.name,
    velocity: sprint.completedPoints,
    committed: sprint.committedPoints,
    carriedOver: calcCarryOver(domain),
    totalPersonDays: capacity.totalPersonDays,
    efficiency: capacity.efficiency,
  };
}

export async function loadBurndown(sprintId: string) {
  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (!sprint) return null;
  const points = (await listBurndownForSprint(sprintId)).map(toDomainBurndownPoint);
  const burndown = calcBurndown(toDomainSprint(sprint), points);
  return { sprintName: sprint.name, ...burndown };
}

export async function loadVelocity(teamId: string) {
  const sprints = (await listSprintsForTeam(teamId))
    .filter((s) => s.state !== "FUTURE")
    .map(toDomainSprint);
  return calcVelocityTrend(sprints);
}

export async function loadCapacity(sprintId: string) {
  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (!sprint) return null;
  const entries = await listCapacityForSprint(sprintId);
  const domainEntries = entries.map(toDomainCapacityEntry);
  const result = calcCapacityEfficiency(toDomainSprint(sprint), domainEntries);
  return {
    sprintName: sprint.name,
    completedPoints: sprint.completedPoints,
    entries: entries.map((e) => ({ id: e.id, name: e.name, personDays: e.personDays })),
    ...result,
  };
}
```

- [ ] **Step 2: Typprüfung**

Run: `npx tsc --noEmit`
Expected: keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/lib/view/loaders.ts
git commit -m "feat: add server data loaders for views"
```

---

## Task 6: Sidebar + Layout-Grundgerüst

**Files:**
- Create: `src/components/Sidebar.tsx`, `src/app/(app)/layout.tsx`
- Modify: `src/app/page.tsx`, `src/app/globals.css`

- [ ] **Step 1: globals.css um Basis-Theme erweitern**

Replace `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-slate-950 text-slate-100;
}
```

- [ ] **Step 2: Sidebar (Client, aktiver Link) schreiben**

Create `src/components/Sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "📊 Dashboard" },
  { href: "/burndown", label: "📉 Burndown" },
  { href: "/velocity", label: "📈 Velocity" },
  { href: "/capacity", label: "👥 Kapazität" },
  { href: "/settings/teams", label: "⚙ Teams / Jira" },
];

export function Sidebar() {
  const pathname = usePathname();
  const qs = useSearchParams().toString();

  return (
    <nav className="flex w-56 flex-col gap-1 border-r border-slate-800 bg-slate-900 p-4">
      <div className="mb-6 text-xl font-bold">⚡ Scrumi</div>
      {NAV.map((item) => {
        const active = pathname === item.href;
        const href = qs ? `${item.href}?${qs}` : item.href;
        return (
          <Link
            key={item.href}
            href={href}
            className={`rounded px-3 py-2 text-sm ${active ? "bg-slate-700 font-semibold" : "hover:bg-slate-800"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 3: App-Layout schreiben**

Create `src/app/(app)/layout.tsx`:

```tsx
import { Sidebar } from "@/components/Sidebar";
import { TeamSprintSelector } from "@/components/TeamSprintSelector";
import { SyncButton } from "@/components/SyncButton";
import { loadTeams, loadSprints } from "@/lib/view/loaders";
import { resolveTeamId } from "@/lib/view/selection";

export default async function AppLayout({
  children,
  searchParams,
}: {
  children: React.ReactNode;
  searchParams?: Promise<{ team?: string; sprint?: string }>;
}) {
  // searchParams ist in Layouts nicht verfügbar -> Selector lädt clientseitig nichts;
  // wir laden Teams hier und übergeben sie. Sprint-Liste lädt der Selector pro Team neu.
  const teams = await loadTeams();
  const defaultTeamId = resolveTeamId(teams, undefined);
  const sprints = defaultTeamId ? await loadSprints(defaultTeamId) : [];

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-3">
          <TeamSprintSelector
            teams={teams.map((t) => ({ id: t.id, name: t.name }))}
            sprints={sprints.map((s) => ({ id: s.id, name: s.name }))}
          />
          <SyncButton />
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
```

> **Hinweis:** Jede Seite ist eine Server Component und liest Team/Sprint aus ihren eigenen
> `searchParams`. Der Selektor im Header setzt nur die URL-Query; die Sprint-Liste im Header
> zeigt die Sprints des Default-Teams (für den Wechsel reicht das, da der Klick die Seite neu lädt).

- [ ] **Step 4: Root-Page auf Redirect umstellen**

Replace `src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
```

- [ ] **Step 5: Commit (Build folgt nach Selektor/SyncButton in Task 7)**

```bash
git add src/components/Sidebar.tsx "src/app/(app)/layout.tsx" src/app/page.tsx src/app/globals.css
git commit -m "feat: add sidebar and app layout shell"
```

---

## Task 7: TeamSprintSelector + SyncButton

**Files:**
- Create: `src/components/TeamSprintSelector.tsx`, `src/components/SyncButton.tsx`

- [ ] **Step 1: Selektor (Client) schreiben**

Create `src/components/TeamSprintSelector.tsx`:

```tsx
"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface Option {
  id: string;
  name: string;
}

export function TeamSprintSelector({ teams, sprints }: { teams: Option[]; sprints: Option[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(key: "team" | "sprint", value: string) {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    if (key === "team") next.delete("sprint"); // Sprint beim Teamwechsel zurücksetzen
    router.push(`${pathname}?${next.toString()}`);
  }

  const selectClass = "rounded bg-slate-800 px-3 py-1.5 text-sm";

  return (
    <div className="flex items-center gap-3">
      <select
        className={selectClass}
        value={params.get("team") ?? ""}
        onChange={(e) => update("team", e.target.value)}
      >
        {teams.length === 0 && <option value="">Kein Team</option>}
        {teams.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <select
        className={selectClass}
        value={params.get("sprint") ?? ""}
        onChange={(e) => update("sprint", e.target.value)}
      >
        {sprints.length === 0 && <option value="">Kein Sprint</option>}
        {sprints.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 2: SyncButton (Client) schreiben**

Create `src/components/SyncButton.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function sync() {
    setBusy(true);
    try {
      await fetch("/api/sync", { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={sync}
      disabled={busy}
      className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
    >
      {busy ? "Synchronisiere…" : "🔄 Jetzt synchronisieren"}
    </button>
  );
}
```

- [ ] **Step 3: Build verifizieren**

Run: `npm run build`
Expected: Build erfolgreich (Routen `/`, `/dashboard` noch nicht vorhanden → in Task 8 ff.; `/` redirectet). Falls Build wegen fehlender `/dashboard`-Route nur warnt, ist das ok; harte Fehler dürfen nicht auftreten.

- [ ] **Step 4: Commit**

```bash
git add src/components/TeamSprintSelector.tsx src/components/SyncButton.tsx
git commit -m "feat: add team/sprint selector and sync button"
```

---

## Task 8: KPI-Karte + Dashboard-Seite

**Files:**
- Create: `src/components/KpiCard.tsx`, `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: KpiCard schreiben**

Create `src/components/KpiCard.tsx`:

```tsx
export function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-3xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Dashboard-Seite schreiben**

Create `src/app/(app)/dashboard/page.tsx`:

```tsx
import { KpiCard } from "@/components/KpiCard";
import { loadTeams, loadSprints, loadDashboard } from "@/lib/view/loaders";
import { resolveTeamId, resolveSprintId } from "@/lib/view/selection";
import { formatPoints } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; sprint?: string }>;
}) {
  const { team, sprint } = await searchParams;
  const teams = await loadTeams();
  const teamId = resolveTeamId(teams, team);
  if (!teamId) return <Empty />;

  const sprints = await loadSprints(teamId);
  const sprintId = resolveSprintId(sprints, sprint);
  if (!sprintId) return <Empty />;

  const data = await loadDashboard(sprintId);
  if (!data) return <Empty />;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{data.sprintName}</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Velocity" value={formatPoints(data.velocity)} hint="erledigte Story Points" />
        <KpiCard label="Commitment" value={formatPoints(data.committed)} hint={`${formatPoints(data.carriedOver)} mitgenommen`} />
        <KpiCard label="Kapazität" value={`${formatPoints(data.totalPersonDays)} PT`} hint="Personentage" />
        <KpiCard label="Effizienz" value={formatPoints(data.efficiency)} hint="SP pro Personentag" />
      </div>
    </div>
  );
}

function Empty() {
  return (
    <p className="text-slate-400">
      Noch keine Daten. Lege unter <strong>Teams / Jira</strong> ein Team an und synchronisiere.
    </p>
  );
}
```

- [ ] **Step 3: Build verifizieren**

Run: `npm run build`
Expected: Build erfolgreich; Route `/dashboard` gelistet.

- [ ] **Step 4: Commit**

```bash
git add src/components/KpiCard.tsx "src/app/(app)/dashboard/page.tsx"
git commit -m "feat: add dashboard page with KPI cards"
```

---

## Task 9: Burndown-Chart + Seite

**Files:**
- Create: `src/components/charts/BurndownChart.tsx`, `src/app/(app)/burndown/page.tsx`

- [ ] **Step 1: BurndownChart (Client) schreiben**

Create `src/components/charts/BurndownChart.tsx`:

```tsx
"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export interface BurndownRow {
  label: string;
  ideal: number | null;
  actual: number | null;
}

export function BurndownChart({ data }: { data: BurndownRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart data={data} margin={{ top: 16, right: 24, bottom: 8, left: 0 }}>
        <CartesianGrid stroke="#1e293b" />
        <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
        <YAxis stroke="#94a3b8" fontSize={12} />
        <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
        <Legend />
        <Line type="monotone" dataKey="ideal" name="Ideal" stroke="#64748b" strokeDasharray="5 5" dot={false} connectNulls />
        <Line type="monotone" dataKey="actual" name="Ist" stroke="#34d399" strokeWidth={2} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Burndown-Seite schreiben**

Create `src/app/(app)/burndown/page.tsx`:

```tsx
import { BurndownChart, type BurndownRow } from "@/components/charts/BurndownChart";
import { loadTeams, loadSprints, loadBurndown } from "@/lib/view/loaders";
import { resolveTeamId, resolveSprintId } from "@/lib/view/selection";
import { formatDateShort } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BurndownPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; sprint?: string }>;
}) {
  const { team, sprint } = await searchParams;
  const teams = await loadTeams();
  const teamId = resolveTeamId(teams, team);
  if (!teamId) return <p className="text-slate-400">Kein Team vorhanden.</p>;

  const sprints = await loadSprints(teamId);
  const sprintId = resolveSprintId(sprints, sprint);
  if (!sprintId) return <p className="text-slate-400">Kein Sprint vorhanden.</p>;

  const data = await loadBurndown(sprintId);
  if (!data) return <p className="text-slate-400">Keine Burndown-Daten.</p>;

  // Ideal- und Ist-Linie auf gemeinsame Datumsachse mappen
  const byLabel = new Map<string, BurndownRow>();
  for (const p of data.ideal) {
    const label = formatDateShort(p.date);
    byLabel.set(label, { label, ideal: round(p.remainingPoints), actual: null });
  }
  for (const p of data.actual) {
    const label = formatDateShort(p.date);
    const row = byLabel.get(label) ?? { label, ideal: null, actual: null };
    row.actual = round(p.remainingPoints);
    byLabel.set(label, row);
  }
  const rows = [...byLabel.values()];

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Burndown · {data.sprintName}</h1>
      {rows.length === 0 ? (
        <p className="text-slate-400">Dieser Sprint hat noch keine Burndown-Punkte.</p>
      ) : (
        <BurndownChart data={rows} />
      )}
    </div>
  );
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
```

- [ ] **Step 3: Build verifizieren**

Run: `npm run build`
Expected: Build erfolgreich; Route `/burndown` gelistet.

- [ ] **Step 4: Commit**

```bash
git add src/components/charts/BurndownChart.tsx "src/app/(app)/burndown/page.tsx"
git commit -m "feat: add burndown chart and page"
```

---

## Task 10: Velocity-Chart + Seite

**Files:**
- Create: `src/components/charts/VelocityChart.tsx`, `src/app/(app)/velocity/page.tsx`

- [ ] **Step 1: VelocityChart (Client) schreiben**

Create `src/components/charts/VelocityChart.tsx`:

```tsx
"use client";

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export interface VelocityRow {
  sprintName: string;
  velocity: number;
  committed: number;
  carriedOver: number;
}

export function VelocityChart({ data, average }: { data: VelocityRow[]; average: number }) {
  const withAvg = data.map((d) => ({ ...d, average: round(average) }));
  return (
    <ResponsiveContainer width="100%" height={360}>
      <ComposedChart data={withAvg} margin={{ top: 16, right: 24, bottom: 8, left: 0 }}>
        <CartesianGrid stroke="#1e293b" />
        <XAxis dataKey="sprintName" stroke="#94a3b8" fontSize={12} />
        <YAxis stroke="#94a3b8" fontSize={12} />
        <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
        <Legend />
        <Bar dataKey="committed" name="Commitment" fill="#475569" />
        <Bar dataKey="velocity" name="Geliefert" fill="#34d399" />
        <Line type="monotone" dataKey="average" name="Ø Velocity" stroke="#fbbf24" strokeDasharray="4 4" dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
```

- [ ] **Step 2: Velocity-Seite schreiben**

Create `src/app/(app)/velocity/page.tsx`:

```tsx
import { VelocityChart } from "@/components/charts/VelocityChart";
import { loadTeams, loadVelocity } from "@/lib/view/loaders";
import { resolveTeamId } from "@/lib/view/selection";
import { formatPoints, trendSymbol } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function VelocityPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const { team } = await searchParams;
  const teams = await loadTeams();
  const teamId = resolveTeamId(teams, team);
  if (!teamId) return <p className="text-slate-400">Kein Team vorhanden.</p>;

  const trend = await loadVelocity(teamId);

  return (
    <div>
      <div className="mb-4 flex items-baseline gap-3">
        <h1 className="text-2xl font-bold">Velocity</h1>
        <span className="text-sm text-slate-400">
          {trendSymbol(trend.trend)} Ø {formatPoints(trend.average)} SP / Sprint
        </span>
      </div>
      {trend.points.length === 0 ? (
        <p className="text-slate-400">Noch keine abgeschlossenen Sprints.</p>
      ) : (
        <VelocityChart data={trend.points} average={trend.average} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Build verifizieren**

Run: `npm run build`
Expected: Build erfolgreich; Route `/velocity` gelistet.

- [ ] **Step 4: Commit**

```bash
git add src/components/charts/VelocityChart.tsx "src/app/(app)/velocity/page.tsx"
git commit -m "feat: add velocity chart and page"
```

---

## Task 11: Kapazitäts-Seite + Server Action

**Files:**
- Create: `src/app/(app)/capacity/actions.ts`, `src/components/CapacityForm.tsx`, `src/app/(app)/capacity/page.tsx`

- [ ] **Step 1: Server Action schreiben**

Create `src/app/(app)/capacity/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { setCapacityEntry } from "@/lib/repositories/capacityRepository";
import { prisma } from "@/lib/db";

export async function addCapacityEntry(formData: FormData) {
  const sprintId = String(formData.get("sprintId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const personDays = Number(formData.get("personDays") ?? "0");
  if (!sprintId || !name || !Number.isFinite(personDays) || personDays <= 0) return;

  await setCapacityEntry(sprintId, { name, personDays });
  revalidatePath("/capacity");
  revalidatePath("/dashboard");
}

export async function deleteCapacityEntry(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.capacityEntry.delete({ where: { id } });
  revalidatePath("/capacity");
  revalidatePath("/dashboard");
}
```

- [ ] **Step 2: CapacityForm (Client) schreiben**

Create `src/components/CapacityForm.tsx`:

```tsx
"use client";

import { addCapacityEntry } from "@/app/(app)/capacity/actions";

export function CapacityForm({ sprintId }: { sprintId: string }) {
  return (
    <form action={addCapacityEntry} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="sprintId" value={sprintId} />
      <label className="flex flex-col text-xs text-slate-400">
        Person
        <input name="name" required className="mt-1 rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-100" placeholder="Name" />
      </label>
      <label className="flex flex-col text-xs text-slate-400">
        Personentage
        <input name="personDays" type="number" step="0.5" min="0.5" required className="mt-1 w-32 rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-100" />
      </label>
      <button type="submit" className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500">
        Hinzufügen
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Kapazitäts-Seite schreiben**

Create `src/app/(app)/capacity/page.tsx`:

```tsx
import { CapacityForm } from "@/components/CapacityForm";
import { deleteCapacityEntry } from "./actions";
import { loadTeams, loadSprints, loadCapacity } from "@/lib/view/loaders";
import { resolveTeamId, resolveSprintId } from "@/lib/view/selection";
import { formatPoints } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CapacityPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; sprint?: string }>;
}) {
  const { team, sprint } = await searchParams;
  const teams = await loadTeams();
  const teamId = resolveTeamId(teams, team);
  if (!teamId) return <p className="text-slate-400">Kein Team vorhanden.</p>;

  const sprints = await loadSprints(teamId);
  const sprintId = resolveSprintId(sprints, sprint);
  if (!sprintId) return <p className="text-slate-400">Kein Sprint vorhanden.</p>;

  const data = await loadCapacity(sprintId);
  if (!data) return <p className="text-slate-400">Kein Sprint gefunden.</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">Kapazität · {data.sprintName}</h1>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <Stat label="Personentage" value={`${formatPoints(data.totalPersonDays)} PT`} />
        <Stat label="Geliefert" value={`${formatPoints(data.completedPoints)} SP`} />
        <Stat label="Effizienz" value={`${formatPoints(data.efficiency)} SP/PT`} />
      </div>

      <div className="mb-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <CapacityForm sprintId={sprintId} />
      </div>

      <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800">
        {data.entries.length === 0 && <li className="p-3 text-sm text-slate-400">Noch keine Einträge.</li>}
        {data.entries.map((e) => (
          <li key={e.id} className="flex items-center justify-between p-3 text-sm">
            <span>{e.name}</span>
            <span className="flex items-center gap-4">
              <span>{formatPoints(e.personDays)} PT</span>
              <form action={deleteCapacityEntry}>
                <input type="hidden" name="id" value={e.id} />
                <button className="text-slate-500 hover:text-red-400" aria-label="Löschen">✕</button>
              </form>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
```

- [ ] **Step 4: Build verifizieren**

Run: `npm run build`
Expected: Build erfolgreich; Route `/capacity` gelistet.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/capacity" src/components/CapacityForm.tsx
git commit -m "feat: add capacity page with entry form and server actions"
```

---

## Task 12: Teams/Jira-Einstellungen + Server Action

**Files:**
- Create: `src/app/(app)/settings/teams/actions.ts`, `src/components/TeamForm.tsx`, `src/app/(app)/settings/teams/page.tsx`

- [ ] **Step 1: Server Action schreiben**

Create `src/app/(app)/settings/teams/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createTeam } from "@/lib/repositories/teamRepository";

export async function addTeam(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const jiraBoardId = String(formData.get("jiraBoardId") ?? "").trim();
  const syncIntervalMinutes = Number(formData.get("syncIntervalMinutes") ?? "60");
  if (!name || !jiraBoardId) return;

  await createTeam({
    name,
    jiraBoardId,
    syncIntervalMinutes: Number.isFinite(syncIntervalMinutes) ? syncIntervalMinutes : 60,
  });
  revalidatePath("/settings/teams");
}
```

- [ ] **Step 2: TeamForm (Client) schreiben**

Create `src/components/TeamForm.tsx`:

```tsx
"use client";

import { addTeam } from "@/app/(app)/settings/teams/actions";

export function TeamForm() {
  return (
    <form action={addTeam} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col text-xs text-slate-400">
        Teamname
        <input name="name" required className="mt-1 rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-100" placeholder="Team Alpha" />
      </label>
      <label className="flex flex-col text-xs text-slate-400">
        Jira Board-ID
        <input name="jiraBoardId" required className="mt-1 w-32 rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-100" placeholder="42" />
      </label>
      <label className="flex flex-col text-xs text-slate-400">
        Sync-Intervall (min)
        <input name="syncIntervalMinutes" type="number" min="1" defaultValue={60} className="mt-1 w-28 rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-100" />
      </label>
      <button type="submit" className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500">
        Team anlegen
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Teams-Seite schreiben**

Create `src/app/(app)/settings/teams/page.tsx`:

```tsx
import { TeamForm } from "@/components/TeamForm";
import { loadTeams } from "@/lib/view/loaders";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const teams = await loadTeams();

  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Teams / Jira</h1>

      <div className="mb-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <TeamForm />
      </div>

      <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800">
        {teams.length === 0 && <li className="p-3 text-sm text-slate-400">Noch keine Teams angelegt.</li>}
        {teams.map((t) => (
          <li key={t.id} className="flex items-center justify-between p-3 text-sm">
            <span>
              <strong>{t.name}</strong> · Board {t.jiraBoardId} · alle {t.syncIntervalMinutes} min
            </span>
            <span className={t.lastSyncError ? "text-red-400" : "text-slate-400"}>
              {t.lastSyncError
                ? `Sync-Fehler: ${t.lastSyncError}`
                : t.lastSyncedAt
                ? `zuletzt: ${new Date(t.lastSyncedAt).toLocaleString("de-DE")}`
                : "noch nicht synchronisiert"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Build verifizieren**

Run: `npm run build`
Expected: Build erfolgreich; Route `/settings/teams` gelistet.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/settings" src/components/TeamForm.tsx
git commit -m "feat: add teams/jira settings page with sync status"
```

---

## Task 13: Komponententest (CapacityForm) + manueller Smoke-Test

**Files:**
- Create: `src/components/CapacityForm.test.tsx`

- [ ] **Step 1: Failing component test schreiben**

Create `src/components/CapacityForm.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Server Action mocken (Client-Test soll sie nicht echt aufrufen)
vi.mock("@/app/(app)/capacity/actions", () => ({ addCapacityEntry: vi.fn() }));

import { CapacityForm } from "./CapacityForm";

describe("CapacityForm", () => {
  it("renders person and person-days inputs plus the hidden sprintId", () => {
    const { container } = render(<CapacityForm sprintId="s123" />);

    expect(screen.getByPlaceholderText("Name")).toBeInTheDocument();
    expect(screen.getByText("Hinzufügen")).toBeInTheDocument();

    const hidden = container.querySelector('input[name="sprintId"]') as HTMLInputElement;
    expect(hidden.value).toBe("s123");
  });
});
```

- [ ] **Step 2: Test ausführen (fails dann passes)**

Run: `npm test -- CapacityForm`
Expected: PASS (Komponente existiert bereits aus Task 11). Falls FAIL wegen jsdom-Setup, prüfe `vitest.setup.ts` aus Task 1.

- [ ] **Step 3: Komplette Test-Suite + Build**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: alle Tests grün (node- und dom-Projekt), keine Typfehler, Build erfolgreich.

- [ ] **Step 4: Manueller Smoke-Test**

Run:
```bash
docker compose up -d postgres
npm run dev
```
Dann im Browser auf `http://localhost:3000`:
- `/` leitet auf `/dashboard` weiter.
- Unter **Teams / Jira** ein Team anlegen (Name + Board-ID) → erscheint in der Liste mit „noch nicht synchronisiert".
- Mit echten `JIRA_*`-Env-Werten **🔄 Jetzt synchronisieren** klicken → Sprints/Issues erscheinen; Dashboard zeigt KPIs, Burndown/Velocity zeigen Charts.
- Unter **Kapazität** Personen + Personentage eintragen → Effizienz aktualisiert sich, Dashboard-KPI „Kapazität"/„Effizienz" ändert sich.

Expected: Seiten laden ohne Laufzeitfehler; ohne Daten erscheinen die freundlichen Leerzustände.

- [ ] **Step 5: Commit**

```bash
git add src/components/CapacityForm.test.tsx
git commit -m "test: add CapacityForm component test"
```

---

## Task 14: README + Lizenz + .env-Hinweis

**Files:**
- Create: `README.md`, `LICENSE`

- [ ] **Step 1: README schreiben**

Create `README.md`:

```markdown
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
```

- [ ] **Step 2: LICENSE schreiben (MIT)**

Create `LICENSE` mit dem Standard-MIT-Lizenztext, Jahr `2026`, Inhaber `Scrumi Contributors`:

```
MIT License

Copyright (c) 2026 Scrumi Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 3: Commit**

```bash
git add README.md LICENSE
git commit -m "docs: add README and MIT license"
```

---

## Self-Review (vom Plan-Autor durchgeführt)

**Spec-Abdeckung:**
- Layout B: Seitenleiste + Detailseiten (Spec §3, §6) → Tasks 6, 8–12.
- Team/Sprint-Auswahl via URL-Query, verlinkbar (Spec §6) → Task 3 (Resolver) + Task 7 (Selektor).
- Dashboard mit KPI-Karten (Spec §6) → Task 8.
- Burndown Ist vs. Ideal (Spec §5, §6) → Task 9 (nutzt `calcBurndown` aus Phase 1).
- Velocity-Trend, Commitment vs. geliefert + Carry-over, Trendsymbol (Spec §5, §6) → Task 10 (nutzt `calcVelocityTrend`).
- Kapazität: Personen + Personentage eingeben, Effizienz (Spec §4, §5, §6) → Task 11 (nutzt `calcCapacityEfficiency`).
- Manueller Sync-Button (Spec §7) → Task 7 (`SyncButton` → `/api/sync` aus Phase 2).
- Sync-Status / lastSyncError sichtbar (Spec §7) → Task 12.
- Server Components für Anzeige, Client nur Charts/Formulare (Spec §3, §6) → durchgehend.
- Open-Source-Beiwerk README/MIT (Spec §9) → Task 14. *(CONTRIBUTING.md und CI sind optionales Beiwerk; können bei Bedarf folgen.)*

**Platzhalter-Scan:** Keine TBD/TODO. Der LICENSE-Step enthält den vollständigen MIT-Text statt eines Verweises.

**Typkonsistenz:** Loader-Rückgaben passen zu den Props der Komponenten: `loadVelocity` → `VelocityTrend{points, average, trend}` → `VelocityChart{data, average}` + `trendSymbol(trend)`. `loadBurndown` liefert `{ideal, actual}` (BurndownLinePoint[]), die die Seite zu `BurndownRow{label, ideal, actual}` für `BurndownChart` zusammenführt. `resolveTeamId`/`resolveSprintId` (Task 3) werden in allen Seiten mit denselben Signaturen genutzt. Server Actions (`addCapacityEntry`, `deleteCapacityEntry`, `addTeam`) erwarten `FormData` und werden via `action={…}` gebunden. Recharts-Daten sind serialisierbar (Strings/Zahlen, keine Date-Objekte über die Client-Grenze).
```
