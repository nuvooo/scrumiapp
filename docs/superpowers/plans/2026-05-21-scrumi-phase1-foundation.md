# Scrumi Phase 1: Fundament + Domain-Kern — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lauffähiges Next.js-Projektgerüst mit Postgres/Prisma-Datenmodell, Repository-Schicht und vollständig getesteter, Framework-unabhängiger Scrum-Berechnungslogik (Velocity, Burndown, Kapazität, Carry-over).

**Architecture:** Monolithische Next.js-15-App (App Router, TypeScript). Die Domain-Schicht (`lib/metrics/`) ist eine reine Funktionsbibliothek auf eigenen Domänentypen, ohne Kenntnis von DB oder Jira. Persistenz läuft ausschließlich über Prisma-Repositories (`lib/repositories/`). Postgres läuft via Docker.

**Tech Stack:** Next.js 15, React, TypeScript, Tailwind CSS, Prisma ORM, PostgreSQL, Vitest, Docker Compose.

---

## Datei-Struktur (in diesem Plan erstellt)

```
package.json, tsconfig.json, next.config.ts        Projektgerüst
docker-compose.yml, .env.example, .env             Postgres + Konfiguration
prisma/schema.prisma                               Datenmodell
src/lib/db.ts                                       Prisma-Client-Singleton
src/lib/domain/types.ts                             Domänentypen (DB-/Jira-unabhängig)
src/lib/metrics/carryOver.ts        + Test          Carry-over
src/lib/metrics/velocity.ts         + Test          Velocity-Trend
src/lib/metrics/burndown.ts         + Test          Burndown Ist/Ideal
src/lib/metrics/capacity.ts         + Test          Kapazität & Effizienz
src/lib/metrics/workingDays.ts      + Test          Arbeitstage-Helfer (für Burndown)
src/lib/repositories/teamRepository.ts              Team-CRUD
src/lib/repositories/sprintRepository.ts            Sprint-Upsert/Read
src/lib/repositories/capacityRepository.ts          Kapazität-CRUD
```

Aufteilung nach Verantwortung: jede Metrik-Funktion in eigener Datei mit eigenem Test (klein, fokussiert, isoliert testbar). Repositories getrennt nach Aggregat.

---

## Task 1: Next.js-Projektgerüst

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `postcss.config.mjs`, `tailwind.config.ts`

- [ ] **Step 1: Scaffold via create-next-app**

Run im Projektverzeichnis (Verzeichnis ist nicht leer wegen `docs/` und `.git/` — daher manuell scaffolden, nicht `create-next-app .`):

```bash
npm init -y
npm install next@15 react@19 react-dom@19
npm install -D typescript @types/react @types/node @types/react-dom tailwindcss@3 postcss autoprefixer
```

- [ ] **Step 2: package.json-Scripts setzen**

Ersetze das `scripts`-Feld in `package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: tsconfig.json schreiben**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: next.config.ts + Tailwind-Konfig schreiben**

Create `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

Create `tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};

export default config;
```

Create `postcss.config.mjs`:

```js
const config = { plugins: { tailwindcss: {}, autoprefixer: {} } };
export default config;
```

- [ ] **Step 5: App-Root-Dateien schreiben**

Create `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Create `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scrumi",
  description: "Self-hosted Scrum analytics",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
```

Create `src/app/page.tsx`:

```tsx
export default function Home() {
  return <main className="p-8 text-2xl font-bold">Scrumi</main>;
}
```

- [ ] **Step 6: Build verifizieren**

Run: `npm run build`
Expected: Build erfolgreich, „Compiled successfully", Route `/` wird gelistet.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts tailwind.config.ts postcss.config.mjs src/app
git commit -m "feat: scaffold Next.js 15 app with Tailwind"
```

---

## Task 2: Vitest einrichten

**Files:**
- Create: `vitest.config.ts`, `src/lib/sanity.test.ts`

- [ ] **Step 1: Vitest installieren**

```bash
npm install -D vitest
```

- [ ] **Step 2: vitest.config.ts schreiben**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 3: Sanity-Test schreiben (failing)**

Create `src/lib/sanity.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("sanity", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Test ausführen**

Run: `npm test`
Expected: PASS, 1 Test grün. (Bestätigt, dass die Test-Infrastruktur läuft.)

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts src/lib/sanity.test.ts
git commit -m "test: set up vitest"
```

---

## Task 3: Postgres + Prisma + docker-compose

**Files:**
- Create: `docker-compose.yml`, `.env.example`, `.env`, `prisma/schema.prisma`, `src/lib/db.ts`

- [ ] **Step 1: Prisma installieren**

```bash
npm install @prisma/client
npm install -D prisma
```

- [ ] **Step 2: docker-compose.yml schreiben**

Create `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: scrumi
      POSTGRES_PASSWORD: scrumi
      POSTGRES_DB: scrumi
    ports:
      - "5432:5432"
    volumes:
      - scrumi_pgdata:/var/lib/postgresql/data

volumes:
  scrumi_pgdata:
```

- [ ] **Step 3: Env-Dateien schreiben**

Create `.env.example`:

```
DATABASE_URL="postgresql://scrumi:scrumi@localhost:5432/scrumi?schema=public"

# Jira Cloud (in Phase 2 genutzt)
JIRA_BASE_URL=""
JIRA_EMAIL=""
JIRA_API_TOKEN=""
JIRA_STORY_POINTS_FIELD="customfield_10016"

# Sync-Standardintervall in Minuten (Phase 2)
SYNC_DEFAULT_INTERVAL="60"
```

Create `.env` (gleicher Inhalt, mit echtem `DATABASE_URL`; bereits via `.gitignore` ausgeschlossen):

```
DATABASE_URL="postgresql://scrumi:scrumi@localhost:5432/scrumi?schema=public"
JIRA_BASE_URL=""
JIRA_EMAIL=""
JIRA_API_TOKEN=""
JIRA_STORY_POINTS_FIELD="customfield_10016"
SYNC_DEFAULT_INTERVAL="60"
```

- [ ] **Step 4: Prisma-Schema schreiben**

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum SprintState {
  ACTIVE
  CLOSED
  FUTURE
}

enum StatusCategory {
  TODO
  IN_PROGRESS
  DONE
}

model Team {
  id                  String   @id @default(cuid())
  name                String
  jiraBoardId         String
  syncIntervalMinutes Int      @default(60)
  lastSyncedAt        DateTime?
  lastSyncError       String?
  createdAt           DateTime @default(now())
  sprints             Sprint[]
  members             TeamMember[]
}

model Sprint {
  id              String       @id @default(cuid())
  team            Team         @relation(fields: [teamId], references: [id], onDelete: Cascade)
  teamId          String
  jiraSprintId    String
  name            String
  state           SprintState
  startDate       DateTime?
  endDate         DateTime?
  completeDate    DateTime?
  committedPoints Float        @default(0)
  completedPoints Float        @default(0)
  issues          Issue[]
  burndownPoints  BurndownPoint[]
  capacityEntries CapacityEntry[]

  @@unique([teamId, jiraSprintId])
}

model Issue {
  id                   String         @id @default(cuid())
  sprint               Sprint         @relation(fields: [sprintId], references: [id], onDelete: Cascade)
  sprintId             String
  jiraKey              String
  summary              String
  storyPoints          Float          @default(0)
  status               String
  statusCategory       StatusCategory
  resolvedAt           DateTime?
  addedAfterSprintStart Boolean       @default(false)

  @@unique([sprintId, jiraKey])
}

model BurndownPoint {
  id              String   @id @default(cuid())
  sprint          Sprint   @relation(fields: [sprintId], references: [id], onDelete: Cascade)
  sprintId        String
  date            DateTime
  remainingPoints Float
  completedPoints Float

  @@unique([sprintId, date])
}

model TeamMember {
  id              String          @id @default(cuid())
  team            Team            @relation(fields: [teamId], references: [id], onDelete: Cascade)
  teamId          String
  name            String
  capacityEntries CapacityEntry[]
}

model CapacityEntry {
  id           String      @id @default(cuid())
  sprint       Sprint      @relation(fields: [sprintId], references: [id], onDelete: Cascade)
  sprintId     String
  teamMember   TeamMember? @relation(fields: [teamMemberId], references: [id], onDelete: SetNull)
  teamMemberId String?
  name         String
  personDays   Float
}
```

- [ ] **Step 5: Prisma-Client-Singleton schreiben**

Create `src/lib/db.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 6: Postgres starten und Migration ausführen**

Run:
```bash
docker compose up -d postgres
npx prisma migrate dev --name init
```
Expected: Container läuft; Migration `init` wird erstellt und angewendet; „Your database is now in sync with your schema." Prisma-Client wird generiert.

- [ ] **Step 7: Commit**

```bash
git add docker-compose.yml .env.example prisma src/lib/db.ts package.json package-lock.json
git commit -m "feat: add Postgres, Prisma schema and client"
```

---

## Task 4: Domänentypen

**Files:**
- Create: `src/lib/domain/types.ts`

- [ ] **Step 1: Domänentypen schreiben**

Create `src/lib/domain/types.ts` (reine Typen, unabhängig von Prisma und Jira; die Metrik-Funktionen arbeiten ausschließlich hierauf):

```ts
export type SprintState = "ACTIVE" | "CLOSED" | "FUTURE";
export type StatusCategory = "TODO" | "IN_PROGRESS" | "DONE";
export type TrendDirection = "UP" | "DOWN" | "FLAT";

export interface DomainIssue {
  jiraKey: string;
  storyPoints: number;
  statusCategory: StatusCategory;
  resolvedAt: Date | null;
  addedAfterSprintStart: boolean;
}

export interface DomainSprint {
  id: string;
  name: string;
  state: SprintState;
  startDate: Date | null;
  endDate: Date | null;
  completeDate: Date | null;
  committedPoints: number;
  completedPoints: number;
}

export interface DomainBurndownPoint {
  date: Date;
  remainingPoints: number;
  completedPoints: number;
}

export interface DomainCapacityEntry {
  name: string;
  personDays: number;
}
```

- [ ] **Step 2: Typprüfung**

Run: `npx tsc --noEmit`
Expected: keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/lib/domain/types.ts
git commit -m "feat: add domain types"
```

---

## Task 5: Carry-over-Berechnung

**Files:**
- Create: `src/lib/metrics/carryOver.ts`, `src/lib/metrics/carryOver.test.ts`

- [ ] **Step 1: Failing test schreiben**

Create `src/lib/metrics/carryOver.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { calcCarryOver } from "./carryOver";
import type { DomainSprint } from "@/lib/domain/types";

function sprint(committed: number, completed: number): DomainSprint {
  return {
    id: "s1", name: "Sprint 1", state: "CLOSED",
    startDate: null, endDate: null, completeDate: null,
    committedPoints: committed, completedPoints: completed,
  };
}

describe("calcCarryOver", () => {
  it("returns committed minus completed", () => {
    expect(calcCarryOver(sprint(40, 34))).toBe(6);
  });

  it("returns 0 when everything was completed", () => {
    expect(calcCarryOver(sprint(30, 30))).toBe(0);
  });

  it("never returns negative (more completed than committed)", () => {
    expect(calcCarryOver(sprint(20, 25))).toBe(0);
  });
});
```

- [ ] **Step 2: Test ausführen (fails)**

Run: `npm test -- carryOver`
Expected: FAIL — „Cannot find module './carryOver'".

- [ ] **Step 3: Implementierung schreiben**

Create `src/lib/metrics/carryOver.ts`:

```ts
import type { DomainSprint } from "@/lib/domain/types";

/** Nicht abgeschlossene ("mitgenommene") Story Points eines Sprints. Nie negativ. */
export function calcCarryOver(sprint: DomainSprint): number {
  return Math.max(0, sprint.committedPoints - sprint.completedPoints);
}
```

- [ ] **Step 4: Test ausführen (passes)**

Run: `npm test -- carryOver`
Expected: PASS, 3 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add src/lib/metrics/carryOver.ts src/lib/metrics/carryOver.test.ts
git commit -m "feat: add carry-over metric"
```

---

## Task 6: Velocity-Trend

**Files:**
- Create: `src/lib/metrics/velocity.ts`, `src/lib/metrics/velocity.test.ts`

- [ ] **Step 1: Failing test schreiben**

Create `src/lib/metrics/velocity.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { calcVelocityTrend } from "./velocity";
import type { DomainSprint } from "@/lib/domain/types";

function sprint(name: string, committed: number, completed: number): DomainSprint {
  return {
    id: name, name, state: "CLOSED",
    startDate: null, endDate: null, completeDate: null,
    committedPoints: committed, completedPoints: completed,
  };
}

describe("calcVelocityTrend", () => {
  it("maps each sprint to velocity/committed/carriedOver", () => {
    const result = calcVelocityTrend([sprint("S1", 40, 30), sprint("S2", 35, 35)]);
    expect(result.points).toEqual([
      { sprintName: "S1", velocity: 30, committed: 40, carriedOver: 10 },
      { sprintName: "S2", velocity: 35, committed: 35, carriedOver: 0 },
    ]);
  });

  it("computes average velocity", () => {
    const result = calcVelocityTrend([sprint("S1", 0, 20), sprint("S2", 0, 30)]);
    expect(result.average).toBe(25);
  });

  it("detects an upward trend (last > first)", () => {
    const result = calcVelocityTrend([sprint("S1", 0, 20), sprint("S2", 0, 30)]);
    expect(result.trend).toBe("UP");
  });

  it("detects a downward trend (last < first)", () => {
    const result = calcVelocityTrend([sprint("S1", 0, 30), sprint("S2", 0, 20)]);
    expect(result.trend).toBe("DOWN");
  });

  it("returns FLAT for equal endpoints", () => {
    const result = calcVelocityTrend([sprint("S1", 0, 20), sprint("S2", 0, 20)]);
    expect(result.trend).toBe("FLAT");
  });

  it("handles empty input", () => {
    const result = calcVelocityTrend([]);
    expect(result.points).toEqual([]);
    expect(result.average).toBe(0);
    expect(result.trend).toBe("FLAT");
  });
});
```

- [ ] **Step 2: Test ausführen (fails)**

Run: `npm test -- velocity`
Expected: FAIL — „Cannot find module './velocity'".

- [ ] **Step 3: Implementierung schreiben**

Create `src/lib/metrics/velocity.ts`:

```ts
import type { DomainSprint, TrendDirection } from "@/lib/domain/types";
import { calcCarryOver } from "./carryOver";

export interface VelocityPoint {
  sprintName: string;
  velocity: number;
  committed: number;
  carriedOver: number;
}

export interface VelocityTrend {
  points: VelocityPoint[];
  average: number;
  trend: TrendDirection;
}

/** Velocity je Sprint plus Durchschnitt und Trendrichtung (erster vs. letzter Sprint). */
export function calcVelocityTrend(sprints: DomainSprint[]): VelocityTrend {
  const points: VelocityPoint[] = sprints.map((s) => ({
    sprintName: s.name,
    velocity: s.completedPoints,
    committed: s.committedPoints,
    carriedOver: calcCarryOver(s),
  }));

  if (points.length === 0) {
    return { points, average: 0, trend: "FLAT" };
  }

  const average =
    points.reduce((sum, p) => sum + p.velocity, 0) / points.length;

  const first = points[0].velocity;
  const last = points[points.length - 1].velocity;
  const trend: TrendDirection = last > first ? "UP" : last < first ? "DOWN" : "FLAT";

  return { points, average, trend };
}
```

- [ ] **Step 4: Test ausführen (passes)**

Run: `npm test -- velocity`
Expected: PASS, 6 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add src/lib/metrics/velocity.ts src/lib/metrics/velocity.test.ts
git commit -m "feat: add velocity trend metric"
```

---

## Task 7: Arbeitstage-Helfer

**Files:**
- Create: `src/lib/metrics/workingDays.ts`, `src/lib/metrics/workingDays.test.ts`

- [ ] **Step 1: Failing test schreiben**

Create `src/lib/metrics/workingDays.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { workingDaysBetween } from "./workingDays";

describe("workingDaysBetween", () => {
  it("counts inclusive weekdays Mon-Fri", () => {
    // Mo 2026-05-18 .. Fr 2026-05-22 = 5 Arbeitstage
    const days = workingDaysBetween(new Date("2026-05-18"), new Date("2026-05-22"));
    expect(days.length).toBe(5);
  });

  it("excludes weekends", () => {
    // Fr 2026-05-22 .. Mo 2026-05-25 -> Fr, Mo = 2 Arbeitstage
    const days = workingDaysBetween(new Date("2026-05-22"), new Date("2026-05-25"));
    expect(days.length).toBe(2);
  });

  it("returns a single day when start equals end on a weekday", () => {
    const days = workingDaysBetween(new Date("2026-05-20"), new Date("2026-05-20"));
    expect(days.length).toBe(1);
  });

  it("returns empty array when end is before start", () => {
    const days = workingDaysBetween(new Date("2026-05-22"), new Date("2026-05-18"));
    expect(days).toEqual([]);
  });
});
```

- [ ] **Step 2: Test ausführen (fails)**

Run: `npm test -- workingDays`
Expected: FAIL — „Cannot find module './workingDays'".

- [ ] **Step 3: Implementierung schreiben**

Create `src/lib/metrics/workingDays.ts`:

```ts
/** Liste der Arbeitstage (Mo–Fr) inklusive Start und Ende, normalisiert auf Mitternacht UTC. */
export function workingDaysBetween(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

  while (cursor.getTime() <= last.getTime()) {
    const dow = cursor.getUTCDay(); // 0 = So, 6 = Sa
    if (dow !== 0 && dow !== 6) {
      days.push(new Date(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}
```

- [ ] **Step 4: Test ausführen (passes)**

Run: `npm test -- workingDays`
Expected: PASS, 4 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add src/lib/metrics/workingDays.ts src/lib/metrics/workingDays.test.ts
git commit -m "feat: add working-days helper"
```

---

## Task 8: Burndown-Berechnung

**Files:**
- Create: `src/lib/metrics/burndown.ts`, `src/lib/metrics/burndown.test.ts`

- [ ] **Step 1: Failing test schreiben**

Create `src/lib/metrics/burndown.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { calcBurndown } from "./burndown";
import type { DomainSprint, DomainBurndownPoint } from "@/lib/domain/types";

function sprint(committed: number, start: string, end: string): DomainSprint {
  return {
    id: "s1", name: "Sprint 1", state: "ACTIVE",
    startDate: new Date(start), endDate: new Date(end), completeDate: null,
    committedPoints: committed, completedPoints: 0,
  };
}

describe("calcBurndown", () => {
  it("builds an ideal line from committed points to zero over working days", () => {
    // Mo..Fr = 5 Arbeitstage -> 4 Schritte
    const result = calcBurndown(sprint(40, "2026-05-18", "2026-05-22"), []);
    expect(result.ideal.length).toBe(5);
    expect(result.ideal[0].remainingPoints).toBe(40);
    expect(result.ideal[4].remainingPoints).toBe(0);
    expect(result.ideal[2].remainingPoints).toBe(20); // Mitte
  });

  it("passes actual points through sorted by date", () => {
    const points: DomainBurndownPoint[] = [
      { date: new Date("2026-05-19"), remainingPoints: 30, completedPoints: 10 },
      { date: new Date("2026-05-18"), remainingPoints: 40, completedPoints: 0 },
    ];
    const result = calcBurndown(sprint(40, "2026-05-18", "2026-05-22"), points);
    expect(result.actual.map((p) => p.remainingPoints)).toEqual([40, 30]);
  });

  it("returns empty lines when sprint has no dates", () => {
    const s = sprint(40, "2026-05-18", "2026-05-22");
    s.startDate = null;
    const result = calcBurndown(s, []);
    expect(result.ideal).toEqual([]);
    expect(result.actual).toEqual([]);
  });

  it("handles a single-day sprint without dividing by zero", () => {
    const result = calcBurndown(sprint(40, "2026-05-20", "2026-05-20"), []);
    expect(result.ideal.length).toBe(1);
    expect(result.ideal[0].remainingPoints).toBe(0);
  });
});
```

- [ ] **Step 2: Test ausführen (fails)**

Run: `npm test -- burndown`
Expected: FAIL — „Cannot find module './burndown'".

- [ ] **Step 3: Implementierung schreiben**

Create `src/lib/metrics/burndown.ts`:

```ts
import type { DomainSprint, DomainBurndownPoint } from "@/lib/domain/types";
import { workingDaysBetween } from "./workingDays";

export interface BurndownLinePoint {
  date: Date;
  remainingPoints: number;
}

export interface Burndown {
  ideal: BurndownLinePoint[];
  actual: BurndownLinePoint[];
}

/**
 * Burndown-Daten: Ideallinie (linear committed -> 0 über die Arbeitstage des Sprints)
 * und Ist-Linie aus den gespeicherten BurndownPoints (nach Datum sortiert).
 */
export function calcBurndown(
  sprint: DomainSprint,
  points: DomainBurndownPoint[],
): Burndown {
  if (!sprint.startDate || !sprint.endDate) {
    return { ideal: [], actual: [] };
  }

  const days = workingDaysBetween(sprint.startDate, sprint.endDate);
  const steps = Math.max(1, days.length - 1);
  const ideal: BurndownLinePoint[] = days.map((date, i) => ({
    date,
    remainingPoints: Math.max(0, sprint.committedPoints * (1 - i / steps)),
  }));

  const actual: BurndownLinePoint[] = [...points]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((p) => ({ date: p.date, remainingPoints: p.remainingPoints }));

  return { ideal, actual };
}
```

- [ ] **Step 4: Test ausführen (passes)**

Run: `npm test -- burndown`
Expected: PASS, 4 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add src/lib/metrics/burndown.ts src/lib/metrics/burndown.test.ts
git commit -m "feat: add burndown metric"
```

---

## Task 9: Kapazität & Effizienz

**Files:**
- Create: `src/lib/metrics/capacity.ts`, `src/lib/metrics/capacity.test.ts`

- [ ] **Step 1: Failing test schreiben**

Create `src/lib/metrics/capacity.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { calcCapacityEfficiency } from "./capacity";
import type { DomainSprint, DomainCapacityEntry } from "@/lib/domain/types";

function sprint(completed: number): DomainSprint {
  return {
    id: "s1", name: "Sprint 1", state: "CLOSED",
    startDate: null, endDate: null, completeDate: null,
    committedPoints: 0, completedPoints: completed,
  };
}

const entries: DomainCapacityEntry[] = [
  { name: "Alice", personDays: 8 },
  { name: "Bob", personDays: 8 },
];

describe("calcCapacityEfficiency", () => {
  it("sums person days", () => {
    const result = calcCapacityEfficiency(sprint(32), entries);
    expect(result.totalPersonDays).toBe(16);
  });

  it("computes story points per person day", () => {
    const result = calcCapacityEfficiency(sprint(32), entries);
    expect(result.efficiency).toBe(2); // 32 / 16
  });

  it("returns 0 efficiency when there is no capacity (no divide-by-zero)", () => {
    const result = calcCapacityEfficiency(sprint(32), []);
    expect(result.totalPersonDays).toBe(0);
    expect(result.efficiency).toBe(0);
  });
});
```

- [ ] **Step 2: Test ausführen (fails)**

Run: `npm test -- capacity`
Expected: FAIL — „Cannot find module './capacity'".

- [ ] **Step 3: Implementierung schreiben**

Create `src/lib/metrics/capacity.ts`:

```ts
import type { DomainSprint, DomainCapacityEntry } from "@/lib/domain/types";

export interface CapacityResult {
  totalPersonDays: number;
  efficiency: number; // Story Points pro Personentag
}

/** Gesamtkapazität (Summe Personentage) und Effizienz (completedPoints / Personentage). */
export function calcCapacityEfficiency(
  sprint: DomainSprint,
  entries: DomainCapacityEntry[],
): CapacityResult {
  const totalPersonDays = entries.reduce((sum, e) => sum + e.personDays, 0);
  const efficiency = totalPersonDays === 0 ? 0 : sprint.completedPoints / totalPersonDays;
  return { totalPersonDays, efficiency };
}
```

- [ ] **Step 4: Test ausführen (passes)**

Run: `npm test -- capacity`
Expected: PASS, 3 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add src/lib/metrics/capacity.ts src/lib/metrics/capacity.test.ts
git commit -m "feat: add capacity efficiency metric"
```

---

## Task 10: Team-Repository

**Files:**
- Create: `src/lib/repositories/teamRepository.ts`, `src/lib/repositories/teamRepository.test.ts`

> **Hinweis:** Repository-Tests laufen gegen die per `docker compose up -d postgres` gestartete DB
> und der angewendeten Migration aus Task 3. Jeder Test räumt sein Team am Ende wieder ab.

- [ ] **Step 1: Failing test schreiben**

Create `src/lib/repositories/teamRepository.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { createTeam, listTeams, getTeam } from "./teamRepository";

const created: string[] = [];

afterEach(async () => {
  if (created.length) {
    await prisma.team.deleteMany({ where: { id: { in: created } } });
    created.length = 0;
  }
});

describe("teamRepository", () => {
  it("creates and reads a team", async () => {
    const team = await createTeam({ name: "Alpha", jiraBoardId: "42" });
    created.push(team.id);

    expect(team.name).toBe("Alpha");
    expect(team.jiraBoardId).toBe("42");
    expect(team.syncIntervalMinutes).toBe(60);

    const fetched = await getTeam(team.id);
    expect(fetched?.name).toBe("Alpha");
  });

  it("lists created teams", async () => {
    const team = await createTeam({ name: "Beta", jiraBoardId: "7" });
    created.push(team.id);

    const all = await listTeams();
    expect(all.some((t) => t.id === team.id)).toBe(true);
  });
});
```

- [ ] **Step 2: Test ausführen (fails)**

Run: `npm test -- teamRepository`
Expected: FAIL — „Cannot find module './teamRepository'".

- [ ] **Step 3: Implementierung schreiben**

Create `src/lib/repositories/teamRepository.ts`:

```ts
import { prisma } from "@/lib/db";
import type { Team } from "@prisma/client";

export interface CreateTeamInput {
  name: string;
  jiraBoardId: string;
  syncIntervalMinutes?: number;
}

export function createTeam(input: CreateTeamInput): Promise<Team> {
  return prisma.team.create({
    data: {
      name: input.name,
      jiraBoardId: input.jiraBoardId,
      syncIntervalMinutes: input.syncIntervalMinutes ?? 60,
    },
  });
}

export function listTeams(): Promise<Team[]> {
  return prisma.team.findMany({ orderBy: { name: "asc" } });
}

export function getTeam(id: string): Promise<Team | null> {
  return prisma.team.findUnique({ where: { id } });
}
```

- [ ] **Step 4: Test ausführen (passes)**

Run: `npm test -- teamRepository`
Expected: PASS, 2 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add src/lib/repositories/teamRepository.ts src/lib/repositories/teamRepository.test.ts
git commit -m "feat: add team repository"
```

---

## Task 11: Sprint-Repository (idempotenter Upsert)

**Files:**
- Create: `src/lib/repositories/sprintRepository.ts`, `src/lib/repositories/sprintRepository.test.ts`

- [ ] **Step 1: Failing test schreiben**

Create `src/lib/repositories/sprintRepository.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { createTeam } from "./teamRepository";
import { upsertSprint, listSprintsForTeam } from "./sprintRepository";

const teams: string[] = [];

afterEach(async () => {
  if (teams.length) {
    await prisma.team.deleteMany({ where: { id: { in: teams } } });
    teams.length = 0;
  }
});

describe("sprintRepository", () => {
  it("creates a sprint on first upsert", async () => {
    const team = await createTeam({ name: "Alpha", jiraBoardId: "42" });
    teams.push(team.id);

    const sprint = await upsertSprint(team.id, {
      jiraSprintId: "100", name: "Sprint 1", state: "ACTIVE",
      startDate: null, endDate: null, completeDate: null,
      committedPoints: 40, completedPoints: 0,
    });

    expect(sprint.name).toBe("Sprint 1");
    expect(sprint.committedPoints).toBe(40);
  });

  it("updates the same sprint on second upsert (idempotent by jiraSprintId)", async () => {
    const team = await createTeam({ name: "Alpha", jiraBoardId: "42" });
    teams.push(team.id);

    const first = await upsertSprint(team.id, {
      jiraSprintId: "100", name: "Sprint 1", state: "ACTIVE",
      startDate: null, endDate: null, completeDate: null,
      committedPoints: 40, completedPoints: 0,
    });
    const second = await upsertSprint(team.id, {
      jiraSprintId: "100", name: "Sprint 1", state: "CLOSED",
      startDate: null, endDate: null, completeDate: null,
      committedPoints: 40, completedPoints: 34,
    });

    expect(second.id).toBe(first.id);
    expect(second.state).toBe("CLOSED");
    expect(second.completedPoints).toBe(34);

    const all = await listSprintsForTeam(team.id);
    expect(all.length).toBe(1);
  });
});
```

- [ ] **Step 2: Test ausführen (fails)**

Run: `npm test -- sprintRepository`
Expected: FAIL — „Cannot find module './sprintRepository'".

- [ ] **Step 3: Implementierung schreiben**

Create `src/lib/repositories/sprintRepository.ts`:

```ts
import { prisma } from "@/lib/db";
import type { Sprint, SprintState } from "@prisma/client";

export interface UpsertSprintInput {
  jiraSprintId: string;
  name: string;
  state: SprintState;
  startDate: Date | null;
  endDate: Date | null;
  completeDate: Date | null;
  committedPoints: number;
  completedPoints: number;
}

/** Legt einen Sprint an oder aktualisiert ihn anhand (teamId, jiraSprintId). */
export function upsertSprint(teamId: string, input: UpsertSprintInput): Promise<Sprint> {
  return prisma.sprint.upsert({
    where: { teamId_jiraSprintId: { teamId, jiraSprintId: input.jiraSprintId } },
    create: { teamId, ...input },
    update: {
      name: input.name,
      state: input.state,
      startDate: input.startDate,
      endDate: input.endDate,
      completeDate: input.completeDate,
      committedPoints: input.committedPoints,
      completedPoints: input.completedPoints,
    },
  });
}

export function listSprintsForTeam(teamId: string): Promise<Sprint[]> {
  return prisma.sprint.findMany({
    where: { teamId },
    orderBy: { startDate: "asc" },
  });
}
```

- [ ] **Step 4: Test ausführen (passes)**

Run: `npm test -- sprintRepository`
Expected: PASS, 2 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add src/lib/repositories/sprintRepository.ts src/lib/repositories/sprintRepository.test.ts
git commit -m "feat: add sprint repository with idempotent upsert"
```

---

## Task 12: Kapazitäts-Repository

**Files:**
- Create: `src/lib/repositories/capacityRepository.ts`, `src/lib/repositories/capacityRepository.test.ts`

- [ ] **Step 1: Failing test schreiben**

Create `src/lib/repositories/capacityRepository.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { createTeam } from "./teamRepository";
import { upsertSprint } from "./sprintRepository";
import { setCapacityEntry, listCapacityForSprint } from "./capacityRepository";

const teams: string[] = [];

afterEach(async () => {
  if (teams.length) {
    await prisma.team.deleteMany({ where: { id: { in: teams } } });
    teams.length = 0;
  }
});

async function makeSprint() {
  const team = await createTeam({ name: "Alpha", jiraBoardId: "42" });
  teams.push(team.id);
  const sprint = await upsertSprint(team.id, {
    jiraSprintId: "100", name: "Sprint 1", state: "ACTIVE",
    startDate: null, endDate: null, completeDate: null,
    committedPoints: 0, completedPoints: 0,
  });
  return sprint.id;
}

describe("capacityRepository", () => {
  it("adds capacity entries for a sprint", async () => {
    const sprintId = await makeSprint();
    await setCapacityEntry(sprintId, { name: "Alice", personDays: 8 });
    await setCapacityEntry(sprintId, { name: "Bob", personDays: 6 });

    const entries = await listCapacityForSprint(sprintId);
    expect(entries.length).toBe(2);
    expect(entries.reduce((s, e) => s + e.personDays, 0)).toBe(14);
  });
});
```

- [ ] **Step 2: Test ausführen (fails)**

Run: `npm test -- capacityRepository`
Expected: FAIL — „Cannot find module './capacityRepository'".

- [ ] **Step 3: Implementierung schreiben**

Create `src/lib/repositories/capacityRepository.ts`:

```ts
import { prisma } from "@/lib/db";
import type { CapacityEntry } from "@prisma/client";

export interface CapacityEntryInput {
  name: string;
  personDays: number;
  teamMemberId?: string | null;
}

export function setCapacityEntry(
  sprintId: string,
  input: CapacityEntryInput,
): Promise<CapacityEntry> {
  return prisma.capacityEntry.create({
    data: {
      sprintId,
      name: input.name,
      personDays: input.personDays,
      teamMemberId: input.teamMemberId ?? null,
    },
  });
}

export function listCapacityForSprint(sprintId: string): Promise<CapacityEntry[]> {
  return prisma.capacityEntry.findMany({
    where: { sprintId },
    orderBy: { name: "asc" },
  });
}
```

- [ ] **Step 4: Test ausführen (passes)**

Run: `npm test -- capacityRepository`
Expected: PASS, 1 Test grün.

- [ ] **Step 5: Commit**

```bash
git add src/lib/repositories/capacityRepository.ts src/lib/repositories/capacityRepository.test.ts
git commit -m "feat: add capacity repository"
```

---

## Task 13: Gesamtlauf & Phase-Abschluss

- [ ] **Step 1: Komplette Test-Suite ausführen**

Run: `npm test`
Expected: Alle Tests grün (sanity, carryOver, velocity, workingDays, burndown, capacity, teamRepository, sprintRepository, capacityRepository).

- [ ] **Step 2: Typprüfung & Build**

Run: `npx tsc --noEmit && npm run build`
Expected: keine Typfehler, Build erfolgreich.

- [ ] **Step 3: Abschluss-Commit (falls noch ungetrackte Änderungen)**

```bash
git add -A
git commit -m "chore: complete phase 1 foundation and domain core" || echo "nichts zu committen"
```

---

## Self-Review (vom Plan-Autor durchgeführt)

**Spec-Abdeckung:**
- Datenmodell (Spec §4) → Task 3 (komplettes Prisma-Schema).
- Domänentypen entkoppelt (Spec §3) → Task 4.
- Velocity / Carry-over / Burndown / Kapazität (Spec §5) → Tasks 5, 6, 8, 9 (+ Helfer Task 7).
- Repositories als einzige DB-Zugriffsstelle, idempotenter Upsert (Spec §3, §7) → Tasks 10–12.
- Postgres via Docker, Env-Konfiguration (Spec §9) → Task 3.
- TDD, Schwerpunkt Domain-Schicht (Spec §8) → durchgehend Test-zuerst.
- *Nicht in dieser Phase (Folgepläne):* Jira-Adapter & Sync (Phase 2), UI/Charts/Seiten & API-Routen (Phase 3). Bewusst ausgeklammert, da eigene Pläne.

**Platzhalter-Scan:** Keine TBD/TODO; jeder Code-Step enthält vollständigen Code und konkrete Befehle mit erwarteter Ausgabe.

**Typkonsistenz:** `DomainSprint`/`DomainIssue`/`DomainCapacityEntry`/`DomainBurndownPoint` (Task 4) werden in den Metrik-Tasks unverändert verwendet. Repository-Funktionsnamen (`createTeam`, `upsertSprint`, `listSprintsForTeam`, `setCapacityEntry`, `listCapacityForSprint`) sind über Tasks hinweg konsistent. Prisma-Composite-Key `teamId_jiraSprintId` entspricht `@@unique([teamId, jiraSprintId])` aus dem Schema.
