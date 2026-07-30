# Status-Verweildauer im Standup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jede offene Standup-Card zeigt, wie viele Arbeitstage das Ticket schon im aktuellen Status ist; bei mehr als 5 Arbeitstagen warnt ein rotes Dreieck.

**Architecture:** Der Sync holt den Zeitpunkt des letzten Status-Wechsels aus dem Jira-Changelog (`expand=changelog`, Fallback aufs Erstelldatum, Nachladen bei abgeschnittenem Changelog) und speichert ihn als `Issue.statusSince`. Eine pure Metrik rechnet daraus Arbeitstage; Loader und `StandupBoard` reichen `daysInStatus`/`stale` bis zur Card durch.

**Tech Stack:** Next.js, Prisma (SQLite), Vitest, Jira Cloud REST (Agile 1.0 + API v3).

**Spec:** `docs/superpowers/specs/2026-07-30-standup-status-age-design.md`

---

### Task 1: Prisma-Schema — `Issue.statusSince`

**Files:**
- Modify: `prisma/schema.prisma:56-74` (model Issue)

- [ ] **Step 1: Feld ergänzen**

In `model Issue` nach `assignee String?` einfügen:

```prisma
  /// Zeitpunkt des letzten Status-Wechsels in Jira (null = noch nie gesynct)
  statusSince          DateTime?
```

- [ ] **Step 2: Migration erzeugen**

Run: `npx prisma migrate dev --name issue_status_since`
Expected: neue Migration unter `prisma/migrations/*_issue_status_since`, Client neu generiert.

- [ ] **Step 3: Commit**

```bash
git add prisma
git commit -m "feat(db): Issue.statusSince für Status-Verweildauer"
```

### Task 2: Mapper — `statusSinceFromChangelog` + `DomainIssue.statusSince`

**Files:**
- Modify: `src/lib/domain/types.ts:5-18` (DomainIssue)
- Modify: `src/lib/jira/types.ts` (Changelog-Typen)
- Modify: `src/lib/jira/mapper.ts:27-42` (mapIssue)
- Test: `src/lib/jira/mapper.test.ts`

- [ ] **Step 1: Failing Tests schreiben**

In `mapper.test.ts` den Import um `statusSinceFromChangelog` erweitern und anhängen:

```ts
describe("statusSinceFromChangelog", () => {
  const withLog = (
    histories: { created: string; items: { field: string }[] }[],
    created: string | null = "2026-07-01T08:00:00.000Z",
  ): JiraIssueRaw => {
    const raw = rawIssue("AB-9", 1, "indeterminate", null);
    raw.fields.created = created ?? undefined;
    raw.changelog = { startAt: 0, maxResults: 100, total: histories.length, histories };
    return raw;
  };

  it("nimmt den jüngsten Eintrag mit einem status-Item", () => {
    const raw = withLog([
      { created: "2026-07-10T09:00:00.000Z", items: [{ field: "status" }] },
      { created: "2026-07-20T09:00:00.000Z", items: [{ field: "assignee" }] },
      { created: "2026-07-15T09:00:00.000Z", items: [{ field: "status" }] },
    ]);
    expect(statusSinceFromChangelog(raw)).toEqual(new Date("2026-07-15T09:00:00.000Z"));
  });

  it("fällt ohne Status-Wechsel auf das Erstelldatum zurück", () => {
    const raw = withLog([{ created: "2026-07-20T09:00:00.000Z", items: [{ field: "assignee" }] }]);
    expect(statusSinceFromChangelog(raw)).toEqual(new Date("2026-07-01T08:00:00.000Z"));
  });

  it("gibt null zurück, wenn weder Changelog-Status noch created vorhanden sind", () => {
    const raw = rawIssue("AB-9", 1, "new", null);
    expect(statusSinceFromChangelog(raw)).toBeNull();
  });

  it("mapIssue befüllt statusSince aus dem Changelog", () => {
    const raw = withLog([{ created: "2026-07-12T09:00:00.000Z", items: [{ field: "status" }] }]);
    expect(mapIssue(raw, FIELD).statusSince).toEqual(new Date("2026-07-12T09:00:00.000Z"));
  });
});
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `npx vitest run src/lib/jira/mapper.test.ts`
Expected: FAIL (statusSinceFromChangelog existiert nicht; TS-Fehler zu `changelog`/`created`).

- [ ] **Step 3: Typen ergänzen**

`src/lib/jira/types.ts` — in `JiraIssueRaw.fields` nach `assignee` ergänzen und darunter neue Interfaces:

```ts
    created?: string;
```

```ts
export interface JiraChangelogHistory {
  created: string;
  items: { field: string }[];
}

export interface JiraChangelog {
  startAt: number;
  maxResults: number;
  total: number;
  histories: JiraChangelogHistory[];
}
```

Und in `JiraIssueRaw` (neben `fields`): `changelog?: JiraChangelog;`

`src/lib/domain/types.ts` — in `DomainIssue` nach `assignee` ergänzen:

```ts
  /** Zeitpunkt des letzten Status-Wechsels in Jira (null = unbekannt). */
  statusSince: Date | null;
```

- [ ] **Step 4: Mapper implementieren**

In `mapper.ts`:

```ts
/**
 * Zeitpunkt des letzten Status-Wechsels aus dem Issue-Changelog; ohne
 * Status-Wechsel gilt das Erstelldatum. Datumsvergleich statt Reihenfolge,
 * damit die Sortierung der Histories egal ist.
 */
export function statusSinceFromChangelog(raw: JiraIssueRaw): Date | null {
  let latest: Date | null = null;
  for (const h of raw.changelog?.histories ?? []) {
    if (!h.items.some((it) => it.field === "status")) continue;
    const d = new Date(h.created);
    if (latest === null || d > latest) latest = d;
  }
  if (latest) return latest;
  return raw.fields.created ? new Date(raw.fields.created) : null;
}
```

In `mapIssue` das Rückgabeobjekt ergänzen: `statusSince: statusSinceFromChangelog(raw),`

- [ ] **Step 5: Tests laufen lassen**

Run: `npx vitest run src/lib/jira/mapper.test.ts`
Expected: PASS. (Andere Suites können wegen `DomainIssue.statusSince` noch TS-Fehler zeigen — kommt in Task 3/4.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/jira/types.ts src/lib/jira/mapper.ts src/lib/jira/mapper.test.ts src/lib/domain/types.ts
git commit -m "feat(jira): statusSince aus dem Issue-Changelog mappen"
```

### Task 3: Jira-Client — `expand=changelog` + Nachladen bei Abschneidung

**Files:**
- Modify: `src/lib/jira/jiraClient.ts:95-127`
- Test: `src/lib/jira/jiraClient.test.ts`

- [ ] **Step 1: Failing Tests schreiben**

In `jiraClient.test.ts` innerhalb `describe("JiraCloudClient.fetchSprintIssues")` anhängen:

```ts
  it("fordert das Changelog nur für den Sprint-Endpoint an und mappt statusSince", async () => {
    const withLog = issue("AB-1");
    (withLog as Record<string, unknown>).changelog = {
      startAt: 0, maxResults: 100, total: 1,
      histories: [{ created: "2026-07-10T09:00:00.000Z", items: [{ field: "status" }] }],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ issues: [withLog], startAt: 0, maxResults: 50, total: 1 }))
      .mockResolvedValueOnce(jsonResponse({ issues: [], startAt: 0, maxResults: 50, total: 0 }));
    const client = new JiraCloudClient(config, fetchMock);

    const result = await client.fetchSprintIssues("42", "100");

    const urls = fetchMock.mock.calls.map(([u]) => u as string);
    expect(urls[0]).toContain("expand=changelog");
    expect(urls[0]).toContain("created");
    expect(urls[1]).not.toContain("expand=changelog");
    expect(result[0].statusSince).toEqual(new Date("2026-07-10T09:00:00.000Z"));
  });

  it("lädt bei abgeschnittenem Changelog alle Seiten nach und nimmt den letzten Status-Wechsel", async () => {
    const truncated = issue("AB-1");
    (truncated as Record<string, unknown>).changelog = {
      startAt: 0, maxResults: 1, total: 2,
      histories: [{ created: "2026-07-01T09:00:00.000Z", items: [{ field: "status" }] }],
    };
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/rest/api/3/issue/AB-1/changelog")) {
        return Promise.resolve(jsonResponse({
          startAt: 0, maxResults: 100, total: 2,
          values: [
            { created: "2026-07-01T09:00:00.000Z", items: [{ field: "status" }] },
            { created: "2026-07-18T09:00:00.000Z", items: [{ field: "status" }] },
          ],
        }));
      }
      if (url.includes("/board/42/sprint/100/issue")) {
        return Promise.resolve(jsonResponse({ issues: [], startAt: 0, maxResults: 50, total: 0 }));
      }
      return Promise.resolve(jsonResponse({ issues: [truncated], startAt: 0, maxResults: 50, total: 1 }));
    });
    const client = new JiraCloudClient(config, fetchMock);

    const result = await client.fetchSprintIssues("42", "100");

    expect(result[0].statusSince).toEqual(new Date("2026-07-18T09:00:00.000Z"));
  });
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `npx vitest run src/lib/jira/jiraClient.test.ts`
Expected: FAIL (`expand=changelog` fehlt; statusSince null).

- [ ] **Step 3: Client implementieren**

`paginateIssues` bekommt einen optionalen Query-Zusatz:

```ts
  private async paginateIssues(path: string, fields: string, extraQuery = ""): Promise<JiraIssueRaw[]> {
    const issues: JiraIssueRaw[] = [];
    let startAt = 0;
    for (;;) {
      const page = await this.getJson<JiraIssuePage>(
        `${path}?startAt=${startAt}&maxResults=50&fields=${fields}${extraQuery}`,
      );
      issues.push(...page.issues);
      if (page.issues.length === 0) break;
      startAt += page.issues.length;
      if (startAt >= page.total) break;
    }
    return issues;
  }
```

Neue private Methode (Import `JiraChangelogHistory` aus `./types`):

```ts
  // Jira liefert im Inline-Changelog höchstens 100 Einträge (die ältesten).
  // Für Issues mit mehr Einträgen alle Seiten holen und den jüngsten
  // Status-Wechsel per Datumsvergleich bestimmen.
  private async latestStatusChange(issueKey: string): Promise<Date | null> {
    let latest: Date | null = null;
    let startAt = 0;
    for (;;) {
      const page = await this.getJson<{ values: JiraChangelogHistory[]; total: number }>(
        `/rest/api/3/issue/${issueKey}/changelog?startAt=${startAt}&maxResults=100`,
      );
      for (const h of page.values) {
        if (!h.items.some((it) => it.field === "status")) continue;
        const d = new Date(h.created);
        if (latest === null || d > latest) latest = d;
      }
      if (page.values.length === 0) break;
      startAt += page.values.length;
      if (startAt >= page.total) break;
    }
    return latest;
  }
```

`fetchSprintIssues` anpassen — `created` in die Feldliste, `expand=changelog` nur für den Sprint-Endpoint, Nachladen bei Abschneidung:

```ts
  async fetchSprintIssues(boardId: string, sprintId: string): Promise<DomainIssue[]> {
    const fields = ["summary", "resolutiondate", "status", "issuetype", "parent", "assignee", "created", this.config.storyPointsField].join(",");
    const all = await this.paginateIssues(`/rest/agile/1.0/sprint/${sprintId}/issue`, fields, "&expand=changelog");
    const onBoard = await this.paginateIssues(
      `/rest/agile/1.0/board/${boardId}/sprint/${sprintId}/issue`,
      "issuetype",
    );
    const boardKeys = new Set(onBoard.map((raw) => raw.key));
    return Promise.all(
      all.map(async (raw) => {
        const visibleKey = raw.fields.issuetype?.subtask ? raw.fields.parent?.key : raw.key;
        const issue = mapIssue(raw, this.config.storyPointsField, visibleKey ? boardKeys.has(visibleKey) : false);
        const log = raw.changelog;
        if (log && log.total > log.histories.length) {
          issue.statusSince = (await this.latestStatusChange(raw.key)) ?? issue.statusSince;
        }
        return issue;
      }),
    );
  }
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run src/lib/jira/jiraClient.test.ts`
Expected: PASS (alle bestehenden + 2 neue).

- [ ] **Step 5: Commit**

```bash
git add src/lib/jira/jiraClient.ts src/lib/jira/jiraClient.test.ts
git commit -m "feat(jira): Changelog beim Sprint-Sync laden, statusSince bestimmen"
```

### Task 4: Repository — `statusSince` persistieren

**Files:**
- Modify: `src/lib/repositories/issueRepository.ts:16-28`
- Test: `src/lib/repositories/issueRepository.test.ts:29-30`

- [ ] **Step 1: Test-Fixture erweitern (failing)**

Im Fixture-Objekt (`issueRepository.test.ts:29-30`) `statusSince: null,` ergänzen. Zusätzlich in einem bestehenden Testfall ein Issue mit Datum speichern und zurücklesen — dem ersten Test folgendes Assert hinzufügen (Fixture-Helper dafür um Parameter erweitern oder ein Issue mit `{ ...fixture, statusSince: new Date("2026-07-10T09:00:00.000Z") }` speichern):

```ts
    const stored = await listIssuesForSprint(sprintId);
    expect(stored[0].statusSince).toEqual(new Date("2026-07-10T09:00:00.000Z"));
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `npx vitest run src/lib/repositories/issueRepository.test.ts`
Expected: FAIL (`statusSince` ist `null`, weil `replaceIssuesForSprint` es nicht schreibt).

- [ ] **Step 3: Repository durchreichen**

In `replaceIssuesForSprint` im `createMany`-Data-Objekt ergänzen: `statusSince: i.statusSince,`

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run src/lib/repositories/issueRepository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/repositories/issueRepository.ts src/lib/repositories/issueRepository.test.ts
git commit -m "feat(sync): statusSince in der Issue-Tabelle speichern"
```

### Task 5: Metrik — `workingDaysInStatus`

**Files:**
- Modify: `src/lib/metrics/standup.ts`
- Test: `src/lib/metrics/standup.test.ts`

- [ ] **Step 1: Failing Tests schreiben**

In `standup.test.ts` anhängen (Import um `workingDaysInStatus, STALE_AFTER_WORKING_DAYS` erweitern):

```ts
describe("workingDaysInStatus", () => {
  it("zählt den Wechseltag nicht mit (Wechsel heute = 0)", () => {
    const d = new Date("2026-07-29T10:00:00.000Z"); // Mittwoch
    expect(workingDaysInStatus(d, d)).toBe(0);
  });

  it("überspringt Wochenenden (Freitag -> Montag = 1 Arbeitstag)", () => {
    expect(
      workingDaysInStatus(new Date("2026-07-24T15:00:00.000Z"), new Date("2026-07-27T09:00:00.000Z")),
    ).toBe(1);
  });

  it("Wechsel am Wochenende zählt ab Montag als 0", () => {
    expect(
      workingDaysInStatus(new Date("2026-07-25T12:00:00.000Z"), new Date("2026-07-27T09:00:00.000Z")),
    ).toBe(0);
  });

  it("liefert 6 für Mittwoch -> Donnerstag der Folgewoche (über der Schwelle)", () => {
    const days = workingDaysInStatus(new Date("2026-07-22T08:00:00.000Z"), new Date("2026-07-30T08:00:00.000Z"));
    expect(days).toBe(6);
    expect(days > STALE_AFTER_WORKING_DAYS).toBe(true);
  });

  it("liefert 5 für Mittwoch -> Mittwoch der Folgewoche (noch nicht über der Schwelle)", () => {
    const days = workingDaysInStatus(new Date("2026-07-22T08:00:00.000Z"), new Date("2026-07-29T08:00:00.000Z"));
    expect(days).toBe(5);
    expect(days > STALE_AFTER_WORKING_DAYS).toBe(false);
  });
});
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `npx vitest run src/lib/metrics/standup.test.ts`
Expected: FAIL (Funktion existiert nicht).

- [ ] **Step 3: Metrik implementieren**

In `standup.ts` (Import: `import { workingDaysBetween } from "./workingDays";`):

```ts
/** Ab so vielen Arbeitstagen im selben Status gilt ein Ticket als hängend. */
export const STALE_AFTER_WORKING_DAYS = 5;

/**
 * Volle Arbeitstage (Mo–Fr) seit dem Status-Wechsel, exklusive des
 * Wechseltags: Wechsel heute ⇒ 0, Freitag → Montag ⇒ 1.
 */
export function workingDaysInStatus(statusSince: Date, today: Date): number {
  return Math.max(0, workingDaysBetween(statusSince, today).length - 1);
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run src/lib/metrics/standup.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/metrics/standup.ts src/lib/metrics/standup.test.ts
git commit -m "feat(standup): workingDaysInStatus mit 5-Tage-Schwelle"
```

### Task 6: Loader — `daysInStatus`/`stale` in die View

**Files:**
- Modify: `src/lib/view/loaders.ts:237-261` (loadStandup)

- [ ] **Step 1: Loader anpassen**

Import ergänzen: `workingDaysInStatus, STALE_AFTER_WORKING_DAYS` aus `@/lib/metrics/standup`. In `loadStandup` das `toView` ersetzen:

```ts
  const now = new Date();
  const toView = (i: {
    jiraKey: string;
    summary: string;
    issueType: string;
    status: string;
    statusCategory: string;
    statusSince: Date | null;
  }) => {
    const days =
      i.statusCategory !== "DONE" && i.statusSince !== null
        ? workingDaysInStatus(i.statusSince, now)
        : null;
    return {
      jiraKey: i.jiraKey,
      summary: i.summary,
      issueType: i.issueType,
      status: i.status,
      url: jiraBase ? `${jiraBase}/browse/${i.jiraKey}` : null,
      daysInStatus: days,
      stale: days !== null && days > STALE_AFTER_WORKING_DAYS,
    };
  };
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler. (`StandupBoard`-Props verlangen die neuen Felder erst nach Task 7 — Reihenfolge beachten: dieser Schritt liefert sie schon mit, das ist abwärtskompatibel.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/view/loaders.ts
git commit -m "feat(standup): Verweildauer und Stale-Flag im Standup-Loader"
```

### Task 7: UI — Anzeige + Warn-Icon auf der Card

**Files:**
- Modify: `src/components/StandupBoard.tsx:5-95` (StandupIssue, IssueCard)
- Test: `src/components/StandupBoard.test.tsx`

- [ ] **Step 1: Failing Tests schreiben**

Fixtures in `StandupBoard.test.tsx` erweitern: dem offenen Issue `daysInStatus: 3, stale: false`, dem erledigten `daysInStatus: null, stale: false` geben. Neue Tests anhängen:

```ts
  it("zeigt die Verweildauer auf offenen Cards", () => {
    start();
    fireEvent.click(screen.getByRole("button", { name: "Weiter" })); // zu Ben
    expect(screen.getByText("seit 3 Tagen")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Warnung/ })).not.toBeInTheDocument();
  });

  it("zeigt ein rotes Warn-Icon, wenn das Ticket hängt", () => {
    const stale: StandupGroupView[] = [
      {
        name: "Ben",
        openIssues: [
          { jiraKey: "A-3", summary: "Hängt", issueType: "Story", status: "Review", url: null, daysInStatus: 8, stale: true },
        ],
        doneIssues: [],
      },
    ];
    render(<StandupBoard groups={stale} />);
    fireEvent.click(screen.getByRole("button", { name: "Standup starten" }));
    expect(screen.getByText("seit 8 Tagen")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Warnung/ })).toBeInTheDocument();
    expect(screen.getByTestId("status-age-A-3")).toHaveAttribute(
      "title",
      'Seit 8 Arbeitstagen in „Review"',
    );
  });

  it("zeigt bei daysInStatus 0 „heute“ und ohne Wert nichts", () => {
    const mixed: StandupGroupView[] = [
      {
        name: "Ben",
        openIssues: [
          { jiraKey: "A-4", summary: "Frisch", issueType: "Story", status: "In Arbeit", url: null, daysInStatus: 0, stale: false },
          { jiraKey: "A-5", summary: "Alt gesynct", issueType: "Story", status: "In Arbeit", url: null, daysInStatus: null, stale: false },
        ],
        doneIssues: [],
      },
    ];
    render(<StandupBoard groups={mixed} />);
    fireEvent.click(screen.getByRole("button", { name: "Standup starten" }));
    expect(screen.getByText("heute")).toBeInTheDocument();
    expect(screen.queryByTestId("status-age-A-5")).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `npx vitest run src/components/StandupBoard.test.tsx`
Expected: FAIL (TS-Fehler: `daysInStatus` unbekannt).

- [ ] **Step 3: Komponente implementieren**

`StandupIssue` erweitern:

```ts
  /** Arbeitstage im aktuellen Status (null = unbekannt oder erledigt). */
  daysInStatus: number | null;
  /** Mehr als 5 Arbeitstage im selben Status → Warnung. */
  stale: boolean;
```

Helper neben `groupLabel`:

```ts
function daysLabel(days: number): string {
  if (days === 0) return "heute";
  return days === 1 ? "seit 1 Tag" : `seit ${days} Tagen`;
}
```

In `IssueCard` zwischen Summary-Span und IssueType-Span einfügen:

```tsx
      {!done && issue.daysInStatus !== null && (
        <span
          data-testid={`status-age-${issue.jiraKey}`}
          title={issue.stale ? `Seit ${issue.daysInStatus} Arbeitstagen in „${issue.status}"` : undefined}
          className={`flex flex-none items-center gap-1 font-mono text-[10.5px] ${
            issue.stale ? "text-warn" : "text-faint"
          }`}
        >
          {issue.stale && (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              role="img"
              aria-label={`Warnung: ${issue.jiraKey} hängt im Status`}
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          )}
          {daysLabel(issue.daysInStatus)}
        </span>
      )}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run src/components/StandupBoard.test.tsx`
Expected: PASS (bestehende + 3 neue).

- [ ] **Step 5: Commit**

```bash
git add src/components/StandupBoard.tsx src/components/StandupBoard.test.tsx
git commit -m "feat(standup): Verweildauer je Card mit rotem Warn-Icon ab 6 Arbeitstagen"
```

### Task 8: Abschluss — Gesamtlauf

- [ ] **Step 1: Alle Tests + Typecheck**

Run: `npm test` und `npx tsc --noEmit`
Expected: alles grün, keine TS-Fehler.

- [ ] **Step 2: Offene Änderungen committen (falls vorhanden)**

`git status` prüfen; Reste gehören zu einem der obigen Commits nach.

**Hinweis Betrieb:** Nach dem Deploy einen Sync ausführen, damit `statusSince` befüllt wird; bis dahin zeigen die Cards schlicht keine Verweildauer.
