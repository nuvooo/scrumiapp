# Roadmap-Erweiterungen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Roadmap um größere Info-Karten, farbige Labels, roadmap-weite Meilensteine, ein Offcanvas-Panel zum Reinziehen und einen Story-Points-Fortschrittsbalken pro Bahn erweitern.

**Architecture:** Additive Prisma-Erweiterung (`RoadmapItem` += `storyPoints`/`assignee`/`labels`; neue Modelle `RoadmapLabel`, `RoadmapMilestone`). Reine Fortschritts-Logik in `src/lib/view/` mit Tests. Repository/Actions nach bestehendem Muster. UI baut auf dem vorhandenen CSS-Grid-Editor auf; Story Points/Assignee kommen aus Jira (Refresh) bzw. manuell (Ziele). Bearbeiten bleibt Moderatoren vorbehalten (Profil-Rolle).

**Tech Stack:** Next.js 15 App Router, Prisma/PostgreSQL, Tailwind, Vitest. Spec: `docs/superpowers/specs/2026-09-08-roadmap-erweiterungen-design.md`. Grundfeature-Spec: `docs/superpowers/specs/2026-09-08-roadmap-design.md`.

**Projekt-Eigenheiten:**
- Dev-Server läuft über `server.mjs`; nach Prisma-Migration neu starten; `EPERM` bei `prisma generate` unkritisch (wiederholen). Postgres läuft via Docker (`docker compose up -d postgres`), muss vor Tests/Migration laufen.
- Verifikations-Build: `$env:NEXT_DIST_DIR=".next-verify"; npm run build` (nie in `.next`).
- Tests: `npm test` (Vitest; Repository-Tests gegen echte `DATABASE_URL`-DB, `fileParallelism: false`). Bekannte Altlast: 7 TS-Fehler in `src/components/retro/RetroBoard.test.tsx` (fehlendes `revealed`) — ignorieren.
- Alle UI-Texte Deutsch. Monate als `"YYYY-MM"` über die Leitung, UTC-Monatserster in der DB.
- Moderator-Gating: `useIsRoadmapModerator()` (`src/components/roadmap/useRoadmapRole.ts`); Betrachter sehen alles read-only.

**Dateistruktur:**

| Datei | Änderung |
|---|---|
| `prisma/schema.prisma` | RoadmapItem-Felder + RoadmapLabel + RoadmapMilestone |
| `src/components/roadmap/itemColors.ts` | `LABEL_PALETTE` + `progressColors` |
| `src/lib/view/roadmapProgress.ts` (+`.test.ts`) | SP-Summen je Status pro Bahn |
| `src/lib/jira/jiraClient.ts` (+Test) | `getIssuesByKeys` += storyPoints/assignee |
| `src/lib/repositories/roadmapRepository.ts` (+`.test.ts`) | Labels, Meilensteine, SP/assignee, includes |
| `src/app/(app)/roadmap/actions.ts` | Label-/Meilenstein-Actions, SP/assignee |
| `src/components/roadmap/RoadmapItemDialog.tsx` | SP-Feld, Label-Zuweisung, Anzeige |
| `src/components/roadmap/RoadmapGoalDialog.tsx` | SP-Feld |
| `src/components/roadmap/RoadmapLabelsDialog.tsx` (neu) | Label-Palette verwalten |
| `src/components/roadmap/RoadmapMilestoneDialog.tsx` (neu) | Meilenstein anlegen/bearbeiten |
| `src/components/roadmap/RoadmapSidePanel.tsx` | → Offcanvas, Drag durchlässig |
| `src/components/roadmap/RoadmapEditor.tsx` | Karten, Progress, Meilensteine, Labels, Offcanvas |
| `src/app/(app)/roadmap/[id]/page.tsx` | neue Felder laden/mappen |
| `src/app/(app)/roadmap/page.tsx` | Karten-Chips/SP in Übersicht |

---

### Task 1: Branch + Prisma-Schema + Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Branch anlegen**

```powershell
git checkout -b feature/roadmap-erweiterungen
```

- [ ] **Step 2: RoadmapItem erweitern**

In `prisma/schema.prisma` im Modell `RoadmapItem` nach der Zeile `statusLabel     String?` einfügen:

```prisma
  storyPoints    Float          @default(0)
  /// Anzeigename des Bearbeiters aus Jira (null bei eigenen Zielen)
  assignee       String?
  labels         RoadmapLabel[]
```

- [ ] **Step 3: Roadmap-Rückrelationen ergänzen**

Im Modell `Roadmap` nach der Zeile `items      RoadmapItem[]` einfügen:

```prisma
  labels     RoadmapLabel[]
  milestones RoadmapMilestone[]
```

- [ ] **Step 4: Neue Modelle anhängen**

Ans Dateiende:

```prisma
/// Farbiges Label pro Roadmap; m:n zu Einträgen.
model RoadmapLabel {
  id        String        @id @default(cuid())
  roadmap   Roadmap       @relation(fields: [roadmapId], references: [id], onDelete: Cascade)
  roadmapId String
  name      String
  /// Hex-Farbe aus fester Palette
  color     String
  position  Int
  items     RoadmapItem[]
}

/// Roadmap-weiter Zeitpunkt-Marker (vertikale Linie über alle Bahnen).
model RoadmapMilestone {
  id        String   @id @default(cuid())
  roadmap   Roadmap  @relation(fields: [roadmapId], references: [id], onDelete: Cascade)
  roadmapId String
  title     String
  /// UTC-Monatserster
  month     DateTime
  /// Hex-Farbe aus fester Palette
  color     String
}
```

- [ ] **Step 5: Migration**

```powershell
npx prisma migrate dev --name roadmap_erweiterungen
```

Expected: „Your database is now in sync with your schema." Bei `EPERM` in `prisma generate`: `npx prisma generate` wiederholen. Dev-Server ggf. neu starten.

- [ ] **Step 6: Bestehende Tests**

```powershell
npm test
```

Expected: alle PASS.

- [ ] **Step 7: Commit**

```powershell
git add prisma
git commit -m "feat(roadmap): Schema fuer Story Points, Assignee, Labels und Meilensteine"
```

---

### Task 2: Fortschritts-Logik (`roadmapProgress`)

**Files:**
- Create: `src/lib/view/roadmapProgress.ts`
- Test: `src/lib/view/roadmapProgress.test.ts`

- [ ] **Step 1: Failing Tests**

`src/lib/view/roadmapProgress.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { laneProgress } from "./roadmapProgress";

describe("laneProgress", () => {
  it("summiert Story Points je Statuskategorie", () => {
    const p = laneProgress([
      { storyPoints: 5, statusCategory: "done" },
      { storyPoints: 3, statusCategory: "indeterminate" },
      { storyPoints: 2, statusCategory: "new" },
      { storyPoints: 4, statusCategory: null },
    ]);
    expect(p.done).toBe(5);
    expect(p.inProgress).toBe(3);
    expect(p.open).toBe(6); // new + null
    expect(p.total).toBe(14);
  });

  it("liefert Prozentwerte, die sich zu <= 100 summieren", () => {
    const p = laneProgress([
      { storyPoints: 5, statusCategory: "done" },
      { storyPoints: 5, statusCategory: "new" },
    ]);
    expect(p.donePct).toBe(50);
    expect(p.inProgressPct).toBe(0);
    expect(p.openPct).toBe(50);
  });

  it("behandelt leere Bahn ohne Division durch Null", () => {
    const p = laneProgress([]);
    expect(p).toEqual({
      done: 0, inProgress: 0, open: 0, total: 0,
      donePct: 0, inProgressPct: 0, openPct: 0,
    });
  });

  it("total 0 (alle SP 0) ergibt keine NaN-Prozente", () => {
    const p = laneProgress([{ storyPoints: 0, statusCategory: "done" }]);
    expect(p.total).toBe(0);
    expect(p.donePct).toBe(0);
  });
});
```

- [ ] **Step 2: Test schlägt fehl**

```powershell
npx vitest run src/lib/view/roadmapProgress.test.ts
```

Expected: FAIL („Cannot find module './roadmapProgress'").

- [ ] **Step 3: Implementieren**

`src/lib/view/roadmapProgress.ts`:

```ts
/** Story-Points-Fortschritt einer Bahn, aufgeschlüsselt nach Statuskategorie. */

export interface ProgressInput {
  storyPoints: number;
  /** "done" | "indeterminate" | "new" | null (unbekannt = offen) */
  statusCategory: string | null;
}

export interface LaneProgress {
  done: number;
  inProgress: number;
  open: number;
  total: number;
  donePct: number;
  inProgressPct: number;
  openPct: number;
}

export function laneProgress(items: ProgressInput[]): LaneProgress {
  let done = 0;
  let inProgress = 0;
  let open = 0;
  for (const i of items) {
    const sp = Number.isFinite(i.storyPoints) ? i.storyPoints : 0;
    if (i.statusCategory === "done") done += sp;
    else if (i.statusCategory === "indeterminate") inProgress += sp;
    else open += sp;
  }
  const total = done + inProgress + open;
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
  return {
    done, inProgress, open, total,
    donePct: pct(done),
    inProgressPct: pct(inProgress),
    openPct: pct(open),
  };
}
```

- [ ] **Step 4: Test grün**

```powershell
npx vitest run src/lib/view/roadmapProgress.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/view/roadmapProgress.ts src/lib/view/roadmapProgress.test.ts
git commit -m "feat(roadmap): Fortschritts-Logik (SP-Summen je Status pro Bahn)"
```

---

### Task 3: Jira-Client — Story Points + Assignee in `getIssuesByKeys`

**Files:**
- Modify: `src/lib/jira/jiraClient.ts`
- Test: `src/lib/jira/jiraClient.test.ts` (Describe-Block `getIssuesByKeys` erweitern)

- [ ] **Step 1: Test anpassen**

In `src/lib/jira/jiraClient.test.ts` im Describe `JuraCloudClient.getIssuesByKeys` das `rawIssue`-Helferobjekt und die erste Assertion ersetzen. Suche den bestehenden Block:

```ts
  const rawIssue = (key: string, categoryKey: string) => ({
    key,
    fields: {
      summary: `Summary ${key}`,
      resolutiondate: null,
      status: { name: "In Arbeit", statusCategory: { key: categoryKey } },
      issuetype: { name: "Epic" },
    },
  });
```

und ersetze ihn durch (Story-Points-Feld + Assignee ergänzt):

```ts
  const rawIssue = (key: string, categoryKey: string) => ({
    key,
    fields: {
      summary: `Summary ${key}`,
      resolutiondate: null,
      status: { name: "In Arbeit", statusCategory: { key: categoryKey } },
      issuetype: { name: "Epic" },
      assignee: { displayName: "Alice" },
      customfield_10016: 8,
    },
  });
```

Ersetze die erste `expect(result).toEqual([...])`-Assertion durch:

```ts
    expect(result).toEqual([
      {
        jiraKey: "AB-1",
        summary: "Summary AB-1",
        issueType: "Epic",
        statusLabel: "In Arbeit",
        statusCategory: "indeterminate",
        storyPoints: 8,
        assignee: "Alice",
      },
    ]);
```

Ergänze in demselben Test nach der `key in (...)`-Assertion eine Feld-Prüfung:

```ts
    expect(decodeURIComponent(url)).toContain("assignee");
```

- [ ] **Step 2: Test schlägt fehl**

```powershell
npx vitest run src/lib/jira/jiraClient.test.ts
```

Expected: FAIL (fehlende `storyPoints`/`assignee` im Ergebnis).

- [ ] **Step 3: Interface + Mapping erweitern**

In `src/lib/jira/jiraClient.ts` das Interface `JiraIssueStatus` ersetzen:

```ts
export interface JiraIssueStatus {
  jiraKey: string;
  summary: string;
  issueType: string;
  statusLabel: string;
  statusCategory: "new" | "indeterminate" | "done";
  storyPoints: number;
  assignee: string | null;
}
```

In der Methode `getIssuesByKeys` die JQL-Feldliste und das Mapping erweitern. Ersetze:

```ts
      const page = await this.getJson<{ issues?: JiraIssueRaw[] }>(
        `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=50&fields=summary,status,issuetype`,
      );
      for (const raw of page.issues ?? []) {
        results.push({
          jiraKey: raw.key,
          summary: raw.fields.summary,
          issueType: raw.fields.issuetype?.name ?? "",
          statusLabel: raw.fields.status.name,
          statusCategory: raw.fields.status.statusCategory.key,
        });
      }
```

durch:

```ts
      const fields = ["summary", "status", "issuetype", "assignee", this.config.storyPointsField].join(",");
      const page = await this.getJson<{ issues?: JiraIssueRaw[] }>(
        `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=50&fields=${fields}`,
      );
      for (const raw of page.issues ?? []) {
        const points = raw.fields[this.config.storyPointsField];
        results.push({
          jiraKey: raw.key,
          summary: raw.fields.summary,
          issueType: raw.fields.issuetype?.name ?? "",
          statusLabel: raw.fields.status.name,
          statusCategory: raw.fields.status.statusCategory.key,
          storyPoints: typeof points === "number" ? points : 0,
          assignee: raw.fields.assignee?.displayName ?? null,
        });
      }
```

- [ ] **Step 4: Test grün**

```powershell
npx vitest run src/lib/jira/jiraClient.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/jira/jiraClient.ts src/lib/jira/jiraClient.test.ts
git commit -m "feat(roadmap): getIssuesByKeys liefert Story Points und Assignee"
```

---

### Task 4: Repository — Labels, Meilensteine, SP/Assignee, Includes

**Files:**
- Modify: `src/lib/repositories/roadmapRepository.ts`
- Test: `src/lib/repositories/roadmapRepository.test.ts` (Describe-Blöcke anhängen)

- [ ] **Step 1: Failing Tests anhängen**

Ans Ende von `src/lib/repositories/roadmapRepository.test.ts` (nutzt bestehendes `makeTeam`, `jan`, `jun`, importierte Funktionen — Import-Zeile unten erweitern):

Zuerst die Import-Zeile oben in der Testdatei erweitern um die neuen Funktionen:

```ts
import {
  listRoadmaps, getRoadmap, createRoadmap, renameRoadmap, updateRoadmapRange, deleteRoadmap,
  createLane, renameLane, moveLane, deleteLane,
  createItem, updateItem, deleteItem, updateItemStatuses,
  createLabel, updateLabel, deleteLabel, setItemLabels,
  createMilestone, updateMilestone, deleteMilestone,
} from "./roadmapRepository";
```

Dann die neuen Tests anhängen:

```ts
describe("roadmapRepository — Labels", () => {
  it("legt Labels an, weist sie Items zu und lädt sie mit", async () => {
    const teamId = await makeTeam();
    const roadmap = await createRoadmap(teamId, "R", jan, jun);
    const lane = (await getRoadmap(roadmap.id))!.lanes[0];
    const item = await createItem(roadmap.id, lane.id, { title: "Z", startMonth: jan, endMonth: jan });
    const l1 = await createLabel(roadmap.id, "Frontend", "#4c9fc4");
    const l2 = await createLabel(roadmap.id, "Risiko", "#c4574c");

    await setItemLabels(item.id, [l1.id, l2.id]);

    const loaded = await getRoadmap(roadmap.id);
    expect(loaded?.labels.map((l) => [l.name, l.position])).toEqual([
      ["Frontend", 0],
      ["Risiko", 1],
    ]);
    const loadedItem = loaded?.lanes[0].items[0];
    expect(loadedItem?.labels.map((l) => l.name).sort()).toEqual(["Frontend", "Risiko"]);
  });

  it("ändert und löscht ein Label ohne das Item zu löschen", async () => {
    const teamId = await makeTeam();
    const roadmap = await createRoadmap(teamId, "R", jan, jun);
    const lane = (await getRoadmap(roadmap.id))!.lanes[0];
    const item = await createItem(roadmap.id, lane.id, { title: "Z", startMonth: jan, endMonth: jan });
    const label = await createLabel(roadmap.id, "Alt", "#4c9fc4");
    await setItemLabels(item.id, [label.id]);

    await updateLabel(label.id, { name: "Neu", color: "#c4574c" });
    await deleteLabel(label.id);

    const loaded = await getRoadmap(roadmap.id);
    expect(loaded?.labels).toEqual([]);
    expect(loaded?.lanes[0].items.length).toBe(1);
    expect(loaded?.lanes[0].items[0].labels).toEqual([]);
  });

  it("setItemLabels ersetzt die Zuordnung", async () => {
    const teamId = await makeTeam();
    const roadmap = await createRoadmap(teamId, "R", jan, jun);
    const lane = (await getRoadmap(roadmap.id))!.lanes[0];
    const item = await createItem(roadmap.id, lane.id, { title: "Z", startMonth: jan, endMonth: jan });
    const l1 = await createLabel(roadmap.id, "A", "#4c9fc4");
    const l2 = await createLabel(roadmap.id, "B", "#c4574c");
    await setItemLabels(item.id, [l1.id]);

    await setItemLabels(item.id, [l2.id]);

    const loaded = await getRoadmap(roadmap.id);
    expect(loaded?.lanes[0].items[0].labels.map((l) => l.name)).toEqual(["B"]);
  });
});

describe("roadmapRepository — Meilensteine", () => {
  it("legt Meilensteine an, ändert und löscht sie", async () => {
    const teamId = await makeTeam();
    const roadmap = await createRoadmap(teamId, "R", jan, jun);
    const m = await createMilestone(roadmap.id, "Release 1.0", jan, "#7C9CFF");

    let loaded = await getRoadmap(roadmap.id);
    expect(loaded?.milestones.map((x) => x.title)).toEqual(["Release 1.0"]);

    await updateMilestone(m.id, { title: "Release 1.1", month: jun });
    loaded = await getRoadmap(roadmap.id);
    expect(loaded?.milestones[0].title).toBe("Release 1.1");
    expect(loaded?.milestones[0].month).toEqual(jun);

    await deleteMilestone(m.id);
    loaded = await getRoadmap(roadmap.id);
    expect(loaded?.milestones).toEqual([]);
  });
});

describe("roadmapRepository — Story Points & Assignee", () => {
  it("speichert SP/Assignee am Item und aktualisiert sie im Status-Batch", async () => {
    const teamId = await makeTeam();
    const roadmap = await createRoadmap(teamId, "R", jan, jun);
    const lane = (await getRoadmap(roadmap.id))!.lanes[0];
    const item = await createItem(roadmap.id, lane.id, {
      jiraKey: "AB-1", title: "T", startMonth: jan, endMonth: jan, storyPoints: 3, assignee: "Bob",
    });
    expect(item.storyPoints).toBe(3);
    expect(item.assignee).toBe("Bob");

    await updateItemStatuses(roadmap.id, new Map([
      ["AB-1", { statusCategory: "done", statusLabel: "Fertig", storyPoints: 8, assignee: "Alice" }],
    ]));

    const updated = await prisma.roadmapItem.findUnique({ where: { id: item.id } });
    expect(updated?.storyPoints).toBe(8);
    expect(updated?.assignee).toBe("Alice");
    expect(updated?.statusCategory).toBe("done");
  });
});
```

- [ ] **Step 2: Tests schlagen fehl**

```powershell
npx vitest run src/lib/repositories/roadmapRepository.test.ts
```

Expected: FAIL (fehlende Exporte, `labels`/`milestones` nicht geladen).

- [ ] **Step 3: Includes + Typ erweitern**

In `src/lib/repositories/roadmapRepository.ts` den Import und `RoadmapWithContent` + `contentInclude` ersetzen:

```ts
import { prisma } from "@/lib/db";
import type { Roadmap, RoadmapLane, RoadmapItem, RoadmapLabel, RoadmapMilestone } from "@prisma/client";

export type RoadmapItemWithLabels = RoadmapItem & { labels: RoadmapLabel[] };
export type RoadmapWithContent = Roadmap & {
  lanes: (RoadmapLane & { items: RoadmapItemWithLabels[] })[];
  labels: RoadmapLabel[];
  milestones: RoadmapMilestone[];
};

const contentInclude = {
  lanes: {
    orderBy: { position: "asc" as const },
    include: { items: { orderBy: { position: "asc" as const }, include: { labels: true } } },
  },
  labels: { orderBy: { position: "asc" as const } },
  milestones: true,
};
```

- [ ] **Step 4: SP/Assignee an Items**

`NewRoadmapItem` erweitern (nach `statusLabel`):

```ts
export interface NewRoadmapItem {
  jiraKey?: string | null;
  issueType?: string | null;
  title: string;
  description?: string | null;
  startMonth: Date;
  endMonth: Date;
  statusCategory?: string | null;
  statusLabel?: string | null;
  storyPoints?: number;
  assignee?: string | null;
}
```

Im `createItem`-`data`-Objekt nach `statusLabel: data.statusLabel ?? null,` einfügen:

```ts
      storyPoints: data.storyPoints ?? 0,
      assignee: data.assignee ?? null,
```

`RoadmapItemPatch` erweitern (nach `statusLabel`):

```ts
export interface RoadmapItemPatch {
  laneId?: string;
  startMonth?: Date;
  endMonth?: Date;
  title?: string;
  description?: string | null;
  statusCategory?: string | null;
  statusLabel?: string | null;
  storyPoints?: number;
  assignee?: string | null;
}
```

`updateItemStatuses` ersetzen (Batch-Wert um SP/Assignee erweitert):

```ts
/** Status-Batch nach dem Jira-Refresh: aktualisiert Status, SP und Assignee je Key. */
export async function updateItemStatuses(
  roadmapId: string,
  statusByKey: Map<
    string,
    { statusCategory: string; statusLabel: string; storyPoints: number; assignee: string | null }
  >,
): Promise<void> {
  if (statusByKey.size === 0) return;
  await prisma.$transaction(
    [...statusByKey.entries()].map(([jiraKey, data]) =>
      prisma.roadmapItem.updateMany({ where: { roadmapId, jiraKey }, data }),
    ),
  );
}
```

- [ ] **Step 5: Label- und Meilenstein-Funktionen anhängen**

Ans Ende von `src/lib/repositories/roadmapRepository.ts`:

```ts
// ---------- Labels ----------

export async function createLabel(roadmapId: string, name: string, color: string): Promise<RoadmapLabel> {
  const max = await prisma.roadmapLabel.aggregate({ where: { roadmapId }, _max: { position: true } });
  return prisma.roadmapLabel.create({
    data: { roadmapId, name, color, position: (max._max.position ?? -1) + 1 },
  });
}

export function updateLabel(id: string, patch: { name?: string; color?: string }): Promise<RoadmapLabel> {
  return prisma.roadmapLabel.update({ where: { id }, data: patch });
}

export function deleteLabel(id: string): Promise<RoadmapLabel> {
  return prisma.roadmapLabel.delete({ where: { id } });
}

/** Ersetzt die Label-Zuordnung eines Items vollständig. */
export function setItemLabels(itemId: string, labelIds: string[]): Promise<RoadmapItem> {
  return prisma.roadmapItem.update({
    where: { id: itemId },
    data: { labels: { set: labelIds.map((id) => ({ id })) } },
  });
}

// ---------- Meilensteine ----------

export function createMilestone(
  roadmapId: string,
  title: string,
  month: Date,
  color: string,
): Promise<RoadmapMilestone> {
  return prisma.roadmapMilestone.create({ data: { roadmapId, title, month, color } });
}

export function updateMilestone(
  id: string,
  patch: { title?: string; month?: Date; color?: string },
): Promise<RoadmapMilestone> {
  return prisma.roadmapMilestone.update({ where: { id }, data: patch });
}

export function deleteMilestone(id: string): Promise<RoadmapMilestone> {
  return prisma.roadmapMilestone.delete({ where: { id } });
}
```

- [ ] **Step 6: Tests grün**

```powershell
npx vitest run src/lib/repositories/roadmapRepository.test.ts
```

Expected: alle PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/lib/repositories/roadmapRepository.ts src/lib/repositories/roadmapRepository.test.ts
git commit -m "feat(roadmap): Repository fuer Labels, Meilensteine, SP und Assignee"
```

---

### Task 5: Server Actions — Labels, Meilensteine, SP/Assignee

**Files:**
- Modify: `src/app/(app)/roadmap/actions.ts`

- [ ] **Step 1: Imports erweitern**

In `src/app/(app)/roadmap/actions.ts` den Repository-Import ersetzen:

```ts
import {
  createRoadmap, renameRoadmap, updateRoadmapRange, deleteRoadmap,
  createLane, renameLane, moveLane, deleteLane,
  createItem, updateItem, deleteItem, updateItemStatuses,
  createLabel, updateLabel, deleteLabel, setItemLabels,
  createMilestone, updateMilestone, deleteMilestone,
} from "@/lib/repositories/roadmapRepository";
```

- [ ] **Step 2: JiraItemInput + addJiraItemAction erweitern**

Das Interface `JiraItemInput` ersetzen:

```ts
export interface JiraItemInput {
  jiraKey: string;
  title: string;
  issueType: string;
  statusCategory: string | null;
  statusLabel: string | null;
  storyPoints: number;
  assignee: string | null;
}
```

In `addJiraItemAction` im `createItem`-Aufruf nach `statusLabel: item.statusLabel,` einfügen:

```ts
    storyPoints: item.storyPoints,
    assignee: item.assignee,
```

- [ ] **Step 3: Story Points in Goal-Actions**

`addGoalAction` erweitern — Signatur und `createItem`-Aufruf. Ersetze die Funktion `addGoalAction` vollständig:

```ts
export async function addGoalAction(
  roadmapId: string,
  laneId: string,
  title: string,
  description: string,
  startKey: string,
  endKey: string,
  storyPoints: number,
): Promise<ActionResult<{ id: string }>> {
  const trimmed = title.trim();
  if (!trimmed) return fail("Titel fehlt.");
  const range = monthRange(startKey, endKey);
  if (!range) return fail("Ungültiger Zeitraum.");
  const sp = Number.isFinite(storyPoints) && storyPoints >= 0 ? storyPoints : 0;
  const lane = await prisma.roadmapLane.findUnique({ where: { id: laneId } });
  if (!lane || lane.roadmapId !== roadmapId) return fail("Bahn nicht gefunden.");

  const created = await createItem(roadmapId, laneId, {
    title: trimmed,
    description: description.trim() || null,
    startMonth: range.start,
    endMonth: range.end,
    statusCategory: "new",
    statusLabel: "Offen",
    storyPoints: sp,
  });
  refresh(roadmapId);
  return { ok: true, data: { id: created.id } };
}
```

`updateGoalAction` erweitern — Signatur und `updateItem`-Aufruf. Ersetze die Funktion vollständig:

```ts
export async function updateGoalAction(
  itemId: string,
  title: string,
  description: string,
  statusCategory: "new" | "indeterminate" | "done",
  storyPoints: number,
): Promise<ActionResult> {
  const trimmed = title.trim();
  if (!trimmed) return fail("Titel fehlt.");
  const sp = Number.isFinite(storyPoints) && storyPoints >= 0 ? storyPoints : 0;
  const item = await prisma.roadmapItem.findUnique({ where: { id: itemId } });
  if (!item) return fail("Eintrag nicht gefunden.");
  if (item.jiraKey !== null) return fail("Nur eigene Ziele sind hier bearbeitbar.");

  await updateItem(itemId, {
    title: trimmed,
    description: description.trim() || null,
    statusCategory,
    statusLabel: GOAL_STATUS_LABELS[statusCategory],
    storyPoints: sp,
  });
  refresh(item.roadmapId);
  return { ok: true };
}
```

- [ ] **Step 4: refreshStatusesAction erweitern**

`RefreshedStatus` ersetzen und den `getIssuesByKeys`-Block anpassen. Ersetze das Interface:

```ts
export interface RefreshedStatus {
  jiraKey: string;
  statusCategory: string;
  statusLabel: string;
  storyPoints: number;
  assignee: string | null;
}
```

Im `try`-Block von `refreshStatusesAction` den `updateItemStatuses`- und Rückgabe-Teil ersetzen:

```ts
    const statuses = await client.getIssuesByKeys(keys);
    await updateItemStatuses(
      roadmapId,
      new Map(
        statuses.map((s) => [
          s.jiraKey,
          {
            statusCategory: s.statusCategory,
            statusLabel: s.statusLabel,
            storyPoints: s.storyPoints,
            assignee: s.assignee,
          },
        ]),
      ),
    );
    return {
      ok: true,
      data: statuses.map((s) => ({
        jiraKey: s.jiraKey,
        statusCategory: s.statusCategory,
        statusLabel: s.statusLabel,
        storyPoints: s.storyPoints,
        assignee: s.assignee,
      })),
    };
```

- [ ] **Step 5: Label- und Meilenstein-Actions anhängen**

Ans Ende von `src/app/(app)/roadmap/actions.ts`:

```ts
// ---------- Labels ----------

async function laneRoadmapOfLabel(labelId: string): Promise<string | null> {
  const label = await prisma.roadmapLabel.findUnique({ where: { id: labelId } });
  return label?.roadmapId ?? null;
}

export async function createLabelAction(
  roadmapId: string,
  name: string,
  color: string,
): Promise<ActionResult<{ id: string }>> {
  const trimmed = name.trim();
  if (!trimmed) return fail("Name fehlt.");
  const created = await createLabel(roadmapId, trimmed, color);
  refresh(roadmapId);
  return { ok: true, data: { id: created.id } };
}

export async function updateLabelAction(
  labelId: string,
  name: string,
  color: string,
): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return fail("Name fehlt.");
  const roadmapId = await laneRoadmapOfLabel(labelId);
  if (!roadmapId) return fail("Label nicht gefunden.");
  await updateLabel(labelId, { name: trimmed, color });
  refresh(roadmapId);
  return { ok: true };
}

export async function deleteLabelAction(labelId: string): Promise<ActionResult> {
  const roadmapId = await laneRoadmapOfLabel(labelId);
  if (!roadmapId) return fail("Label nicht gefunden.");
  await deleteLabel(labelId);
  refresh(roadmapId);
  return { ok: true };
}

export async function setItemLabelsAction(itemId: string, labelIds: string[]): Promise<ActionResult> {
  const item = await prisma.roadmapItem.findUnique({ where: { id: itemId } });
  if (!item) return fail("Eintrag nicht gefunden.");
  // Nur Labels derselben Roadmap zulassen.
  const valid = await prisma.roadmapLabel.findMany({
    where: { id: { in: labelIds }, roadmapId: item.roadmapId },
    select: { id: true },
  });
  await setItemLabels(itemId, valid.map((l) => l.id));
  refresh(item.roadmapId);
  return { ok: true };
}

// ---------- Meilensteine ----------

export async function createMilestoneAction(
  roadmapId: string,
  title: string,
  monthKey: string,
  color: string,
): Promise<ActionResult<{ id: string }>> {
  const trimmed = title.trim();
  if (!trimmed) return fail("Titel fehlt.");
  const month = parseMonthKey(monthKey);
  if (Number.isNaN(month.getTime())) return fail("Ungültiger Monat.");
  const created = await createMilestone(roadmapId, trimmed, month, color);
  refresh(roadmapId);
  return { ok: true, data: { id: created.id } };
}

export async function updateMilestoneAction(
  milestoneId: string,
  title: string,
  monthKey: string,
  color: string,
): Promise<ActionResult> {
  const trimmed = title.trim();
  if (!trimmed) return fail("Titel fehlt.");
  const month = parseMonthKey(monthKey);
  if (Number.isNaN(month.getTime())) return fail("Ungültiger Monat.");
  const milestone = await prisma.roadmapMilestone.findUnique({ where: { id: milestoneId } });
  if (!milestone) return fail("Meilenstein nicht gefunden.");
  await updateMilestone(milestoneId, { title: trimmed, month, color });
  refresh(milestone.roadmapId);
  return { ok: true };
}

export async function deleteMilestoneAction(milestoneId: string): Promise<ActionResult> {
  const milestone = await prisma.roadmapMilestone.findUnique({ where: { id: milestoneId } });
  if (!milestone) return fail("Meilenstein nicht gefunden.");
  await deleteMilestone(milestoneId);
  refresh(milestone.roadmapId);
  return { ok: true };
}
```

- [ ] **Step 6: Typecheck**

```powershell
npx tsc --noEmit
```

Expected: nur bekannte RetroBoard-Altlast (7 Fehler). Falls Fehler in `RoadmapEditor.tsx` wegen geänderter `addGoalAction`/`updateGoalAction`-Signatur auftauchen: erwartet — werden in Task 8 behoben. Prüfe, dass keine Fehler in `actions.ts` selbst stehen.

- [ ] **Step 7: Commit**

```powershell
git add "src/app/(app)/roadmap/actions.ts"
git commit -m "feat(roadmap): Actions fuer Labels, Meilensteine und Story Points"
```

---

### Task 6: Farbpalette + Fortschritts-Farbhelfer

**Files:**
- Modify: `src/components/roadmap/itemColors.ts`

- [ ] **Step 1: Palette + Progress-Farben ergänzen**

Ans Ende von `src/components/roadmap/itemColors.ts`:

```ts
/** Feste Farbpalette für Labels und Meilensteine (zum Theme passend). */
export const ROADMAP_PALETTE = [
  "#4c9fc4", // blau
  "#5aa469", // grün
  "#c4574c", // rot
  "#c49a4c", // gelb
  "#8a6dc4", // violett
  "#4cb0a8", // türkis
  "#c47ba0", // rosa
  "#7f8896", // grau
] as const;

/** Hintergrund-/Textfarben der Fortschrittssegmente (inline styles, da dynamisch). */
export const PROGRESS_COLORS = {
  done: "#5aa469",
  inProgress: "#4c9fc4",
  open: "#3a3f47",
} as const;
```

- [ ] **Step 2: Typecheck**

```powershell
npx tsc --noEmit
```

Expected: keine neuen Fehler (nur bekannte Altlast + evtl. noch die Goal-Signatur aus Task 5).

- [ ] **Step 3: Commit**

```powershell
git add src/components/roadmap/itemColors.ts
git commit -m "feat(roadmap): Farbpalette und Fortschritts-Farben"
```

---

### Task 7: View-Typen + Seiten-Mapping (Editor-Seite & Übersicht)

**Files:**
- Modify: `src/components/roadmap/RoadmapItemDialog.tsx` (Typ `RoadmapItemView` erweitern)
- Modify: `src/app/(app)/roadmap/[id]/page.tsx`
- Modify: `src/app/(app)/roadmap/page.tsx`

- [ ] **Step 1: `RoadmapItemView` + `LabelView` erweitern**

In `src/components/roadmap/RoadmapItemDialog.tsx` das Interface `RoadmapItemView` ersetzen und `LabelView` ergänzen (direkt nach `LaneOption`):

```ts
export interface RoadmapItemView {
  id: string;
  laneId: string;
  jiraKey: string | null;
  issueType: string | null;
  title: string;
  description: string | null;
  /** "YYYY-MM" */
  startMonth: string;
  endMonth: string;
  statusCategory: string | null;
  statusLabel: string | null;
  position: number;
  url: string | null;
  storyPoints: number;
  assignee: string | null;
  labelIds: string[];
}

export interface LabelView {
  id: string;
  name: string;
  color: string;
}
```

- [ ] **Step 2: Editor-Seite mappt neue Felder**

In `src/app/(app)/roadmap/[id]/page.tsx` die Item-Zusammenstellung (`const items: RoadmapItemView[] = ...`) ersetzen, sodass SP/Assignee/labelIds gemappt werden. Ersetze den `lane.items.map(...)`-Block innerhalb `roadmap.lanes.flatMap`:

```tsx
  const items: RoadmapItemView[] = roadmap.lanes.flatMap((lane) =>
    lane.items.map((item) => ({
      id: item.id,
      laneId: lane.id,
      jiraKey: item.jiraKey,
      issueType: item.issueType,
      title: item.title,
      description: item.description,
      startMonth: monthKey(item.startMonth),
      endMonth: monthKey(item.endMonth),
      statusCategory: item.statusCategory,
      statusLabel: item.statusLabel,
      position: item.position,
      url: item.jiraKey && jiraBase ? `${jiraBase}/browse/${item.jiraKey}` : null,
      storyPoints: item.storyPoints,
      assignee: item.assignee,
      labelIds: item.labels.map((l) => l.id),
    })),
  );
```

Den `sprintIssues`-Push erweitern (SP/Assignee mitgeben). Ersetze den `sprintIssues.push({...})`-Block:

```tsx
      sprintIssues.push({
        jiraKey: issue.jiraKey,
        summary: issue.summary,
        issueType: issue.issueType,
        statusLabel: issue.status,
        statusCategory: DB_CATEGORY[issue.statusCategory] ?? null,
        storyPoints: issue.storyPoints,
        assignee: issue.assignee,
      });
```

Den `view`-Aufbau erweitern (labels + milestones). Ersetze den `const view: RoadmapView = {...}`-Block:

```tsx
  const view: RoadmapView = {
    id: roadmap.id,
    name: roadmap.name,
    startMonth: monthKey(roadmap.startMonth),
    endMonth: monthKey(roadmap.endMonth),
    lanes: roadmap.lanes.map((l) => ({ id: l.id, name: l.name })),
    items,
    labels: roadmap.labels.map((l) => ({ id: l.id, name: l.name, color: l.color })),
    milestones: roadmap.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      month: monthKey(m.month),
      color: m.color,
    })),
  };
```

- [ ] **Step 3: Übersicht mappt neue Felder (nur für Karten-Anzeige)**

In `src/app/(app)/roadmap/page.tsx` wird `barGeometry` bereits genutzt; die Items kommen aus `roadmap.lanes[].items` mit `labels`. Für die kompakte Übersicht genügt der bestehende Titel; ergänze eine SP-Summe je Roadmap in der Überschrift. Ersetze in der `roadmaps.map((roadmap) => {`-Schleife die `Link`-Überschrift:

```tsx
                  <Link
                    href={`/roadmap/${roadmap.id}?team=${teamId}`}
                    className="text-[13.5px] font-semibold text-link hover:text-linkhi"
                  >
                    {roadmap.name}
                    {" · "}
                    <span className="font-mono text-[11.5px] text-faint">
                      {roadmap.lanes.reduce(
                        (sum, l) => sum + l.items.reduce((s, i) => s + i.storyPoints, 0),
                        0,
                      )}{" "}
                      SP
                    </span>
                    {" →"}
                  </Link>
```

- [ ] **Step 4: Typecheck**

```powershell
npx tsc --noEmit
```

Expected: Fehler in `RoadmapEditor.tsx` (RoadmapView braucht labels/milestones, Item-Props) sind erwartet — werden in Task 8 behoben. Keine Fehler in den beiden Seiten selbst.

- [ ] **Step 5: Commit**

```powershell
git add src/components/roadmap/RoadmapItemDialog.tsx "src/app/(app)/roadmap/[id]/page.tsx" "src/app/(app)/roadmap/page.tsx"
git commit -m "feat(roadmap): View-Typen und Seiten-Mapping fuer SP, Assignee, Labels, Meilensteine"
```

---

### Task 8: SidePanel → Offcanvas + SidePanelIssue-Felder

**Files:**
- Modify: `src/components/roadmap/RoadmapSidePanel.tsx`

- [ ] **Step 1: SidePanelIssue erweitern**

In `src/components/roadmap/RoadmapSidePanel.tsx` das Interface `SidePanelIssue` ersetzen:

```ts
export interface SidePanelIssue {
  jiraKey: string;
  summary: string;
  issueType: string;
  statusLabel: string | null;
  statusCategory: string | null;
  storyPoints: number;
  assignee: string | null;
}
```

Im `runSearch`-Mapping (`result.data.map((r) => ({...}))`) die Felder ergänzen:

```ts
      setResults(
        result.data.map((r) => ({
          jiraKey: r.jiraKey,
          summary: r.summary,
          issueType: r.issueType,
          statusLabel: r.status,
          statusCategory: null,
          storyPoints: r.storyPoints ?? 0,
          assignee: null,
        })),
      );
```

- [ ] **Step 2: Als Offcanvas rendern**

Die äußere `<aside ...>` in ein von rechts einschwebendes Overlay verwandeln. Ersetze die Signatur der Komponente und das umschließende Markup. Ändere den Funktionskopf:

```tsx
export function RoadmapSidePanel({
  sprintIssues,
  containedKeys,
  onAdd,
  onClose,
}: {
  sprintIssues: SidePanelIssue[];
  containedKeys: Set<string>;
  onAdd: (issue: SidePanelIssue) => void;
  onClose: () => void;
}) {
```

Ersetze das öffnende `<aside className="...">` durch einen Backdrop + Panel-Wrapper und das schließende `</aside>` durch die passenden schließenden Tags. Öffnendes Markup:

```tsx
  return (
    <>
      {/* Backdrop: schließt beim Klick; beim Ticket-Drag durchlässig (siehe Panel). */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <aside
        data-roadmap-offcanvas
        className="fixed right-0 top-0 z-50 flex h-full w-[320px] flex-col gap-2.5 border-l border-edge bg-card p-3 shadow-[-8px_0_24px_rgba(0,0,0,0.35)]"
      >
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-fg">Tickets hinzufügen</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="rounded-md px-1.5 text-[15px] text-faint hover:bg-chip hover:text-fg"
          >
            ✕
          </button>
        </div>
```

Schließendes Markup (ersetzt `</aside>` am Ende der Komponente):

```tsx
      </aside>
    </>
  );
```

- [ ] **Step 3: Drag macht das Panel durchlässig**

Im `IssueRow` beim Drag das Offcanvas durchlässig schalten, damit die Bahnen darunter Drop-Ziele sind. Ersetze die `onDragStart`/`onDragEnd`-Handler des ziehbaren `<div>`:

```tsx
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_MIME, JSON.stringify(issue));
        e.dataTransfer.effectAllowed = "copy";
        const panel = document.querySelector<HTMLElement>("[data-roadmap-offcanvas]");
        const backdrop = panel?.previousElementSibling as HTMLElement | null;
        if (panel) panel.style.pointerEvents = "none";
        if (panel) panel.style.opacity = "0.35";
        if (backdrop) backdrop.style.pointerEvents = "none";
      }}
      onDragEnd={() => {
        const panel = document.querySelector<HTMLElement>("[data-roadmap-offcanvas]");
        const backdrop = panel?.previousElementSibling as HTMLElement | null;
        if (panel) panel.style.pointerEvents = "";
        if (panel) panel.style.opacity = "";
        if (backdrop) backdrop.style.pointerEvents = "";
      }}
```

- [ ] **Step 4: Typecheck**

```powershell
npx tsc --noEmit
```

Expected: `RoadmapEditor.tsx` meldet fehlendes `onClose`-Prop und geänderte Item-Felder — in Task 9 behoben. Keine Fehler in `RoadmapSidePanel.tsx` selbst.

- [ ] **Step 5: Commit**

```powershell
git add src/components/roadmap/RoadmapSidePanel.tsx
git commit -m "feat(roadmap): Seitenleiste als Offcanvas mit durchlaessigem Drag"
```

---

### Task 9: Editor — Karten, Fortschrittsbalken, Offcanvas-Anbindung

**Files:**
- Modify: `src/components/roadmap/RoadmapEditor.tsx`

- [ ] **Step 1: RoadmapView + Imports erweitern**

In `src/components/roadmap/RoadmapEditor.tsx` die Interfaces `RoadmapView` erweitern und `LabelView`/`MilestoneView` importieren. Ersetze den Import aus `./RoadmapItemDialog`:

```tsx
import { RoadmapItemDialog, type LaneOption, type RoadmapItemView, type LabelView } from "./RoadmapItemDialog";
```

Ergänze Imports:

```tsx
import { laneProgress } from "@/lib/view/roadmapProgress";
import { PROGRESS_COLORS } from "./itemColors";
```

`RoadmapView` und `MilestoneView` ersetzen/ergänzen (bei den Typdefinitionen oben in der Datei):

```tsx
export interface MilestoneView {
  id: string;
  title: string;
  /** "YYYY-MM" */
  month: string;
  color: string;
}

export interface RoadmapView {
  id: string;
  name: string;
  /** "YYYY-MM" */
  startMonth: string;
  endMonth: string;
  lanes: RoadmapLaneView[];
  items: RoadmapItemView[];
  labels: LabelView[];
  milestones: MilestoneView[];
}
```

- [ ] **Step 2: Höhere Karten**

`ROW_HEIGHT` von `34` auf `56` erhöhen:

```tsx
const ROW_HEIGHT = 56;
```

Den Balken-Inhalt (`bars.map(({ item, geo }) => (...))`) ersetzen, sodass die Karte mehr Infos zeigt. Ersetze das innere Karten-`<div>` (das mit `onPointerDown={isModerator ? ...}`) durch:

```tsx
                    {bars.map(({ item, geo }) => {
                      const itemLabels = roadmap.labels.filter((l) => item.labelIds.includes(l.id));
                      return (
                        <div
                          key={item.id}
                          onPointerDown={isModerator ? (e) => startDrag(e, item, "move") : undefined}
                          onClick={isModerator ? undefined : () => setDialogItemId(item.id)}
                          title={`${item.title} (${item.startMonth} – ${item.endMonth})`}
                          style={{ gridColumn: `${geo.start + 1} / span ${geo.span}`, gridRow: rowById[item.id] + 1 }}
                          className={`group relative m-[2px] flex select-none flex-col gap-0.5 overflow-hidden rounded-[7px] border px-2 py-1 text-[11.5px] ${isModerator ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${barClasses(item.statusCategory)} ${drag?.itemId === item.id ? "ring-1 ring-accent" : ""}`}
                        >
                          {isModerator && (
                            <span
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                startDrag(e, item, "resize-left");
                              }}
                              className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100 group-hover:bg-accent/40"
                            />
                          )}
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            {geo.clippedLeft && <span className="flex-none">◂</span>}
                            <span className="flex-none font-mono text-[9px] uppercase tracking-[0.08em] opacity-70">
                              {typeBadge(item)}
                            </span>
                            {item.jiraKey && <span className="flex-none font-mono text-[9.5px] text-link">{item.jiraKey}</span>}
                            {item.storyPoints > 0 && (
                              <span className="flex-none font-mono text-[9.5px] text-faint">{item.storyPoints} SP</span>
                            )}
                            {item.assignee && <span className="ml-auto flex-none truncate text-[9.5px] text-faint">👤 {item.assignee}</span>}
                            {geo.clippedRight && <span className="flex-none">▸</span>}
                          </div>
                          <span className="min-w-0 flex-1 truncate font-medium leading-tight">{item.title}</span>
                          {itemLabels.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {itemLabels.map((l) => (
                                <span
                                  key={l.id}
                                  className="rounded-[4px] px-1 text-[9px] leading-[14px] text-white"
                                  style={{ backgroundColor: l.color }}
                                >
                                  {l.name}
                                </span>
                              ))}
                            </div>
                          )}
                          {isModerator && (
                            <span
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                startDrag(e, item, "resize-right");
                              }}
                              className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100 group-hover:bg-accent/40"
                            />
                          )}
                        </div>
                      );
                    })}
```

- [ ] **Step 3: Fortschrittsbalken in der Bahn-Beschriftung**

In der Bahn-Beschriftung links den Fortschrittsbalken ergänzen. Die linke Zellen-Struktur `<div className="flex items-center gap-1 py-1 pr-2">` in eine Spalte mit Balken darunter umbauen. Ersetze das öffnende `<div className="flex items-center gap-1 py-1 pr-2">` durch:

```tsx
                  <div className="flex flex-col gap-1 py-1 pr-2">
                    <div className="flex items-center gap-1">
```

und füge unmittelbar VOR dem schließenden `</div>` dieser Zelle (also nach dem `isModerator ? (...) : (...)`-Block, vor `</div>` das die Zelle schließt) den Balken ein. Konkret: nach dem schließenden `)}` des Namens/Buttons-Blocks und vor dem Zellen-`</div>` einfügen:

```tsx
                    </div>
                    {(() => {
                      const p = laneProgress(items.filter((i) => i.laneId === lane.id));
                      return (
                        <div className="flex items-center gap-1.5">
                          <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-[#23262b]">
                            <div style={{ width: `${p.donePct}%`, backgroundColor: PROGRESS_COLORS.done }} />
                            <div style={{ width: `${p.inProgressPct}%`, backgroundColor: PROGRESS_COLORS.inProgress }} />
                          </div>
                          <span className="flex-none font-mono text-[9.5px] text-faint">
                            {p.done}/{p.total} SP
                          </span>
                        </div>
                      );
                    })()}
```

Hinweis: Die zusätzliche Öffnung `<div className="flex items-center gap-1">` in dieser Zelle braucht ein zusätzliches schließendes `</div>` — es ist oben als `</div>` vor dem `laneProgress`-Block enthalten. Achte beim Einfügen darauf, dass die JSX-Verschachtelung aufgeht (ein `<div className="flex flex-col ...">` umschließt jetzt `<div className="flex items-center gap-1">…</div>` und den Balken-Block).

- [ ] **Step 4: LANE_LABEL_WIDTH verbreitern**

`LANE_LABEL_WIDTH` von `160` auf `200` erhöhen (Platz für den Balken):

```tsx
const LANE_LABEL_WIDTH = 200;
```

Und im `minWidth`-Style-Ausdruck `LANE_LABEL_WIDTH + monthCount * 56` bleibt korrekt (nutzt die Konstante).

- [ ] **Step 5: Offcanvas onClose anbinden**

Der `RoadmapSidePanel`-Aufruf braucht jetzt `onClose`. Ersetze den Block `{isModerator && panelOpen && (<RoadmapSidePanel .../>)}`:

```tsx
        {isModerator && panelOpen && (
          <RoadmapSidePanel
            sprintIssues={sprintIssues}
            containedKeys={containedKeys}
            onClose={() => setPanelOpen(false)}
            onAdd={(issue) => {
              const firstLane = roadmap.lanes[0];
              if (firstLane) addIssueAt(issue, firstLane.id, currentMonth);
            }}
          />
        )}
```

Da das Offcanvas jetzt als Overlay rendert, den Timeline-Container nicht mehr per Flex teilen. Ersetze das öffnende `<div className="flex items-start gap-3.5">` (das Timeline + Panel umschloss) durch:

```tsx
      <div className="items-start">
```

(Das Panel liegt nun als `fixed` Overlay außerhalb des Flex-Flows; der `min-w-0 flex-1`-Timeline-Container bleibt unverändert darin.)

- [ ] **Step 6: Panel-Toggle-Button-Beschriftung**

Der „Tickets"-Toggle-Button öffnet jetzt das Offcanvas. Ersetze den Button-Text-Ausdruck `{panelOpen ? "⇥" : "⇤ Tickets"}` durch:

```tsx
            ⧉ Tickets
```

und den `title`-Ausdruck durch `title="Tickets-Offcanvas öffnen"`.

- [ ] **Step 7: addIssueAt übergibt SP/Assignee**

In `addIssueAt` den `addJiraItemAction`-Aufruf erweitern. Ersetze das Item-Objekt im Aufruf:

```tsx
        {
          jiraKey: issue.jiraKey,
          title: issue.summary,
          issueType: issue.issueType,
          statusCategory: issue.statusCategory,
          statusLabel: issue.statusLabel,
          storyPoints: issue.storyPoints,
          assignee: issue.assignee,
        },
```

- [ ] **Step 8: Status-Refresh übernimmt SP/Assignee lokal**

Im `refreshStatusesAction`-`useEffect` das lokale `setItems`-Mapping ersetzen, sodass SP/Assignee mitgezogen werden:

```tsx
      const byKey = new Map(result.data.map((s) => [s.jiraKey, s]));
      setItems((prev) =>
        prev.map((i) => {
          const s = i.jiraKey === null ? undefined : byKey.get(i.jiraKey);
          return s
            ? { ...i, statusCategory: s.statusCategory, statusLabel: s.statusLabel, storyPoints: s.storyPoints, assignee: s.assignee }
            : i;
        }),
      );
```

- [ ] **Step 9: Typecheck + Tests**

```powershell
npx tsc --noEmit; npm test
```

Expected: keine neuen TS-Fehler (nur RetroBoard-Altlast); alle Tests PASS. Falls die Goal-Dialoge (Task 10) noch fehlen, können TS-Fehler zu `onSaveGoal`/`addGoalAction`-Aufrufen auftreten — diese in Task 10 abschließen; wenn Task 10 vor dem Typecheck liegt, hier grün.

- [ ] **Step 10: Commit**

```powershell
git add src/components/roadmap/RoadmapEditor.tsx
git commit -m "feat(roadmap): groessere Karten, Fortschrittsbalken pro Bahn, Offcanvas-Anbindung"
```

---

### Task 10: Item-/Goal-Dialoge — Story Points + Label-Zuweisung

**Files:**
- Modify: `src/components/roadmap/RoadmapItemDialog.tsx`
- Modify: `src/components/roadmap/RoadmapGoalDialog.tsx`
- Modify: `src/components/roadmap/RoadmapEditor.tsx` (Dialog-Aufrufe)

- [ ] **Step 1: RoadmapItemDialog — SP + Labels**

In `src/components/roadmap/RoadmapItemDialog.tsx` die Props erweitern. Ersetze den Props-Block der Funktion `RoadmapItemDialog` (Parameter + Typ):

```tsx
export function RoadmapItemDialog({
  item,
  lanes,
  labels,
  pending,
  error,
  readOnly = false,
  onClose,
  onDelete,
  onSavePlacement,
  onSaveGoal,
  onSaveLabels,
}: {
  item: RoadmapItemView;
  lanes: LaneOption[];
  labels: LabelView[];
  pending: boolean;
  error: string | null;
  readOnly?: boolean;
  onClose: () => void;
  onDelete: () => void;
  onSavePlacement: (laneId: string, startMonth: string, endMonth: string) => void;
  onSaveGoal: (title: string, description: string, statusCategory: "new" | "indeterminate" | "done", storyPoints: number) => void;
  onSaveLabels: (labelIds: string[]) => void;
}) {
```

Nach `const laneName = ...` die neuen States ergänzen:

```tsx
  const [storyPoints, setStoryPoints] = useState(String(item.storyPoints ?? 0));
  const [labelIds, setLabelIds] = useState<string[]>(item.labelIds);
  const labelsChanged =
    labelIds.length !== item.labelIds.length || labelIds.some((id) => !item.labelIds.includes(id));
  const toggleLabel = (id: string) =>
    setLabelIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
```

Im Goal-Bearbeiten-Zweig (nicht-readOnly, `isGoal`) nach dem Status-`<label>` ein SP-Feld einfügen:

```tsx
              <label>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Story Points</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={storyPoints}
                  onChange={(e) => setStoryPoints(e.target.value)}
                  className="mt-1 w-full rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[13px] text-fg"
                />
              </label>
```

Für Jira-Items (nicht-Goal, nicht-readOnly) die SP als read-only Info zeigen — nach dem `<div className="mt-3.5 text-[15px] font-medium ...">{item.title}</div>` ergänzen:

```tsx
            {!isGoal && (item.storyPoints > 0 || item.assignee) && (
              <div className="mt-1.5 flex flex-wrap gap-x-3 text-[12px] text-faint">
                {item.storyPoints > 0 && <span>{item.storyPoints} SP</span>}
                {item.assignee && <span>👤 {item.assignee}</span>}
              </div>
            )}
```

Label-Auswahl (nicht-readOnly) — vor dem Fehler-`{error && ...}` einfügen:

```tsx
        {!readOnly && labels.length > 0 && (
          <div className="mt-3.5 border-t border-edge pt-3.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Labels</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {labels.map((l) => {
                const on = labelIds.includes(l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => toggleLabel(l.id)}
                    className={`rounded-[6px] px-2 py-[3px] text-[11px] ${on ? "text-white" : "text-mid"}`}
                    style={{
                      backgroundColor: on ? l.color : "transparent",
                      border: `1px solid ${l.color}`,
                    }}
                  >
                    {l.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
```

Label-Chips im readOnly-Zweig — im `readOnly`-Placement-Block nach der Zeitraum-Anzeige ergänzen (innerhalb desselben Containers):

```tsx
            {item.labelIds.length > 0 && (
              <span className="flex flex-wrap gap-1">
                {labels
                  .filter((l) => item.labelIds.includes(l.id))
                  .map((l) => (
                    <span
                      key={l.id}
                      className="rounded-[4px] px-1.5 py-[1px] text-[10px] text-white"
                      style={{ backgroundColor: l.color }}
                    >
                      {l.name}
                    </span>
                  ))}
              </span>
            )}
```

Die Footer-Buttons (nicht-readOnly) um „Labels speichern" ergänzen und die Goal-Speichern-Aktion um SP erweitern. Ersetze im nicht-readOnly-Footer die beiden bestehenden bedingten Buttons durch:

```tsx
              {labelsChanged && (
                <button
                  type="button"
                  onClick={() => onSaveLabels(labelIds)}
                  disabled={pending}
                  className="btn-primary px-3.5 py-[7px] disabled:opacity-40"
                >
                  Labels speichern
                </button>
              )}
              {placementChanged && (
                <button
                  type="button"
                  onClick={() => onSavePlacement(laneId, start, end)}
                  disabled={pending}
                  className="btn-primary px-3.5 py-[7px] disabled:opacity-40"
                >
                  Zeitraum speichern
                </button>
              )}
              {isGoal && (
                <button
                  type="button"
                  onClick={() =>
                    onSaveGoal(title, description, status as "new" | "indeterminate" | "done", Number(storyPoints) || 0)
                  }
                  disabled={pending}
                  className="btn-primary px-3.5 py-[7px] disabled:opacity-40"
                >
                  Speichern
                </button>
              )}
```

- [ ] **Step 2: RoadmapGoalDialog — SP-Feld**

In `src/components/roadmap/RoadmapGoalDialog.tsx` die `onCreate`-Signatur um SP erweitern und ein SP-Feld ergänzen. Ersetze den Props-Typ `onCreate`:

```tsx
  onCreate: (laneId: string, title: string, description: string, startMonth: string, endMonth: string, storyPoints: number) => void;
```

State ergänzen (nach `const [end, setEnd] = useState(defaultMonth);`):

```tsx
  const [storyPoints, setStoryPoints] = useState("0");
```

Nach dem Beschreibung-`<label>` ein SP-Feld einfügen:

```tsx
        <label className="mt-3 block">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Story Points</span>
          <input
            type="number"
            min="0"
            step="1"
            value={storyPoints}
            onChange={(e) => setStoryPoints(e.target.value)}
            className="mt-1 w-full rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[13px] text-fg"
          />
        </label>
```

Den `onCreate`-Aufruf im Anlegen-Button erweitern:

```tsx
          onClick={() => onCreate(laneId, title, description, start, end, Number(storyPoints) || 0)}
```

- [ ] **Step 3: Editor — Dialog-Aufrufe anpassen**

In `src/components/roadmap/RoadmapEditor.tsx` den `RoadmapItemDialog`-Aufruf um `labels` und `onSaveLabels` erweitern und `onSaveGoal` um SP. Ersetze den `<RoadmapItemDialog ... />`-Block:

```tsx
        <RoadmapItemDialog
          item={dialogItem}
          lanes={lanes}
          labels={roadmap.labels}
          pending={pending}
          error={error}
          readOnly={!isModerator}
          onClose={() => setDialogItemId(null)}
          onDelete={() => {
            setDialogItemId(null);
            setItems((prev) => prev.filter((i) => i.id !== dialogItem.id));
            run(
              () => deleteItemAction(dialogItem.id),
              () => setItems((prev) => [...prev, dialogItem]),
            );
          }}
          onSavePlacement={(laneId, start, end) => {
            setDialogItemId(null);
            run(() => moveItemAction(dialogItem.id, laneId, start, end));
          }}
          onSaveGoal={(title, description, statusCategory, storyPoints) => {
            setDialogItemId(null);
            run(() => updateGoalAction(dialogItem.id, title, description, statusCategory, storyPoints));
          }}
          onSaveLabels={(labelIds) => {
            setItems((prev) => prev.map((i) => (i.id === dialogItem.id ? { ...i, labelIds } : i)));
            run(() => setItemLabelsAction(dialogItem.id, labelIds));
          }}
        />
```

Den `RoadmapGoalDialog`-`onCreate` erweitern:

```tsx
          onCreate={(laneId, title, description, start, end, storyPoints) => {
            setGoalDialogOpen(false);
            run(() => addGoalAction(roadmap.id, laneId, title, description, start, end, storyPoints));
          }}
```

Die neuen Actions importieren — im Actions-Import von `RoadmapEditor.tsx` ergänzen: `setItemLabelsAction`.

- [ ] **Step 4: Typecheck**

```powershell
npx tsc --noEmit
```

Expected: nur RetroBoard-Altlast.

- [ ] **Step 5: Commit**

```powershell
git add src/components/roadmap/RoadmapItemDialog.tsx src/components/roadmap/RoadmapGoalDialog.tsx src/components/roadmap/RoadmapEditor.tsx
git commit -m "feat(roadmap): Story Points und Label-Zuweisung in den Dialogen"
```

---

### Task 11: Labels-Verwaltung + Meilenstein-Dialog + Editor-Anbindung

**Files:**
- Create: `src/components/roadmap/RoadmapLabelsDialog.tsx`
- Create: `src/components/roadmap/RoadmapMilestoneDialog.tsx`
- Modify: `src/components/roadmap/RoadmapEditor.tsx`

- [ ] **Step 1: RoadmapLabelsDialog**

`src/components/roadmap/RoadmapLabelsDialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ROADMAP_PALETTE } from "./itemColors";
import type { LabelView } from "./RoadmapItemDialog";

/** Palette-Verwaltung: Labels anlegen, umbenennen, färben, löschen. */
export function RoadmapLabelsDialog({
  labels,
  pending,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: {
  labels: LabelView[];
  pending: boolean;
  onClose: () => void;
  onCreate: (name: string, color: string) => void;
  onUpdate: (id: string, name: string, color: string) => void;
  onDelete: (id: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(ROADMAP_PALETTE[0]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-md px-[18px] py-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[15px] font-semibold">Labels verwalten</h2>

        <div className="mt-3.5 flex flex-col gap-2">
          {labels.map((l) => (
            <div key={l.id} className="flex items-center gap-2">
              <input
                type="text"
                defaultValue={l.name}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== l.name) onUpdate(l.id, e.target.value, l.color);
                }}
                className="min-w-0 flex-1 rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[13px] text-fg"
              />
              <div className="flex flex-none gap-1">
                {ROADMAP_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Farbe ${c}`}
                    onClick={() => onUpdate(l.id, l.name, c)}
                    className={`h-4 w-4 rounded-full ${l.color === c ? "ring-2 ring-white" : ""}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => onDelete(l.id)}
                aria-label={`Label ${l.name} löschen`}
                className="flex-none rounded px-1 text-[12px] text-faint hover:text-danger"
              >
                ✕
              </button>
            </div>
          ))}
          {labels.length === 0 && <p className="text-[12.5px] text-faint">Noch keine Labels.</p>}
        </div>

        <div className="mt-3.5 flex items-center gap-2 border-t border-edge pt-3.5">
          <input
            type="text"
            value={newName}
            placeholder="Neues Label…"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) {
                onCreate(newName.trim(), newColor);
                setNewName("");
              }
            }}
            className="min-w-0 flex-1 rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[13px] text-fg"
          />
          <div className="flex flex-none gap-1">
            {ROADMAP_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Farbe ${c}`}
                onClick={() => setNewColor(c)}
                className={`h-4 w-4 rounded-full ${newColor === c ? "ring-2 ring-white" : ""}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            type="button"
            disabled={pending || !newName.trim()}
            onClick={() => {
              onCreate(newName.trim(), newColor);
              setNewName("");
            }}
            className="btn-primary flex-none px-3 py-1.5 disabled:opacity-40"
          >
            +
          </button>
        </div>

        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className="btn-secondary px-3.5 py-[7px]">
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: RoadmapMilestoneDialog**

`src/components/roadmap/RoadmapMilestoneDialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ROADMAP_PALETTE } from "./itemColors";
import type { MilestoneView } from "./RoadmapEditor";

/** Meilenstein anlegen oder bearbeiten. */
export function RoadmapMilestoneDialog({
  milestone,
  defaultMonth,
  pending,
  error,
  onClose,
  onSubmit,
  onDelete,
}: {
  /** null = neuer Meilenstein */
  milestone: MilestoneView | null;
  defaultMonth: string;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (title: string, month: string, color: string) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(milestone?.title ?? "");
  const [month, setMonth] = useState(milestone?.month ?? defaultMonth);
  const [color, setColor] = useState<string>(milestone?.color ?? ROADMAP_PALETTE[4]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm px-[18px] py-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[15px] font-semibold">{milestone ? "Meilenstein bearbeiten" : "Neuer Meilenstein"}</h2>
        <label className="mt-3.5 block">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Titel</span>
          <input
            type="text"
            value={title}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z. B. Release 1.0"
            className="mt-1 w-full rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[13px] text-fg"
          />
        </label>
        <label className="mt-3 block">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Monat</span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-1 w-full rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[13px] text-fg"
          />
        </label>
        <div className="mt-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Farbe</span>
          <div className="mt-1.5 flex gap-1.5">
            {ROADMAP_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Farbe ${c}`}
                onClick={() => setColor(c)}
                className={`h-5 w-5 rounded-full ${color === c ? "ring-2 ring-white" : ""}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        {error && <p className="mt-2.5 text-[12.5px] text-danger">{error}</p>}
        <div className="mt-4 flex items-center gap-2">
          {milestone && (
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              className="rounded-[9px] border border-[#5a2a2a] px-3.5 py-[7px] text-[12.5px] text-danger hover:bg-[#1d0e0e] disabled:opacity-40"
            >
              Löschen
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary px-3.5 py-[7px]">
              Abbrechen
            </button>
            <button
              type="button"
              disabled={pending || !title.trim()}
              onClick={() => onSubmit(title.trim(), month, color)}
              className="btn-primary px-3.5 py-[7px] disabled:opacity-40"
            >
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Editor — Meilenstein-Zeile + Linien + Dialoge**

In `src/components/roadmap/RoadmapEditor.tsx` die neuen Dialoge und Actions importieren:

```tsx
import { RoadmapLabelsDialog } from "./RoadmapLabelsDialog";
import { RoadmapMilestoneDialog } from "./RoadmapMilestoneDialog";
```

Actions-Import ergänzen um:
`createLabelAction, updateLabelAction, deleteLabelAction, createMilestoneAction, updateMilestoneAction, deleteMilestoneAction`.

State ergänzen (bei den anderen `useState`):

```tsx
  const [labelsDialogOpen, setLabelsDialogOpen] = useState(false);
  const [milestoneDialog, setMilestoneDialog] = useState<{ milestone: MilestoneView | null } | null>(null);
```

Im Header (Moderator-Zweig, bei den anderen Buttons) zwei Buttons ergänzen — nach dem „+ Bahn"-Button:

```tsx
              <button type="button" onClick={() => setLabelsDialogOpen(true)} className="btn-secondary px-3.5 py-[7px]">
                Labels
              </button>
              <button
                type="button"
                onClick={() => setMilestoneDialog({ milestone: null })}
                className="btn-secondary px-3.5 py-[7px]"
              >
                + Meilenstein
              </button>
```

Meilenstein-Zeile in der Kopfzeile ergänzen — direkt nach dem Monats-Grid (`<div className="grid border-b border-edge" style={columnsStyle} ref={gridRef}>...</div>`) innerhalb der rechten Spalte eine Meilenstein-Zeile einfügen:

```tsx
                <div className="relative grid h-6" style={columnsStyle}>
                  {roadmap.milestones.map((m) => {
                    const idx = monthDiff(roadmap.startMonth, m.month);
                    const col = Math.min(Math.max(idx, 0), monthCount - 1);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={isModerator ? () => setMilestoneDialog({ milestone: m }) : undefined}
                        title={`${m.title} (${m.month})`}
                        style={{ gridColumn: col + 1, color: m.color }}
                        className={`flex items-center gap-1 overflow-hidden whitespace-nowrap text-[10px] ${isModerator ? "cursor-pointer" : ""}`}
                      >
                        <span className="flex-none">◆</span>
                        <span className="truncate">{m.title}</span>
                      </button>
                    );
                  })}
                </div>
```

Vertikale Meilenstein-Linien über die Bahnen — im Bahn-Timeline-Container (`<div ref={(el) => {...}} onDragOver=... onDrop=... className="relative grid py-1" ...>`) nach der „Heute"-Linie einfügen:

```tsx
                    {roadmap.milestones.map((m) => {
                      const idx = monthDiff(roadmap.startMonth, m.month);
                      if (idx < 0 || idx >= monthCount) return null;
                      return (
                        <div
                          key={m.id}
                          className="pointer-events-none border-l border-dashed"
                          style={{ gridColumn: idx + 1, gridRow: `1 / ${rowCount + 1}`, borderColor: m.color, opacity: 0.5 }}
                        />
                      );
                    })}
```

Die Dialoge am Ende (vor dem schließenden `</div>` der Komponente) einfügen:

```tsx
      {labelsDialogOpen && (
        <RoadmapLabelsDialog
          labels={roadmap.labels}
          pending={pending}
          onClose={() => setLabelsDialogOpen(false)}
          onCreate={(name, color) => run(() => createLabelAction(roadmap.id, name, color))}
          onUpdate={(id, name, color) => run(() => updateLabelAction(id, name, color))}
          onDelete={(id) => run(() => deleteLabelAction(id))}
        />
      )}

      {milestoneDialog && (
        <RoadmapMilestoneDialog
          milestone={milestoneDialog.milestone}
          defaultMonth={currentMonth}
          pending={pending}
          error={error}
          onClose={() => setMilestoneDialog(null)}
          onSubmit={(title, month, color) => {
            const existing = milestoneDialog.milestone;
            setMilestoneDialog(null);
            run(() =>
              existing
                ? updateMilestoneAction(existing.id, title, month, color)
                : createMilestoneAction(roadmap.id, title, month, color),
            );
          }}
          onDelete={() => {
            const existing = milestoneDialog.milestone;
            setMilestoneDialog(null);
            if (existing) run(() => deleteMilestoneAction(existing.id));
          }}
        />
      )}
```

- [ ] **Step 4: Typecheck + Tests**

```powershell
npx tsc --noEmit; npm test
```

Expected: nur RetroBoard-Altlast bei tsc; alle Tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/components/roadmap/RoadmapLabelsDialog.tsx src/components/roadmap/RoadmapMilestoneDialog.tsx src/components/roadmap/RoadmapEditor.tsx
git commit -m "feat(roadmap): Labels-Verwaltung und Meilensteine im Editor"
```

---

### Task 12: Build-Verifikation + Abschluss

**Files:** keine neuen

- [ ] **Step 1: Kompletter Testlauf**

```powershell
npm test
```

Expected: alle Tests PASS.

- [ ] **Step 2: Verifikations-Build**

```powershell
$env:NEXT_DIST_DIR = ".next-verify"; npm run build; Remove-Item Env:NEXT_DIST_DIR
```

Expected: Build erfolgreich, Routen `/roadmap` und `/roadmap/[id]` vorhanden.

- [ ] **Step 3: Manueller Smoke-Test (durch den Nutzer)**

1. Als Moderator: Label anlegen/färben, einem Eintrag zuweisen → Chip erscheint auf der Karte.
2. Meilenstein anlegen → Rauten-Marker + vertikale Linie erscheinen.
3. Ticket per Offcanvas (⧉ Tickets) auf die Timeline ziehen → Panel wird beim Drag durchlässig, Drop landet in der Bahn.
4. Ziel mit Story Points anlegen; Fortschrittsbalken der Bahn zeigt SP-Verteilung/„X/Y SP".
5. Als Betrachter: alles read-only, Karten/Chips/Meilensteine/Fortschritt sichtbar.

- [ ] **Step 4: Abschluss**

Über die superpowers:finishing-a-development-branch-Fähigkeit (PR gegen `master`; Push nach Rückfrage auf beide Remotes).

---

## Self-Review-Notizen (eingearbeitet)

- Spec-Abdeckung: Schema (T1), Fortschritts-Logik (T2), Jira SP/Assignee (T3), Repository Labels/Meilensteine/SP (T4), Actions (T5), Palette (T6), View-Typen/Mapping (T7), Offcanvas (T8), Karten+Progress (T9), Dialoge SP/Labels (T10), Labels-/Meilenstein-UI (T11), Build (T12).
- Typkonsistenz: `RoadmapItemView` (+ storyPoints/assignee/labelIds) aus `RoadmapItemDialog.tsx`; `LabelView` ebenda; `MilestoneView`/`RoadmapView` aus `RoadmapEditor.tsx`; `SidePanelIssue` (+ storyPoints/assignee); `JiraIssueStatus`/`RefreshedStatus`/`JiraItemInput` konsistent um storyPoints+assignee erweitert; `updateItemStatuses`-Map-Wert konsistent in Repository (T4), Action (T5) und Editor-Refresh (T9).
- Actions-Signaturen: `addGoalAction`/`updateGoalAction` mit zusätzlichem `storyPoints`-Parameter — Aufrufer in T10 angepasst.
- YAGNI: keine Epic-Aggregation, keine teamweiten Labels, kein Color-Picker, keine Label-Gruppierung.
