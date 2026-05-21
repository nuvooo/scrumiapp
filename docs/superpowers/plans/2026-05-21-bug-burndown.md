# Bug-Burndown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second burndown chart that tracks the count of open (non-DONE) bugs over a sprint, shown beneath the existing story-point burndown.

**Architecture:** Capture the Jira issue type per issue during sync; on each ACTIVE-sprint sync, snapshot the count of open bugs into `BurndownPoint.remainingBugs` (same daily-snapshot mechanism as the story burndown, since Jira gives no history). A new `calcBugBurndown` metric builds an actual line from those snapshots plus a linear ideal line from the first measured count to zero. The view loader returns it and the burndown page renders a second `BurndownChart`.

**Tech Stack:** Next.js 15 (App Router), Prisma 6 + PostgreSQL, Recharts, Vitest. DB runs on `localhost:5432` (docker compose); tests in `src/lib/repositories` and `src/lib/sync` hit the real DB, so it must be up (`docker compose up -d postgres`).

---

## File Structure

- `prisma/schema.prisma` — add `Issue.issueType`, `BurndownPoint.remainingBugs` (+ generated migration).
- `src/lib/jira/types.ts` — add `issuetype` to `JiraIssueRaw.fields`.
- `src/lib/jira/mapper.ts` — set `issueType` in `mapIssue`; add `countOpenBugs`.
- `src/lib/jira/jiraClient.ts` — request `issuetype` field; add `getBugIssueTypes()`.
- `src/lib/domain/types.ts` — add `issueType` to `DomainIssue`, `remainingBugs` to `DomainBurndownPoint`.
- `src/lib/repositories/issueRepository.ts` — persist `issueType`.
- `src/lib/repositories/burndownRepository.ts` — persist `remainingBugs`.
- `src/lib/sync/syncTeam.ts` — snapshot open-bug count.
- `src/lib/metrics/burndown.ts` — add `calcBugBurndown` (+ types).
- `src/lib/view/mappers.ts` — map `remainingBugs`.
- `src/lib/view/loaders.ts` — return `bugBurndown` from `loadBurndown`.
- `src/components/charts/BurndownChart.tsx` — optional `actualName` prop.
- `src/app/(app)/burndown/page.tsx` — render second chart.
- `.env`, `.env.example`, `README.md` — document `JIRA_BUG_ISSUE_TYPES`.

---

## Task 1: DB schema + migration

**Files:**
- Modify: `prisma/schema.prisma` (Issue ~line 53-66, BurndownPoint ~line 68-77)

- [ ] **Step 1: Add `issueType` to the `Issue` model**

In `prisma/schema.prisma`, inside `model Issue`, add the field after `summary`:

```prisma
  jiraKey              String
  summary              String
  issueType            String         @default("")
  storyPoints          Float          @default(0)
```

- [ ] **Step 2: Add `remainingBugs` to the `BurndownPoint` model**

In `model BurndownPoint`, add the field after `completedPoints`:

```prisma
  date            DateTime
  remainingPoints Float
  completedPoints Float
  remainingBugs   Int      @default(0)
```

- [ ] **Step 3: Create and apply the migration**

Run: `npx prisma migrate dev --name bug_burndown`
Expected: a new folder `prisma/migrations/<timestamp>_bug_burndown/` is created, the migration applies cleanly, and Prisma Client regenerates ("Generated Prisma Client"). Requires the DB up on `localhost:5432`.

- [ ] **Step 4: Run the full test suite to confirm nothing broke**

Run: `npm test`
Expected: all existing tests still PASS (the new columns have defaults, so existing reads/writes are unaffected).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add issueType and remainingBugs columns for bug burndown"
```

---

## Task 2: Capture Jira issue type during mapping

**Files:**
- Modify: `src/lib/jira/types.ts:19-27`
- Modify: `src/lib/domain/types.ts:5-13`
- Modify: `src/lib/jira/mapper.ts:27-39`
- Modify: `src/lib/jira/jiraClient.ts:77`
- Modify: `src/lib/repositories/issueRepository.ts:16-24`
- Test: `src/lib/jira/mapper.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/lib/jira/mapper.test.ts`, update the `rawIssue` helper to include an issue type, and add an assertion. Replace the helper (lines 7-17) with:

```typescript
function rawIssue(
  key: string,
  points: number | null,
  catKey: "new" | "indeterminate" | "done",
  resolved: string | null,
  issueTypeName = "Story",
): JiraIssueRaw {
  return {
    key,
    fields: {
      summary: `Issue ${key}`,
      resolutiondate: resolved,
      status: { name: catKey, statusCategory: { key: catKey } },
      issuetype: { name: issueTypeName },
      [FIELD]: points,
    },
  };
}
```

Then add a new test inside `describe("mapIssue", ...)`:

```typescript
  it("captures the Jira issue type name", () => {
    const issue = mapIssue(rawIssue("AB-9", 0, "new", null, "Bug"), FIELD);
    expect(issue.issueType).toBe("Bug");
  });

  it("falls back to empty string when issue type is missing", () => {
    const raw = rawIssue("AB-10", 0, "new", null);
    delete (raw.fields as { issuetype?: unknown }).issuetype;
    expect(mapIssue(raw, FIELD).issueType).toBe("");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/jira/mapper.test.ts`
Expected: FAIL — `issue.issueType` is `undefined` and the type `JiraIssueRaw` has no `issuetype`.

- [ ] **Step 3: Add `issuetype` to the raw Jira type**

In `src/lib/jira/types.ts`, inside `JiraIssueRaw.fields`, add `issuetype` after `status`:

```typescript
export interface JiraIssueRaw {
  key: string;
  fields: {
    summary: string;
    resolutiondate: string | null;
    status: { name: string; statusCategory: JiraStatusCategory };
    issuetype: { name: string };
    [storyPointsField: string]: unknown;
  };
}
```

- [ ] **Step 4: Add `issueType` to the domain issue**

In `src/lib/domain/types.ts`, add to `DomainIssue` after `summary`:

```typescript
export interface DomainIssue {
  jiraKey: string;
  summary: string;
  issueType: string;
  storyPoints: number;
  status: string;
  statusCategory: StatusCategory;
  resolvedAt: Date | null;
  addedAfterSprintStart: boolean;
}
```

- [ ] **Step 5: Set `issueType` in `mapIssue`**

In `src/lib/jira/mapper.ts`, update the returned object in `mapIssue`:

```typescript
  return {
    jiraKey: raw.key,
    summary: raw.fields.summary,
    issueType: raw.fields.issuetype?.name ?? "",
    storyPoints,
    status: raw.fields.status.name,
    statusCategory: mapStatusCategory(raw.fields.status.statusCategory.key),
    resolvedAt: raw.fields.resolutiondate ? new Date(raw.fields.resolutiondate) : null,
    addedAfterSprintStart: false,
  };
```

- [ ] **Step 6: Request the `issuetype` field from Jira**

In `src/lib/jira/jiraClient.ts`, in `fetchSprintIssues` (line 77), add `"issuetype"` to the fields list:

```typescript
      const fields = ["summary", "resolutiondate", "status", "issuetype", this.config.storyPointsField].join(",");
```

- [ ] **Step 7: Persist `issueType` in the repository**

In `src/lib/repositories/issueRepository.ts`, add `issueType` to the `createMany` data mapping:

```typescript
      data: issues.map((i) => ({
        sprintId,
        jiraKey: i.jiraKey,
        summary: i.summary,
        issueType: i.issueType,
        storyPoints: i.storyPoints,
        status: i.status,
        statusCategory: i.statusCategory,
        resolvedAt: i.resolvedAt,
        addedAfterSprintStart: i.addedAfterSprintStart,
      })),
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/lib/jira/mapper.test.ts`
Expected: PASS (all `mapIssue` tests including the two new ones).

- [ ] **Step 9: Commit**

```bash
git add src/lib/jira/types.ts src/lib/domain/types.ts src/lib/jira/mapper.ts src/lib/jira/jiraClient.ts src/lib/repositories/issueRepository.ts src/lib/jira/mapper.test.ts
git commit -m "feat(sync): capture Jira issue type per issue"
```

---

## Task 3: Bug-type config + open-bug counter

**Files:**
- Modify: `src/lib/jira/jiraClient.ts` (add `getBugIssueTypes` near `jiraConfigFromEnv`, ~line 92-100)
- Modify: `src/lib/jira/mapper.ts` (add `countOpenBugs`)
- Test: `src/lib/jira/mapper.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/lib/jira/mapper.test.ts`, update the import on line 2 to include `countOpenBugs`:

```typescript
import { mapStatusCategory, mapIssue, computeSprintPoints, mapSprintState, countOpenBugs } from "./mapper";
```

Add a new describe block at the end of the file:

```typescript
describe("countOpenBugs", () => {
  const bugTypes = new Set(["bug", "fehler"]);
  const issue = (type: string, cat: "new" | "indeterminate" | "done") =>
    mapIssue(rawIssue(`X-${type}-${cat}`, 0, cat, null, type), FIELD);

  it("counts only non-DONE issues whose type is a configured bug type", () => {
    const issues = [
      issue("Bug", "new"),          // open bug -> counts
      issue("Fehler", "indeterminate"), // open bug -> counts
      issue("Bug", "done"),         // resolved bug -> excluded
      issue("Story", "new"),        // not a bug -> excluded
    ];
    expect(countOpenBugs(issues, bugTypes)).toBe(2);
  });

  it("matches bug types case-insensitively", () => {
    expect(countOpenBugs([issue("BUG", "new")], bugTypes)).toBe(1);
  });

  it("returns 0 for an empty list", () => {
    expect(countOpenBugs([], bugTypes)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/jira/mapper.test.ts`
Expected: FAIL — `countOpenBugs` is not exported from `./mapper`.

- [ ] **Step 3: Implement `countOpenBugs`**

In `src/lib/jira/mapper.ts`, add at the end of the file:

```typescript
/** Anzahl offener (nicht-DONE) Bugs. bugTypes ist ein Set lowercased Vorgangstyp-Namen. */
export function countOpenBugs(issues: DomainIssue[], bugTypes: Set<string>): number {
  return issues.filter(
    (i) => bugTypes.has(i.issueType.toLowerCase()) && i.statusCategory !== "DONE",
  ).length;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/jira/mapper.test.ts`
Expected: PASS.

- [ ] **Step 5: Add `getBugIssueTypes` config reader**

In `src/lib/jira/jiraClient.ts`, add after `jiraConfigFromEnv`:

```typescript
/**
 * Liest die als Bug geltenden Vorgangstypen aus JIRA_BUG_ISSUE_TYPES
 * (kommagetrennt, case-insensitive). Default: "Bug", "Fehler".
 */
export function getBugIssueTypes(): Set<string> {
  const raw = process.env.JIRA_BUG_ISSUE_TYPES;
  const source = raw && raw.trim() ? raw.split(",") : ["Bug", "Fehler"];
  const list = source.map((s) => s.trim().toLowerCase()).filter(Boolean);
  return new Set(list.length ? list : ["bug", "fehler"]);
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/jira/mapper.ts src/lib/jira/jiraClient.ts src/lib/jira/mapper.test.ts
git commit -m "feat(sync): add bug-type config and open-bug counter"
```

---

## Task 4: Persist remainingBugs in the burndown snapshot

**Files:**
- Modify: `src/lib/repositories/burndownRepository.ts:9-21`
- Test: `src/lib/repositories/burndownRepository.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/lib/repositories/burndownRepository.test.ts`, replace the test body (lines 28-39) so calls pass a `remainingBugs` argument and assert it:

```typescript
  it("upserts one point per (sprint, date)", async () => {
    const sprintId = await makeSprint();
    const day = new Date("2026-05-20T00:00:00.000Z");

    await recordBurndownPoint(sprintId, day, 30, 10, 4);
    await recordBurndownPoint(sprintId, day, 25, 15, 2);

    const points = await listBurndownForSprint(sprintId);
    expect(points.length).toBe(1);
    expect(points[0].remainingPoints).toBe(25);
    expect(points[0].completedPoints).toBe(15);
    expect(points[0].remainingBugs).toBe(2);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/repositories/burndownRepository.test.ts`
Expected: FAIL — `recordBurndownPoint` takes 4 args / `remainingBugs` not written (TS arity error or assertion mismatch).

- [ ] **Step 3: Add the `remainingBugs` parameter**

In `src/lib/repositories/burndownRepository.ts`, update `recordBurndownPoint`:

```typescript
export function recordBurndownPoint(
  sprintId: string,
  date: Date,
  remainingPoints: number,
  completedPoints: number,
  remainingBugs: number,
): Promise<BurndownPoint> {
  const day = atMidnightUtc(date);
  return prisma.burndownPoint.upsert({
    where: { sprintId_date: { sprintId, date: day } },
    create: { sprintId, date: day, remainingPoints, completedPoints, remainingBugs },
    update: { remainingPoints, completedPoints, remainingBugs },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/repositories/burndownRepository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/repositories/burndownRepository.ts src/lib/repositories/burndownRepository.test.ts
git commit -m "feat(db): persist remainingBugs in burndown snapshots"
```

---

## Task 5: Snapshot open-bug count in syncTeam

**Files:**
- Modify: `src/lib/sync/syncTeam.ts`
- Test: `src/lib/sync/syncTeam.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/lib/sync/syncTeam.test.ts`, the `FakeJira` returns `DomainIssue[]` literals that now need `issueType`. Update the first test's client to include bug issues and assert the snapshot. Replace the client setup and burndown assertion in the test `"stores sprints, issues, computed points and a burndown point"` (lines 36-57) with:

```typescript
    const client = new FakeJira(
      [{ jiraSprintId: "100", name: "Sprint 1", state: "ACTIVE",
         startDate: new Date("2026-05-18"), endDate: new Date("2026-05-22"), completeDate: null }],
      { "100": [
        { jiraKey: "AB-1", summary: "AB-1", issueType: "Story", storyPoints: 5, status: "Done", statusCategory: "DONE", resolvedAt: null, addedAfterSprintStart: false },
        { jiraKey: "AB-2", summary: "AB-2", issueType: "Story", storyPoints: 3, status: "To Do", statusCategory: "TODO", resolvedAt: null, addedAfterSprintStart: false },
        { jiraKey: "AB-3", summary: "AB-3", issueType: "Bug", storyPoints: 0, status: "To Do", statusCategory: "TODO", resolvedAt: null, addedAfterSprintStart: false },
        { jiraKey: "AB-4", summary: "AB-4", issueType: "Bug", storyPoints: 0, status: "Done", statusCategory: "DONE", resolvedAt: null, addedAfterSprintStart: false },
      ] },
    );

    await syncTeam(team.id, client, new Set(["bug"]));

    const sprints = await listSprintsForTeam(team.id);
    expect(sprints.length).toBe(1);
    expect(sprints[0].committedPoints).toBe(8);
    expect(sprints[0].completedPoints).toBe(5);

    const issues = await listIssuesForSprint(sprints[0].id);
    expect(issues.length).toBe(4);

    const burndown = await listBurndownForSprint(sprints[0].id);
    expect(burndown.length).toBe(1);
    expect(burndown[0].remainingPoints).toBe(3);
    expect(burndown[0].remainingBugs).toBe(1);
```

Also update the two other `FakeJira` issue literals: the `"200": []` case (line 80) needs no change (empty array). No further literal edits are required since only the first test lists issues.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/sync/syncTeam.test.ts`
Expected: FAIL — `syncTeam` does not accept a third arg / `remainingBugs` is not recorded.

- [ ] **Step 3: Update `syncTeam`**

In `src/lib/sync/syncTeam.ts`, update the imports and the function. Add to the imports at the top:

```typescript
import { computeSprintPoints, countOpenBugs } from "@/lib/jira/mapper";
import { getBugIssueTypes } from "@/lib/jira/jiraClient";
```

(Replace the existing `import { computeSprintPoints } from "@/lib/jira/mapper";` line.)

Change the signature and the burndown-recording block:

```typescript
export async function syncTeam(
  teamId: string,
  client: JiraClient,
  bugTypes: Set<string> = getBugIssueTypes(),
): Promise<void> {
```

and inside the `if (s.state === "ACTIVE")` block:

```typescript
      if (s.state === "ACTIVE") {
        await recordBurndownPoint(
          sprint.id,
          new Date(),
          Math.max(0, committedPoints - completedPoints),
          completedPoints,
          countOpenBugs(issues, bugTypes),
        );
      }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/sync/syncTeam.test.ts`
Expected: PASS (all three syncTeam tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync/syncTeam.ts src/lib/sync/syncTeam.test.ts
git commit -m "feat(sync): snapshot open-bug count per active sprint"
```

---

## Task 6: Domain burndown point gains remainingBugs

**Files:**
- Modify: `src/lib/domain/types.ts:26-30`
- Modify: `src/lib/view/mappers.ts:17-19`
- Test: `src/lib/view/mappers.test.ts:20-26`

- [ ] **Step 1: Write the failing test**

In `src/lib/view/mappers.test.ts`, update the `toDomainBurndownPoint` test (lines 20-26):

```typescript
describe("toDomainBurndownPoint", () => {
  it("maps date, remaining/completed points and remaining bugs", () => {
    const date = new Date("2026-05-19");
    const point = toDomainBurndownPoint({ id: "b1", sprintId: "s1", date, remainingPoints: 30, completedPoints: 10, remainingBugs: 4 });
    expect(point).toEqual({ date, remainingPoints: 30, completedPoints: 10, remainingBugs: 4 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/view/mappers.test.ts`
Expected: FAIL — mapped object lacks `remainingBugs`.

- [ ] **Step 3: Add `remainingBugs` to the domain type**

In `src/lib/domain/types.ts`:

```typescript
export interface DomainBurndownPoint {
  date: Date;
  remainingPoints: number;
  completedPoints: number;
  remainingBugs: number;
}
```

- [ ] **Step 4: Map it**

In `src/lib/view/mappers.ts`, update `toDomainBurndownPoint`:

```typescript
export function toDomainBurndownPoint(p: BurndownPoint): DomainBurndownPoint {
  return { date: p.date, remainingPoints: p.remainingPoints, completedPoints: p.completedPoints, remainingBugs: p.remainingBugs };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/view/mappers.test.ts`
Expected: PASS.

Note: the existing `calcBurndown` tests in `src/lib/metrics/burndown.test.ts` construct `DomainBurndownPoint` literals without `remainingBugs`. Vitest (esbuild) strips types and will not fail on this. Leave them; they still run. They get `remainingBugs` added in Task 7.

- [ ] **Step 6: Commit**

```bash
git add src/lib/domain/types.ts src/lib/view/mappers.ts src/lib/view/mappers.test.ts
git commit -m "feat(view): carry remainingBugs through the domain burndown point"
```

---

## Task 7: calcBugBurndown metric

**Files:**
- Modify: `src/lib/metrics/burndown.ts`
- Test: `src/lib/metrics/burndown.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/lib/metrics/burndown.test.ts`, update the import (line 2) and the `points` literals to include `remainingBugs`, then add a new describe block. First update the import:

```typescript
import { calcBurndown, calcBugBurndown } from "./burndown";
```

Update the existing `points` literal in the "passes actual points through sorted by date" test (lines 23-26) to add `remainingBugs`:

```typescript
    const points: DomainBurndownPoint[] = [
      { date: new Date("2026-05-19"), remainingPoints: 30, completedPoints: 10, remainingBugs: 3 },
      { date: new Date("2026-05-18"), remainingPoints: 40, completedPoints: 0, remainingBugs: 5 },
    ];
```

Add at the end of the file:

```typescript
describe("calcBugBurndown", () => {
  const points = (vals: Array<[string, number]>): DomainBurndownPoint[] =>
    vals.map(([d, bugs]) => ({ date: new Date(d), remainingPoints: 0, completedPoints: 0, remainingBugs: bugs }));

  it("builds an ideal line from the first snapshot's bug count to zero", () => {
    const result = calcBugBurndown(sprint(0, "2026-05-18", "2026-05-22"), points([["2026-05-18", 8]]));
    expect(result.ideal.length).toBe(5);
    expect(result.ideal[0].remainingBugs).toBe(8);
    expect(result.ideal[4].remainingBugs).toBe(0);
    expect(result.ideal[2].remainingBugs).toBe(4);
  });

  it("passes actual bug counts through sorted by date", () => {
    const result = calcBugBurndown(
      sprint(0, "2026-05-18", "2026-05-22"),
      points([["2026-05-20", 3], ["2026-05-18", 5]]),
    );
    expect(result.actual.map((p) => p.remainingBugs)).toEqual([5, 3]);
  });

  it("returns empty lines when there are no snapshots", () => {
    const result = calcBugBurndown(sprint(0, "2026-05-18", "2026-05-22"), []);
    expect(result.ideal).toEqual([]);
    expect(result.actual).toEqual([]);
  });

  it("returns empty lines when the sprint has no dates", () => {
    const s = sprint(0, "2026-05-18", "2026-05-22");
    s.startDate = null;
    expect(calcBugBurndown(s, points([["2026-05-18", 8]]))).toEqual({ ideal: [], actual: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/metrics/burndown.test.ts`
Expected: FAIL — `calcBugBurndown` is not exported.

- [ ] **Step 3: Implement `calcBugBurndown`**

In `src/lib/metrics/burndown.ts`, add at the end of the file:

```typescript
export interface BugBurndownLinePoint {
  date: Date;
  remainingBugs: number;
}

export interface BugBurndown {
  ideal: BugBurndownLinePoint[];
  actual: BugBurndownLinePoint[];
}

/**
 * Bug-Burndown: Ist-Linie aus den gespeicherten remainingBugs (nach Datum sortiert)
 * und eine lineare Ideallinie vom Bug-Stand des ersten Snapshots auf 0 über die
 * Arbeitstage. Ohne Sprint-Daten oder ohne Snapshots: leere Linien.
 */
export function calcBugBurndown(
  sprint: DomainSprint,
  points: DomainBurndownPoint[],
): BugBurndown {
  if (!sprint.startDate || !sprint.endDate || points.length === 0) {
    return { ideal: [], actual: [] };
  }

  const sorted = [...points].sort((a, b) => a.date.getTime() - b.date.getTime());
  const startBugs = sorted[0].remainingBugs;

  const days = workingDaysBetween(sprint.startDate, sprint.endDate);
  const steps = days.length <= 1 ? 1 : days.length - 1;
  const ideal: BugBurndownLinePoint[] = days.map((date, i) => ({
    date,
    remainingBugs: Math.max(0, days.length === 1 ? 0 : startBugs * (1 - i / steps)),
  }));

  const actual: BugBurndownLinePoint[] = sorted.map((p) => ({
    date: p.date,
    remainingBugs: p.remainingBugs,
  }));

  return { ideal, actual };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/metrics/burndown.test.ts`
Expected: PASS (existing `calcBurndown` tests + new `calcBugBurndown` tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/metrics/burndown.ts src/lib/metrics/burndown.test.ts
git commit -m "feat(metrics): add calcBugBurndown"
```

---

## Task 8: loadBurndown returns bugBurndown

**Files:**
- Modify: `src/lib/view/loaders.ts:7` (import) and `:40-46` (`loadBurndown`)

- [ ] **Step 1: Add the import**

In `src/lib/view/loaders.ts`, update the metrics import (line 7):

```typescript
import { calcBurndown, calcBugBurndown } from "@/lib/metrics/burndown";
```

- [ ] **Step 2: Compute and return the bug burndown**

Replace `loadBurndown` (lines 40-46):

```typescript
export async function loadBurndown(sprintId: string) {
  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (!sprint) return null;
  const domain = toDomainSprint(sprint);
  const points = (await listBurndownForSprint(sprintId)).map(toDomainBurndownPoint);
  const burndown = calcBurndown(domain, points);
  const bugBurndown = calcBugBurndown(domain, points);
  return { sprintName: sprint.name, ...burndown, bugBurndown };
}
```

- [ ] **Step 3: Verify the project still compiles and tests pass**

Run: `npm test`
Expected: all tests PASS. (No new unit test here — `loadBurndown` is a thin orchestration over already-tested units; it is exercised end-to-end via the page in Task 9 manual verification.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/view/loaders.ts
git commit -m "feat(view): expose bugBurndown from loadBurndown"
```

---

## Task 9: Render the bug chart on the burndown page

**Files:**
- Modify: `src/components/charts/BurndownChart.tsx:11-25`
- Modify: `src/app/(app)/burndown/page.tsx`

- [ ] **Step 1: Add an optional `actualName` prop to BurndownChart**

In `src/components/charts/BurndownChart.tsx`, update the component signature and the actual `<Line>` name:

```typescript
export function BurndownChart({ data, actualName = "Ist" }: { data: BurndownRow[]; actualName?: string }) {
  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart data={data} margin={{ top: 16, right: 24, bottom: 8, left: 0 }}>
        <CartesianGrid stroke="#1e293b" />
        <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
        <YAxis stroke="#94a3b8" fontSize={12} />
        <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
        <Legend />
        <Line type="monotone" dataKey="ideal" name="Ideal" stroke="#64748b" strokeDasharray="5 5" dot={false} connectNulls />
        <Line type="monotone" dataKey="actual" name={actualName} stroke="#34d399" strokeWidth={2} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Render the second chart on the page**

In `src/app/(app)/burndown/page.tsx`, replace the `return (...)` block (lines 38-47) with one that builds bug rows and renders a second chart. The story rows logic above is unchanged; append the bug section:

```typescript
  const bugByLabel = new Map<string, BurndownRow>();
  for (const p of data.bugBurndown.ideal) {
    const label = formatDateShort(p.date);
    bugByLabel.set(label, { label, ideal: roundTo1(p.remainingBugs), actual: null });
  }
  for (const p of data.bugBurndown.actual) {
    const label = formatDateShort(p.date);
    const row = bugByLabel.get(label) ?? { label, ideal: null, actual: null };
    row.actual = p.remainingBugs;
    bugByLabel.set(label, row);
  }
  const bugRows = [...bugByLabel.values()];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="mb-4 text-2xl font-bold">Burndown · {data.sprintName}</h1>
        {rows.length === 0 ? (
          <p className="text-slate-400">Dieser Sprint hat noch keine Burndown-Punkte.</p>
        ) : (
          <BurndownChart data={rows} />
        )}
      </div>
      <div>
        <h2 className="mb-4 text-xl font-bold">Bug-Burndown · Offene Bugs</h2>
        {bugRows.length === 0 ? (
          <p className="text-slate-400">Für diesen Sprint wurden noch keine Bug-Daten erfasst.</p>
        ) : (
          <BurndownChart data={bugRows} actualName="Offene Bugs" />
        )}
      </div>
    </div>
  );
```

- [ ] **Step 3: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds with no type errors (this typechecks the whole project, confirming all earlier signature changes line up).

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, open `http://localhost:3000/burndown`, select a team/sprint that has synced at least once while ACTIVE. Expected: the story burndown renders as before, and a "Bug-Burndown · Offene Bugs" chart appears below it (or its empty-state message if no bug snapshots exist yet).

- [ ] **Step 5: Commit**

```bash
git add src/components/charts/BurndownChart.tsx "src/app/(app)/burndown/page.tsx"
git commit -m "feat(ui): render bug burndown chart below story burndown"
```

---

## Task 10: Document the JIRA_BUG_ISSUE_TYPES config

**Files:**
- Modify: `.env`
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Add the variable to `.env.example`**

In `.env.example`, after the `JIRA_STORY_POINTS_FIELD` line, add:

```
JIRA_BUG_ISSUE_TYPES="Bug,Fehler"
```

- [ ] **Step 2: Add the variable to `.env`**

In `.env`, after the `JIRA_STORY_POINTS_FIELD` line, add the same:

```
JIRA_BUG_ISSUE_TYPES="Bug,Fehler"
```

- [ ] **Step 3: Document in README**

In `README.md`, find the section listing environment variables and add a row/line describing `JIRA_BUG_ISSUE_TYPES`: comma-separated, case-insensitive list of Jira issue-type names treated as bugs for the bug burndown (default `Bug,Fehler`). If there is no env-var section, add a short "Bug-Burndown" note explaining the chart counts open issues of these types per day, snapshotted on each active-sprint sync (no historical backfill).

- [ ] **Step 4: Run the full suite one last time**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add .env.example README.md
git commit -m "docs: document JIRA_BUG_ISSUE_TYPES and bug burndown"
```

Note: `.env` is gitignored — do not stage it. The `.env` edit in Step 2 is a local runtime change only.

---

## Self-Review Notes

- **Spec coverage:** schema (Task 1), issue-type capture + Jira field request (Task 2), configurable bug types (Task 3), bug snapshot persistence (Tasks 4-5), `countOpenBugs` excluding DONE (Task 3/5), `calcBugBurndown` actual+ideal-from-first-snapshot (Task 7), view wiring (Tasks 6, 8), second chart + empty state + integer counts (Task 9), `.env`/example/README (Task 10). All spec sections map to a task.
- **Limitation preserved:** no backfill — past snapshots keep `remainingBugs = 0` via the column default (Task 1).
- **Type consistency:** `DomainIssue.issueType: string`, `DomainBurndownPoint.remainingBugs: number`, `recordBurndownPoint(..., remainingBugs: number)`, `calcBugBurndown -> { ideal, actual }` with `BugBurndownLinePoint.remainingBugs`, `loadBurndown` returns `{ sprintName, ideal, actual, bugBurndown }`, `BurndownChart` prop `actualName?: string`. Names are used consistently across tasks.
