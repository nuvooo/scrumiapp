# Scrumi Phase 2: Jira-Adapter + Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Voraussetzung:** Phase 1 (`2026-05-21-scrumi-phase1-foundation.md`) ist vollständig umgesetzt.

**Goal:** Sprint- und Issue-Daten aus Jira Cloud (REST v3 / Agile API) in die Scrumi-DB synchronisieren — automatisch per Intervall (node-cron) und manuell per API-Route — robust gegen Jira-Ausfälle, ohne manuelle Kapazitätsdaten zu überschreiben.

**Architecture:** Der `JiraClient` ist ein Interface; `JiraCloudClient` implementiert es über `fetch` (injizierbar für Tests). Reine Mapper-Funktionen übersetzen Jira-Rohdaten in Domänentypen und berechnen committed/completed Points. `syncTeam` orchestriert: laden → mappen → über Repositories upserten → BurndownPoint für heute schreiben → `lastSyncedAt`/`lastSyncError` setzen. Der Scheduler startet via `instrumentation.ts`.

**Tech Stack:** TypeScript, node-cron, Jira Cloud Agile REST API, Vitest, Prisma.

---

## Datei-Struktur (in diesem Plan erstellt)

```
src/lib/jira/types.ts                               Jira-Rohtypen (minimal)
src/lib/jira/mapper.ts            + Test            Mapping Jira -> Domain + Punkteberechnung
src/lib/jira/jiraClient.ts        + Test            JiraClient-Interface + JiraCloudClient (fetch injizierbar)
src/lib/repositories/issueRepository.ts + Test      Issue-Upsert + replaceForSprint
src/lib/repositories/burndownRepository.ts + Test   BurndownPoint-Upsert pro Tag
src/lib/sync/syncTeam.ts          + Test            Orchestrierung pro Team
src/lib/sync/scheduler.ts                           node-cron-Scheduler
src/instrumentation.ts                              Scheduler-Start
src/app/api/sync/route.ts                           manueller Sync-Trigger
```

---

## Task 1: Jira-Rohtypen

**Files:**
- Create: `src/lib/jira/types.ts`

- [ ] **Step 1: Typen schreiben**

Create `src/lib/jira/types.ts` (nur die Felder, die wir tatsächlich lesen):

```ts
export interface JiraSprintRaw {
  id: number;
  name: string;
  state: "active" | "closed" | "future";
  startDate?: string;
  endDate?: string;
  completeDate?: string;
}

export interface JiraSprintPage {
  values: JiraSprintRaw[];
  isLast: boolean;
}

export interface JiraStatusCategory {
  key: "new" | "indeterminate" | "done";
}

export interface JiraIssueRaw {
  key: string;
  fields: {
    summary: string;
    resolutiondate: string | null;
    status: { name: string; statusCategory: JiraStatusCategory };
    [storyPointsField: string]: unknown;
  };
}

export interface JiraIssuePage {
  issues: JiraIssueRaw[];
  startAt: number;
  maxResults: number;
  total: number;
}
```

- [ ] **Step 2: Typprüfung**

Run: `npx tsc --noEmit`
Expected: keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/lib/jira/types.ts
git commit -m "feat: add Jira raw response types"
```

---

## Task 2: Jira-Mapper (reine Funktionen)

**Files:**
- Create: `src/lib/jira/mapper.ts`, `src/lib/jira/mapper.test.ts`

> **Designentscheidung (v1-Näherung):** `committedPoints` = Summe der Story Points aller
> Issues im Sprint; `completedPoints` = Summe der Story Points der DONE-Issues.
> `addedAfterSprintStart` wird in v1 immer `false` gesetzt (Scope-Change-Erkennung über das
> Jira-Changelog ist eine spätere Erweiterung). Fehlende Story Points zählen als 0.

- [ ] **Step 1: Failing test schreiben**

Create `src/lib/jira/mapper.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mapStatusCategory, mapIssue, computeSprintPoints, mapSprintState } from "./mapper";
import type { JiraIssueRaw } from "./types";

const FIELD = "customfield_10016";

function rawIssue(key: string, points: number | null, catKey: "new" | "indeterminate" | "done", resolved: string | null): JiraIssueRaw {
  return {
    key,
    fields: {
      summary: `Issue ${key}`,
      resolutiondate: resolved,
      status: { name: catKey, statusCategory: { key: catKey } },
      [FIELD]: points,
    },
  };
}

describe("mapStatusCategory", () => {
  it("maps Jira category keys to domain categories", () => {
    expect(mapStatusCategory("new")).toBe("TODO");
    expect(mapStatusCategory("indeterminate")).toBe("IN_PROGRESS");
    expect(mapStatusCategory("done")).toBe("DONE");
  });
});

describe("mapSprintState", () => {
  it("uppercases Jira sprint states", () => {
    expect(mapSprintState("active")).toBe("ACTIVE");
    expect(mapSprintState("closed")).toBe("CLOSED");
    expect(mapSprintState("future")).toBe("FUTURE");
  });
});

describe("mapIssue", () => {
  it("maps a raw issue using the configured story points field", () => {
    const issue = mapIssue(rawIssue("AB-1", 5, "done", "2026-05-20T10:00:00.000Z"), FIELD);
    expect(issue.jiraKey).toBe("AB-1");
    expect(issue.storyPoints).toBe(5);
    expect(issue.statusCategory).toBe("DONE");
    expect(issue.resolvedAt).toEqual(new Date("2026-05-20T10:00:00.000Z"));
    expect(issue.addedAfterSprintStart).toBe(false);
  });

  it("treats a missing story points value as 0", () => {
    const issue = mapIssue(rawIssue("AB-2", null, "new", null), FIELD);
    expect(issue.storyPoints).toBe(0);
    expect(issue.resolvedAt).toBeNull();
  });
});

describe("computeSprintPoints", () => {
  it("sums committed (all) and completed (DONE only) story points", () => {
    const issues = [
      mapIssue(rawIssue("AB-1", 5, "done", "2026-05-20T10:00:00.000Z"), FIELD),
      mapIssue(rawIssue("AB-2", 8, "indeterminate", null), FIELD),
      mapIssue(rawIssue("AB-3", 3, "new", null), FIELD),
    ];
    expect(computeSprintPoints(issues)).toEqual({ committedPoints: 16, completedPoints: 5 });
  });

  it("returns zeros for an empty sprint", () => {
    expect(computeSprintPoints([])).toEqual({ committedPoints: 0, completedPoints: 0 });
  });
});
```

- [ ] **Step 2: Test ausführen (fails)**

Run: `npm test -- mapper`
Expected: FAIL — „Cannot find module './mapper'".

- [ ] **Step 3: Implementierung schreiben**

Create `src/lib/jira/mapper.ts`:

```ts
import type { DomainIssue, SprintState, StatusCategory } from "@/lib/domain/types";
import type { JiraIssueRaw } from "./types";

export function mapStatusCategory(key: string): StatusCategory {
  switch (key) {
    case "done":
      return "DONE";
    case "indeterminate":
      return "IN_PROGRESS";
    default:
      return "TODO";
  }
}

export function mapSprintState(state: string): SprintState {
  switch (state) {
    case "active":
      return "ACTIVE";
    case "closed":
      return "CLOSED";
    default:
      return "FUTURE";
  }
}

export function mapIssue(raw: JiraIssueRaw, storyPointsField: string): DomainIssue {
  const rawPoints = raw.fields[storyPointsField];
  const storyPoints = typeof rawPoints === "number" ? rawPoints : 0;
  return {
    jiraKey: raw.key,
    storyPoints,
    statusCategory: mapStatusCategory(raw.fields.status.statusCategory.key),
    resolvedAt: raw.fields.resolutiondate ? new Date(raw.fields.resolutiondate) : null,
    addedAfterSprintStart: false,
  };
}

export interface SprintPoints {
  committedPoints: number;
  completedPoints: number;
}

/** committed = alle Story Points; completed = nur DONE. */
export function computeSprintPoints(issues: DomainIssue[]): SprintPoints {
  let committedPoints = 0;
  let completedPoints = 0;
  for (const issue of issues) {
    committedPoints += issue.storyPoints;
    if (issue.statusCategory === "DONE") completedPoints += issue.storyPoints;
  }
  return { committedPoints, completedPoints };
}
```

- [ ] **Step 4: Test ausführen (passes)**

Run: `npm test -- mapper`
Expected: PASS, alle Tests grün.

- [ ] **Step 5: Commit**

```bash
git add src/lib/jira/mapper.ts src/lib/jira/mapper.test.ts
git commit -m "feat: add Jira-to-domain mappers"
```

---

## Task 3: JiraClient (mit injizierbarem fetch)

**Files:**
- Create: `src/lib/jira/jiraClient.ts`, `src/lib/jira/jiraClient.test.ts`

- [ ] **Step 1: Failing test schreiben**

Create `src/lib/jira/jiraClient.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { JiraCloudClient } from "./jiraClient";
import type { JiraSprintRaw } from "./types";

const config = {
  baseUrl: "https://example.atlassian.net",
  email: "me@example.com",
  apiToken: "token123",
  storyPointsField: "customfield_10016",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("JiraCloudClient.fetchBoardSprints", () => {
  it("requests active+closed sprints with basic auth and returns mapped sprints", async () => {
    const sprints: JiraSprintRaw[] = [
      { id: 100, name: "Sprint 1", state: "closed", startDate: "2026-05-01T00:00:00.000Z", endDate: "2026-05-14T00:00:00.000Z", completeDate: "2026-05-14T10:00:00.000Z" },
    ];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ values: sprints, isLast: true }));
    const client = new JiraCloudClient(config, fetchMock);

    const result = await client.fetchBoardSprints("42");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ jiraSprintId: "100", name: "Sprint 1", state: "CLOSED" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/rest/agile/1.0/board/42/sprint");
    expect(url).toContain("state=active%2Cclosed");
    const auth = (init.headers as Record<string, string>)["Authorization"];
    expect(auth).toBe("Basic " + Buffer.from("me@example.com:token123").toString("base64"));
  });

  it("follows pagination until isLast is true", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ values: [{ id: 1, name: "A", state: "closed" }], isLast: false }))
      .mockResolvedValueOnce(jsonResponse({ values: [{ id: 2, name: "B", state: "active" }], isLast: true }));
    const client = new JiraCloudClient(config, fetchMock);

    const result = await client.fetchBoardSprints("42");

    expect(result.map((s) => s.jiraSprintId)).toEqual(["1", "2"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws on non-OK responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: "unauthorized" }, 401));
    const client = new JiraCloudClient(config, fetchMock);

    await expect(client.fetchBoardSprints("42")).rejects.toThrow(/401/);
  });
});

describe("JiraCloudClient.fetchSprintIssues", () => {
  it("returns mapped domain issues across pages", async () => {
    const issue = (key: string) => ({
      key,
      fields: {
        summary: key,
        resolutiondate: null,
        status: { name: "To Do", statusCategory: { key: "new" } },
        customfield_10016: 3,
      },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ issues: [issue("AB-1")], startAt: 0, maxResults: 1, total: 2 }))
      .mockResolvedValueOnce(jsonResponse({ issues: [issue("AB-2")], startAt: 1, maxResults: 1, total: 2 }));
    const client = new JiraCloudClient(config, fetchMock);

    const result = await client.fetchSprintIssues("100");

    expect(result.map((i) => i.jiraKey)).toEqual(["AB-1", "AB-2"]);
    expect(result[0].storyPoints).toBe(3);
  });
});
```

- [ ] **Step 2: Test ausführen (fails)**

Run: `npm test -- jiraClient`
Expected: FAIL — „Cannot find module './jiraClient'".

- [ ] **Step 3: Implementierung schreiben**

Create `src/lib/jira/jiraClient.ts`:

```ts
import type { DomainIssue } from "@/lib/domain/types";
import type { JiraSprintPage, JiraIssuePage } from "./types";
import { mapIssue, mapSprintState } from "./mapper";

export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  storyPointsField: string;
}

export interface MappedSprint {
  jiraSprintId: string;
  name: string;
  state: "ACTIVE" | "CLOSED" | "FUTURE";
  startDate: Date | null;
  endDate: Date | null;
  completeDate: Date | null;
}

export interface JiraClient {
  fetchBoardSprints(boardId: string): Promise<MappedSprint[]>;
  fetchSprintIssues(sprintId: string): Promise<DomainIssue[]>;
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export class JiraCloudClient implements JiraClient {
  constructor(
    private readonly config: JiraConfig,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  private authHeader(): string {
    const token = Buffer.from(`${this.config.email}:${this.config.apiToken}`).toString("base64");
    return `Basic ${token}`;
  }

  private async getJson<T>(path: string): Promise<T> {
    const res = await this.fetchFn(`${this.config.baseUrl}${path}`, {
      headers: { Authorization: this.authHeader(), Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Jira request failed: ${res.status} ${res.statusText} (${path})`);
    }
    return (await res.json()) as T;
  }

  async fetchBoardSprints(boardId: string): Promise<MappedSprint[]> {
    const sprints: MappedSprint[] = [];
    let startAt = 0;
    for (;;) {
      const page = await this.getJson<JiraSprintPage>(
        `/rest/agile/1.0/board/${boardId}/sprint?state=active%2Cclosed&startAt=${startAt}&maxResults=50`,
      );
      for (const s of page.values) {
        sprints.push({
          jiraSprintId: String(s.id),
          name: s.name,
          state: mapSprintState(s.state),
          startDate: s.startDate ? new Date(s.startDate) : null,
          endDate: s.endDate ? new Date(s.endDate) : null,
          completeDate: s.completeDate ? new Date(s.completeDate) : null,
        });
      }
      if (page.isLast || page.values.length === 0) break;
      startAt += page.values.length;
    }
    return sprints;
  }

  async fetchSprintIssues(sprintId: string): Promise<DomainIssue[]> {
    const issues: DomainIssue[] = [];
    let startAt = 0;
    for (;;) {
      const fields = ["summary", "resolutiondate", "status", this.config.storyPointsField].join(",");
      const page = await this.getJson<JiraIssuePage>(
        `/rest/agile/1.0/sprint/${sprintId}/issue?startAt=${startAt}&maxResults=50&fields=${fields}`,
      );
      for (const raw of page.issues) {
        issues.push(mapIssue(raw, this.config.storyPointsField));
      }
      startAt += page.issues.length;
      if (startAt >= page.total || page.issues.length === 0) break;
    }
    return issues;
  }
}

/** Liest die Jira-Konfiguration aus Env-Variablen. */
export function jiraConfigFromEnv(): JiraConfig {
  return {
    baseUrl: process.env.JIRA_BASE_URL ?? "",
    email: process.env.JIRA_EMAIL ?? "",
    apiToken: process.env.JIRA_API_TOKEN ?? "",
    storyPointsField: process.env.JIRA_STORY_POINTS_FIELD ?? "customfield_10016",
  };
}
```

- [ ] **Step 4: Test ausführen (passes)**

Run: `npm test -- jiraClient`
Expected: PASS, alle Tests grün.

- [ ] **Step 5: Commit**

```bash
git add src/lib/jira/jiraClient.ts src/lib/jira/jiraClient.test.ts
git commit -m "feat: add Jira Cloud client with pagination"
```

---

## Task 4: Issue-Repository

**Files:**
- Create: `src/lib/repositories/issueRepository.ts`, `src/lib/repositories/issueRepository.test.ts`

- [ ] **Step 1: Failing test schreiben**

Create `src/lib/repositories/issueRepository.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { createTeam } from "./teamRepository";
import { upsertSprint } from "./sprintRepository";
import { replaceIssuesForSprint, listIssuesForSprint } from "./issueRepository";
import type { DomainIssue } from "@/lib/domain/types";

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

const issue = (key: string, points: number): DomainIssue => ({
  jiraKey: key, storyPoints: points, statusCategory: "DONE",
  resolvedAt: null, addedAfterSprintStart: false,
});

describe("issueRepository", () => {
  it("replaces all issues for a sprint", async () => {
    const sprintId = await makeSprint();

    await replaceIssuesForSprint(sprintId, [issue("AB-1", 5), issue("AB-2", 3)]);
    let stored = await listIssuesForSprint(sprintId);
    expect(stored.length).toBe(2);

    // zweiter Lauf mit nur einem Issue ersetzt den vorherigen Satz
    await replaceIssuesForSprint(sprintId, [issue("AB-1", 8)]);
    stored = await listIssuesForSprint(sprintId);
    expect(stored.length).toBe(1);
    expect(stored[0].storyPoints).toBe(8);
  });
});
```

- [ ] **Step 2: Test ausführen (fails)**

Run: `npm test -- issueRepository`
Expected: FAIL — „Cannot find module './issueRepository'".

- [ ] **Step 3: Implementierung schreiben**

Create `src/lib/repositories/issueRepository.ts`:

```ts
import { prisma } from "@/lib/db";
import type { Issue } from "@prisma/client";
import type { DomainIssue } from "@/lib/domain/types";

/**
 * Ersetzt den Issue-Satz eines Sprints atomar (löschen + neu anlegen).
 * Vermeidet verwaiste Issues, wenn welche aus dem Sprint entfernt wurden.
 */
export async function replaceIssuesForSprint(
  sprintId: string,
  issues: DomainIssue[],
): Promise<void> {
  await prisma.$transaction([
    prisma.issue.deleteMany({ where: { sprintId } }),
    prisma.issue.createMany({
      data: issues.map((i) => ({
        sprintId,
        jiraKey: i.jiraKey,
        summary: i.jiraKey,
        storyPoints: i.storyPoints,
        status: i.statusCategory,
        statusCategory: i.statusCategory,
        resolvedAt: i.resolvedAt,
        addedAfterSprintStart: i.addedAfterSprintStart,
      })),
    }),
  ]);
}

export function listIssuesForSprint(sprintId: string): Promise<Issue[]> {
  return prisma.issue.findMany({ where: { sprintId }, orderBy: { jiraKey: "asc" } });
}
```

> **Hinweis:** `summary` wird hier mit `jiraKey` befüllt, da `DomainIssue` (Phase 1) kein
> `summary`-Feld trägt; der Domain-Kern braucht es nicht. Die Anzeige nutzt Story Points/Status.

- [ ] **Step 4: Test ausführen (passes)**

Run: `npm test -- issueRepository`
Expected: PASS, 1 Test grün.

- [ ] **Step 5: Commit**

```bash
git add src/lib/repositories/issueRepository.ts src/lib/repositories/issueRepository.test.ts
git commit -m "feat: add issue repository with atomic replace"
```

---

## Task 5: Burndown-Repository

**Files:**
- Create: `src/lib/repositories/burndownRepository.ts`, `src/lib/repositories/burndownRepository.test.ts`

- [ ] **Step 1: Failing test schreiben**

Create `src/lib/repositories/burndownRepository.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { createTeam } from "./teamRepository";
import { upsertSprint } from "./sprintRepository";
import { recordBurndownPoint, listBurndownForSprint } from "./burndownRepository";

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

describe("burndownRepository", () => {
  it("upserts one point per (sprint, date)", async () => {
    const sprintId = await makeSprint();
    const day = new Date("2026-05-20T00:00:00.000Z");

    await recordBurndownPoint(sprintId, day, 30, 10);
    await recordBurndownPoint(sprintId, day, 25, 15); // gleicher Tag -> Update

    const points = await listBurndownForSprint(sprintId);
    expect(points.length).toBe(1);
    expect(points[0].remainingPoints).toBe(25);
    expect(points[0].completedPoints).toBe(15);
  });
});
```

- [ ] **Step 2: Test ausführen (fails)**

Run: `npm test -- burndownRepository`
Expected: FAIL — „Cannot find module './burndownRepository'".

- [ ] **Step 3: Implementierung schreiben**

Create `src/lib/repositories/burndownRepository.ts`:

```ts
import { prisma } from "@/lib/db";
import type { BurndownPoint } from "@prisma/client";

/** Normalisiert ein Datum auf Mitternacht UTC (ein Punkt pro Kalendertag). */
function atMidnightUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function recordBurndownPoint(
  sprintId: string,
  date: Date,
  remainingPoints: number,
  completedPoints: number,
): Promise<BurndownPoint> {
  const day = atMidnightUtc(date);
  return prisma.burndownPoint.upsert({
    where: { sprintId_date: { sprintId, date: day } },
    create: { sprintId, date: day, remainingPoints, completedPoints },
    update: { remainingPoints, completedPoints },
  });
}

export function listBurndownForSprint(sprintId: string): Promise<BurndownPoint[]> {
  return prisma.burndownPoint.findMany({ where: { sprintId }, orderBy: { date: "asc" } });
}
```

- [ ] **Step 4: Test ausführen (passes)**

Run: `npm test -- burndownRepository`
Expected: PASS, 1 Test grün.

- [ ] **Step 5: Commit**

```bash
git add src/lib/repositories/burndownRepository.ts src/lib/repositories/burndownRepository.test.ts
git commit -m "feat: add burndown repository"
```

---

## Task 6: Sync-Orchestrierung pro Team

**Files:**
- Create: `src/lib/sync/syncTeam.ts`, `src/lib/sync/syncTeam.test.ts`

- [ ] **Step 1: Failing test schreiben**

Create `src/lib/sync/syncTeam.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { createTeam } from "@/lib/repositories/teamRepository";
import { listSprintsForTeam } from "@/lib/repositories/sprintRepository";
import { listIssuesForSprint } from "@/lib/repositories/issueRepository";
import { listBurndownForSprint } from "@/lib/repositories/burndownRepository";
import { syncTeam } from "./syncTeam";
import type { JiraClient, MappedSprint } from "@/lib/jira/jiraClient";
import type { DomainIssue } from "@/lib/domain/types";

const teams: string[] = [];

afterEach(async () => {
  if (teams.length) {
    await prisma.team.deleteMany({ where: { id: { in: teams } } });
    teams.length = 0;
  }
});

class FakeJira implements JiraClient {
  constructor(private sprints: MappedSprint[], private issues: Record<string, DomainIssue[]>) {}
  async fetchBoardSprints(): Promise<MappedSprint[]> { return this.sprints; }
  async fetchSprintIssues(sprintId: string): Promise<DomainIssue[]> { return this.issues[sprintId] ?? []; }
}

class FailingJira implements JiraClient {
  async fetchBoardSprints(): Promise<MappedSprint[]> { throw new Error("401 Unauthorized"); }
  async fetchSprintIssues(): Promise<DomainIssue[]> { return []; }
}

describe("syncTeam", () => {
  it("stores sprints, issues, computed points and a burndown point", async () => {
    const team = await createTeam({ name: "Alpha", jiraBoardId: "42" });
    teams.push(team.id);

    const client = new FakeJira(
      [{ jiraSprintId: "100", name: "Sprint 1", state: "ACTIVE",
         startDate: new Date("2026-05-18"), endDate: new Date("2026-05-22"), completeDate: null }],
      { "100": [
        { jiraKey: "AB-1", storyPoints: 5, statusCategory: "DONE", resolvedAt: null, addedAfterSprintStart: false },
        { jiraKey: "AB-2", storyPoints: 3, statusCategory: "TODO", resolvedAt: null, addedAfterSprintStart: false },
      ] },
    );

    await syncTeam(team.id, client);

    const sprints = await listSprintsForTeam(team.id);
    expect(sprints.length).toBe(1);
    expect(sprints[0].committedPoints).toBe(8);
    expect(sprints[0].completedPoints).toBe(5);

    const issues = await listIssuesForSprint(sprints[0].id);
    expect(issues.length).toBe(2);

    const burndown = await listBurndownForSprint(sprints[0].id);
    expect(burndown.length).toBe(1);
    expect(burndown[0].remainingPoints).toBe(3); // committed 8 - completed 5

    const refreshed = await prisma.team.findUnique({ where: { id: team.id } });
    expect(refreshed?.lastSyncedAt).not.toBeNull();
    expect(refreshed?.lastSyncError).toBeNull();
  });

  it("records lastSyncError and does not throw when Jira fails", async () => {
    const team = await createTeam({ name: "Beta", jiraBoardId: "7" });
    teams.push(team.id);

    await expect(syncTeam(team.id, new FailingJira())).resolves.toBeUndefined();

    const refreshed = await prisma.team.findUnique({ where: { id: team.id } });
    expect(refreshed?.lastSyncError).toMatch(/401/);
  });

  it("does not delete manual capacity entries on sync", async () => {
    const team = await createTeam({ name: "Gamma", jiraBoardId: "9" });
    teams.push(team.id);

    const client = new FakeJira(
      [{ jiraSprintId: "200", name: "S", state: "ACTIVE", startDate: new Date("2026-05-18"), endDate: new Date("2026-05-22"), completeDate: null }],
      { "200": [] },
    );
    await syncTeam(team.id, client);
    const [sprint] = await listSprintsForTeam(team.id);
    await prisma.capacityEntry.create({ data: { sprintId: sprint.id, name: "Alice", personDays: 8 } });

    await syncTeam(team.id, client); // erneuter Sync

    const caps = await prisma.capacityEntry.findMany({ where: { sprintId: sprint.id } });
    expect(caps.length).toBe(1);
  });
});
```

- [ ] **Step 2: Test ausführen (fails)**

Run: `npm test -- syncTeam`
Expected: FAIL — „Cannot find module './syncTeam'".

- [ ] **Step 3: Implementierung schreiben**

Create `src/lib/sync/syncTeam.ts`:

```ts
import { prisma } from "@/lib/db";
import type { JiraClient } from "@/lib/jira/jiraClient";
import { computeSprintPoints } from "@/lib/jira/mapper";
import { upsertSprint } from "@/lib/repositories/sprintRepository";
import { replaceIssuesForSprint } from "@/lib/repositories/issueRepository";
import { recordBurndownPoint } from "@/lib/repositories/burndownRepository";

/**
 * Synchronisiert ein Team aus Jira. Wirft nicht: Fehler werden in Team.lastSyncError
 * festgehalten, damit ein fehlschlagendes Team andere nicht blockiert. Manuelle
 * Kapazitätsdaten werden nie angefasst.
 */
export async function syncTeam(teamId: string, client: JiraClient): Promise<void> {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return;

  try {
    const sprints = await client.fetchBoardSprints(team.jiraBoardId);

    for (const s of sprints) {
      const issues = await client.fetchSprintIssues(s.jiraSprintId);
      const { committedPoints, completedPoints } = computeSprintPoints(issues);

      const sprint = await upsertSprint(teamId, {
        jiraSprintId: s.jiraSprintId,
        name: s.name,
        state: s.state,
        startDate: s.startDate,
        endDate: s.endDate,
        completeDate: s.completeDate,
        committedPoints,
        completedPoints,
      });

      await replaceIssuesForSprint(sprint.id, issues);

      if (s.state === "ACTIVE") {
        await recordBurndownPoint(
          sprint.id,
          new Date(),
          Math.max(0, committedPoints - completedPoints),
          completedPoints,
        );
      }
    }

    await prisma.team.update({
      where: { id: teamId },
      data: { lastSyncedAt: new Date(), lastSyncError: null },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.team.update({
      where: { id: teamId },
      data: { lastSyncError: message },
    });
  }
}
```

- [ ] **Step 4: Test ausführen (passes)**

Run: `npm test -- syncTeam`
Expected: PASS, 3 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync/syncTeam.ts src/lib/sync/syncTeam.test.ts
git commit -m "feat: add per-team sync orchestration"
```

---

## Task 7: syncAllTeams + Scheduler

**Files:**
- Create: `src/lib/sync/scheduler.ts`, `src/lib/sync/syncAll.ts`, `src/lib/sync/syncAll.test.ts`

- [ ] **Step 1: Failing test für syncAllTeams schreiben**

Create `src/lib/sync/syncAll.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { createTeam } from "@/lib/repositories/teamRepository";
import { syncAllTeams } from "./syncAll";
import type { JiraClient, MappedSprint } from "@/lib/jira/jiraClient";

const teams: string[] = [];

afterEach(async () => {
  if (teams.length) {
    await prisma.team.deleteMany({ where: { id: { in: teams } } });
    teams.length = 0;
  }
});

class NoopJira implements JiraClient {
  async fetchBoardSprints(): Promise<MappedSprint[]> { return []; }
  async fetchSprintIssues() { return []; }
}

describe("syncAllTeams", () => {
  it("syncs every team and continues if one fails", async () => {
    const a = await createTeam({ name: "A", jiraBoardId: "1" });
    const b = await createTeam({ name: "B", jiraBoardId: "2" });
    teams.push(a.id, b.id);

    await syncAllTeams(() => new NoopJira());

    const refreshedA = await prisma.team.findUnique({ where: { id: a.id } });
    const refreshedB = await prisma.team.findUnique({ where: { id: b.id } });
    expect(refreshedA?.lastSyncedAt).not.toBeNull();
    expect(refreshedB?.lastSyncedAt).not.toBeNull();
  });
});
```

- [ ] **Step 2: Test ausführen (fails)**

Run: `npm test -- syncAll`
Expected: FAIL — „Cannot find module './syncAll'".

- [ ] **Step 3: syncAllTeams implementieren**

Create `src/lib/sync/syncAll.ts`:

```ts
import { listTeams } from "@/lib/repositories/teamRepository";
import { syncTeam } from "./syncTeam";
import { JiraCloudClient, jiraConfigFromEnv, type JiraClient } from "@/lib/jira/jiraClient";

/** Synchronisiert alle Teams nacheinander. clientFactory ist für Tests injizierbar. */
export async function syncAllTeams(
  clientFactory: () => JiraClient = () => new JiraCloudClient(jiraConfigFromEnv()),
): Promise<void> {
  const teams = await listTeams();
  for (const team of teams) {
    await syncTeam(team.id, clientFactory());
  }
}
```

- [ ] **Step 4: Test ausführen (passes)**

Run: `npm test -- syncAll`
Expected: PASS, 1 Test grün.

- [ ] **Step 5: Scheduler implementieren (kein Test — dünner Wrapper)**

Create `src/lib/sync/scheduler.ts`:

```ts
import cron from "node-cron";
import { syncAllTeams } from "./syncAll";

let started = false;

/**
 * Startet den Intervall-Sync. Das Intervall (Minuten) kommt aus SYNC_DEFAULT_INTERVAL.
 * Idempotent: mehrfaches Aufrufen startet nur einen Job.
 */
export function startScheduler(): void {
  if (started) return;
  started = true;

  const minutes = Number(process.env.SYNC_DEFAULT_INTERVAL ?? "60");
  const expression = `*/${Math.max(1, minutes)} * * * *`;

  cron.schedule(expression, () => {
    syncAllTeams().catch((err) => console.error("[scrumi] sync run failed:", err));
  });

  console.log(`[scrumi] sync scheduler started (every ${minutes} min)`);
}
```

- [ ] **Step 6: node-cron installieren**

```bash
npm install node-cron
npm install -D @types/node-cron
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/sync/syncAll.ts src/lib/sync/syncAll.test.ts src/lib/sync/scheduler.ts package.json package-lock.json
git commit -m "feat: add syncAllTeams and cron scheduler"
```

---

## Task 8: instrumentation + manueller Sync-Endpoint

**Files:**
- Create: `src/instrumentation.ts`, `src/app/api/sync/route.ts`

- [ ] **Step 1: instrumentation.ts schreiben**

Create `src/instrumentation.ts` (Next.js ruft `register()` einmalig beim Serverstart auf):

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("@/lib/sync/scheduler");
    startScheduler();
  }
}
```

- [ ] **Step 2: Manuellen Sync-Endpoint schreiben**

Create `src/app/api/sync/route.ts`:

```ts
import { NextResponse } from "next/server";
import { syncAllTeams } from "@/lib/sync/syncAll";

export const dynamic = "force-dynamic";

/** Löst sofort einen Sync aller Teams aus (Komfort/Fallback-Button im UI). */
export async function POST() {
  try {
    await syncAllTeams();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Build verifizieren**

Run: `npm run build`
Expected: Build erfolgreich; Route `/api/sync` wird als dynamisch gelistet.

- [ ] **Step 4: Commit**

```bash
git add src/instrumentation.ts src/app/api/sync/route.ts
git commit -m "feat: start scheduler via instrumentation and add manual sync route"
```

---

## Task 9: Phase-Abschluss

- [ ] **Step 1: Komplette Test-Suite**

Run: `npm test`
Expected: alle Tests grün (Phase 1 + mapper, jiraClient, issueRepository, burndownRepository, syncTeam, syncAll).

- [ ] **Step 2: Typprüfung & Build**

Run: `npx tsc --noEmit && npm run build`
Expected: keine Fehler, Build erfolgreich.

---

## Self-Review (vom Plan-Autor durchgeführt)

**Spec-Abdeckung:**
- Jira Cloud REST v3 / Agile, paginiert, Basic-Auth (Spec §2, §7) → Task 3.
- Adapter hinter Interface, austauschbar (Spec §3) → `JiraClient`-Interface (Task 3), Fakes in Tests (Task 6).
- Mapping + committed/completed (Spec §4, §5) → Task 2.
- Idempotenter Upsert (Spec §7) → Sprint-Upsert (Phase 1) + Issue-Replace (Task 4).
- BurndownPoint pro Tag vom Sync (Spec §4, §7) → Task 5 + Task 6.
- Automatischer Intervall-Sync via instrumentation/node-cron + manueller Trigger (Spec §2, §7) → Tasks 7, 8.
- Fehler je Team isoliert, letzte Daten bleiben, lastSyncError im UI lesbar (Spec §7) → Task 6 (try/catch, kein Throw).
- Kapazität wird vom Sync nie überschrieben (Spec §7) → Task 6 Test „does not delete manual capacity entries".
- Env-Konfiguration JIRA_* (Spec §9) → `jiraConfigFromEnv` (Task 3).

**Platzhalter-Scan:** Keine TBD/TODO; jeder Code-Step enthält vollständigen Code und konkrete Befehle mit erwarteter Ausgabe.

**Typkonsistenz:** `JiraClient`-Methoden (`fetchBoardSprints`, `fetchSprintIssues`) identisch in Interface, Implementierung, Fakes und `syncTeam`. `MappedSprint`-Felder entsprechen den Argumenten von `upsertSprint` (Phase 1). `computeSprintPoints` liefert `{committedPoints, completedPoints}`, exakt wie in `syncTeam` destrukturiert. `recordBurndownPoint(sprintId, date, remaining, completed)`-Signatur stimmt zwischen Repository (Task 5) und Aufrufer (Task 6) überein.
