# Teams, Kapazität Ist/Soll, Velocity-Tabelle, Burndown-Tickets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teams + Personen-Roster verwalten, Kapazität pro Person/Sprint mit Ist/Soll führen, Velocity als Tabelle (mit Delta/Trend) zeigen und im Burndown eine Ticket-Verlaufslinie (inkl. Sub-Tickets) ergänzen.

**Architecture:** Bestehende Schichtung beibehalten: Prisma → Repository → Domain-Mapper → reine Metrik (testbar) → View-Loader → Server-Page/Client-Komponente. Server Actions sind dünne Wrapper über Repositories. Reine Metriken/Helfer werden per Vitest unit-getestet, Repositories gegen die echte DB.

**Tech Stack:** Next.js 15 (App Router, RSC + Server Actions), Prisma 6 / PostgreSQL, React 19, Recharts 3, Vitest 4 + Testing Library.

**Test-Befehle:**
- Gezielt: `npx vitest run <pfad/zur/datei.test.ts>`
- Alles: `npm test`

**Hinweis zu Migrationen:** Repository-Tests laufen gegen eine echte Postgres-DB (`DATABASE_URL`). Nach jeder Schemaänderung muss die Migration angewendet sein, bevor DB-Tests grün werden.

---

## Phase 1 — Team bearbeiten + Personen-Roster

### Task 1.1: `teamRepository` um `updateTeam` und `deleteTeam` erweitern

**Files:**
- Modify: `src/lib/repositories/teamRepository.ts`
- Test: `src/lib/repositories/teamRepository.test.ts`

- [ ] **Step 1: Failing-Test ergänzen**

In `src/lib/repositories/teamRepository.test.ts` den Import erweitern und Tests anhängen:

```ts
import { createTeam, listTeams, getTeam, updateTeamSyncStatus, updateTeam, deleteTeam } from "./teamRepository";
```

```ts
  it("updates name, board and interval", async () => {
    const team = await createTeam({ name: "Old", jiraBoardId: "1" });
    created.push(team.id);

    const updated = await updateTeam(team.id, { name: "New", jiraBoardId: "99", syncIntervalMinutes: 30 });
    expect(updated.name).toBe("New");
    expect(updated.jiraBoardId).toBe("99");
    expect(updated.syncIntervalMinutes).toBe(30);
  });

  it("deletes a team", async () => {
    const team = await createTeam({ name: "Doomed", jiraBoardId: "5" });
    await deleteTeam(team.id);
    const fetched = await getTeam(team.id);
    expect(fetched).toBeNull();
  });
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/repositories/teamRepository.test.ts`
Expected: FAIL — `updateTeam`/`deleteTeam` ist nicht exportiert.

- [ ] **Step 3: Implementieren**

In `src/lib/repositories/teamRepository.ts` nach `updateTeamSyncStatus` ergänzen und `TeamMember` importieren:

```ts
import type { Team, TeamMember } from "@prisma/client";
```

```ts
export interface UpdateTeamInput {
  name: string;
  jiraBoardId: string;
  syncIntervalMinutes: number;
}

/** Aktualisiert die Stammdaten eines Teams. */
export function updateTeam(id: string, input: UpdateTeamInput): Promise<Team> {
  return prisma.team.update({ where: { id }, data: input });
}

/** Löscht ein Team samt aller abhängigen Daten (Cascade). */
export function deleteTeam(id: string): Promise<Team> {
  return prisma.team.delete({ where: { id } });
}

/** Teams inklusive ihrer Mitglieder, alphabetisch sortiert. */
export function listTeamsWithMembers(): Promise<(Team & { members: TeamMember[] })[]> {
  return prisma.team.findMany({
    orderBy: { name: "asc" },
    include: { members: { orderBy: { name: "asc" } } },
  });
}
```

- [ ] **Step 4: Test laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/repositories/teamRepository.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/repositories/teamRepository.ts src/lib/repositories/teamRepository.test.ts
git commit -m "feat(repo): add updateTeam, deleteTeam, listTeamsWithMembers"
```

---

### Task 1.2: `teamMemberRepository` (neu) mit CRUD

**Files:**
- Create: `src/lib/repositories/teamMemberRepository.ts`
- Test: `src/lib/repositories/teamMemberRepository.test.ts`

- [ ] **Step 1: Failing-Test schreiben**

`src/lib/repositories/teamMemberRepository.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { createTeam } from "./teamRepository";
import { listMembersForTeam, addMember, renameMember, removeMember } from "./teamMemberRepository";

const teams: string[] = [];

afterEach(async () => {
  if (teams.length) {
    await prisma.team.deleteMany({ where: { id: { in: teams } } });
    teams.length = 0;
  }
});

describe("teamMemberRepository", () => {
  it("adds and lists members alphabetically", async () => {
    const team = await createTeam({ name: "Alpha", jiraBoardId: "1" });
    teams.push(team.id);
    await addMember(team.id, "Bob");
    await addMember(team.id, "Alice");

    const members = await listMembersForTeam(team.id);
    expect(members.map((m) => m.name)).toEqual(["Alice", "Bob"]);
  });

  it("renames a member", async () => {
    const team = await createTeam({ name: "Beta", jiraBoardId: "2" });
    teams.push(team.id);
    const m = await addMember(team.id, "Charlie");

    const renamed = await renameMember(m.id, "Charlotte");
    expect(renamed.name).toBe("Charlotte");
  });

  it("removes a member", async () => {
    const team = await createTeam({ name: "Gamma", jiraBoardId: "3" });
    teams.push(team.id);
    const m = await addMember(team.id, "Dave");

    await removeMember(m.id);
    const members = await listMembersForTeam(team.id);
    expect(members.length).toBe(0);
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/repositories/teamMemberRepository.test.ts`
Expected: FAIL — Modul existiert nicht.

- [ ] **Step 3: Implementieren**

`src/lib/repositories/teamMemberRepository.ts`:

```ts
import { prisma } from "@/lib/db";
import type { TeamMember } from "@prisma/client";

export function listMembersForTeam(teamId: string): Promise<TeamMember[]> {
  return prisma.teamMember.findMany({ where: { teamId }, orderBy: { name: "asc" } });
}

export function addMember(teamId: string, name: string): Promise<TeamMember> {
  return prisma.teamMember.create({ data: { teamId, name } });
}

export function renameMember(id: string, name: string): Promise<TeamMember> {
  return prisma.teamMember.update({ where: { id }, data: { name } });
}

export function removeMember(id: string): Promise<TeamMember> {
  return prisma.teamMember.delete({ where: { id } });
}
```

- [ ] **Step 4: Test laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/repositories/teamMemberRepository.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/repositories/teamMemberRepository.ts src/lib/repositories/teamMemberRepository.test.ts
git commit -m "feat(repo): add teamMemberRepository CRUD"
```

---

### Task 1.3: Loader + Server Actions für Teams & Mitglieder

**Files:**
- Modify: `src/lib/view/loaders.ts`
- Modify: `src/app/(app)/settings/teams/actions.ts`

- [ ] **Step 1: Loader ergänzen**

In `src/lib/view/loaders.ts` Import erweitern und Loader anfügen:

```ts
import { listTeams, getTeam, listTeamsWithMembers } from "@/lib/repositories/teamRepository";
```

```ts
export async function loadTeamsWithMembers() {
  return listTeamsWithMembers();
}
```

- [ ] **Step 2: Actions ergänzen**

`src/app/(app)/settings/teams/actions.ts` komplett ersetzen:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createTeam, updateTeam, deleteTeam } from "@/lib/repositories/teamRepository";
import { addMember, renameMember, removeMember } from "@/lib/repositories/teamMemberRepository";

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

export async function editTeam(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const jiraBoardId = String(formData.get("jiraBoardId") ?? "").trim();
  const syncIntervalMinutes = Number(formData.get("syncIntervalMinutes") ?? "60");
  if (!id || !name || !jiraBoardId) return;

  await updateTeam(id, {
    name,
    jiraBoardId,
    syncIntervalMinutes: Number.isFinite(syncIntervalMinutes) ? syncIntervalMinutes : 60,
  });
  revalidatePath("/settings/teams");
}

export async function removeTeam(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deleteTeam(id);
  revalidatePath("/settings/teams");
}

export async function createMember(formData: FormData) {
  const teamId = String(formData.get("teamId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!teamId || !name) return;
  await addMember(teamId, name);
  revalidatePath("/settings/teams");
}

export async function editMember(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;
  await renameMember(id, name);
  revalidatePath("/settings/teams");
}

export async function deleteMember(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await removeMember(id);
  revalidatePath("/settings/teams");
}
```

- [ ] **Step 3: Build-Check**

Run: `npx tsc --noEmit`
Expected: PASS (keine Typfehler).

- [ ] **Step 4: Commit**

```bash
git add src/lib/view/loaders.ts src/app/(app)/settings/teams/actions.ts
git commit -m "feat(view): team + member actions and loadTeamsWithMembers"
```

---

### Task 1.4: `TeamEditor`-Komponente

**Files:**
- Create: `src/components/TeamEditor.tsx`
- Test: `src/components/TeamEditor.test.tsx`

- [ ] **Step 1: Failing-Test schreiben**

`src/components/TeamEditor.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/app/(app)/settings/teams/actions", () => ({
  editTeam: vi.fn(),
  removeTeam: vi.fn(),
}));

import { TeamEditor } from "./TeamEditor";

describe("TeamEditor", () => {
  it("prefills the team fields and carries the hidden id", () => {
    const { container } = render(
      <TeamEditor team={{ id: "t1", name: "Alpha", jiraBoardId: "42", syncIntervalMinutes: 30 }} />,
    );
    expect((screen.getByLabelText("Teamname") as HTMLInputElement).value).toBe("Alpha");
    expect((screen.getByLabelText("Jira Board-ID") as HTMLInputElement).value).toBe("42");
    const hidden = container.querySelector('input[name="id"]') as HTMLInputElement;
    expect(hidden.value).toBe("t1");
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/components/TeamEditor.test.tsx`
Expected: FAIL — Komponente existiert nicht.

- [ ] **Step 3: Implementieren**

`src/components/TeamEditor.tsx`:

```tsx
"use client";

import { editTeam, removeTeam } from "@/app/(app)/settings/teams/actions";

interface TeamEditorProps {
  team: { id: string; name: string; jiraBoardId: string; syncIntervalMinutes: number };
}

export function TeamEditor({ team }: TeamEditorProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <form action={editTeam} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="id" value={team.id} />
        <label className="flex flex-col text-xs text-slate-400">
          Teamname
          <input name="name" defaultValue={team.name} required className="mt-1 rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-100" />
        </label>
        <label className="flex flex-col text-xs text-slate-400">
          Jira Board-ID
          <input name="jiraBoardId" defaultValue={team.jiraBoardId} required className="mt-1 w-28 rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-100" />
        </label>
        <label className="flex flex-col text-xs text-slate-400">
          Sync-Intervall (min)
          <input name="syncIntervalMinutes" type="number" min="1" defaultValue={team.syncIntervalMinutes} className="mt-1 w-24 rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-100" />
        </label>
        <button type="submit" className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500">
          Speichern
        </button>
      </form>
      <form action={removeTeam} onSubmit={(e) => { if (!confirm("Team und alle zugehörigen Daten löschen?")) e.preventDefault(); }}>
        <input type="hidden" name="id" value={team.id} />
        <button type="submit" className="rounded border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/10">
          Löschen
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Test laufen lassen, grün bestätigen**

Run: `npx vitest run src/components/TeamEditor.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/TeamEditor.tsx src/components/TeamEditor.test.tsx
git commit -m "feat(ui): TeamEditor for editing/deleting a team"
```

---

### Task 1.5: `TeamMembers`-Komponente

**Files:**
- Create: `src/components/TeamMembers.tsx`
- Test: `src/components/TeamMembers.test.tsx`

- [ ] **Step 1: Failing-Test schreiben**

`src/components/TeamMembers.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/app/(app)/settings/teams/actions", () => ({
  createMember: vi.fn(),
  editMember: vi.fn(),
  deleteMember: vi.fn(),
}));

import { TeamMembers } from "./TeamMembers";

describe("TeamMembers", () => {
  it("lists members and offers an add field", () => {
    render(<TeamMembers teamId="t1" members={[{ id: "m1", name: "Alice" }, { id: "m2", name: "Bob" }]} />);
    expect((screen.getByDisplayValue("Alice"))).toBeInTheDocument();
    expect((screen.getByDisplayValue("Bob"))).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Neues Mitglied")).toBeInTheDocument();
  });

  it("shows an empty hint without members", () => {
    render(<TeamMembers teamId="t1" members={[]} />);
    expect(screen.getByText("Noch keine Mitglieder.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/components/TeamMembers.test.tsx`
Expected: FAIL — Komponente existiert nicht.

- [ ] **Step 3: Implementieren**

`src/components/TeamMembers.tsx`:

```tsx
"use client";

import { createMember, editMember, deleteMember } from "@/app/(app)/settings/teams/actions";

interface TeamMembersProps {
  teamId: string;
  members: { id: string; name: string }[];
}

export function TeamMembers({ teamId, members }: TeamMembersProps) {
  return (
    <div className="mt-3">
      <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">Mitglieder</div>
      {members.length === 0 && <p className="mb-2 text-sm text-slate-400">Noch keine Mitglieder.</p>}
      <ul className="mb-3 space-y-2">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-2">
            <form action={editMember} className="flex items-center gap-2">
              <input type="hidden" name="id" value={m.id} />
              <input name="name" defaultValue={m.name} className="rounded bg-slate-800 px-2 py-1 text-sm text-slate-100" />
              <button type="submit" className="text-xs text-slate-400 hover:text-emerald-400">Umbenennen</button>
            </form>
            <form action={deleteMember}>
              <input type="hidden" name="id" value={m.id} />
              <button type="submit" className="text-slate-500 hover:text-red-400" aria-label="Mitglied entfernen">✕</button>
            </form>
          </li>
        ))}
      </ul>
      <form action={createMember} className="flex items-end gap-2">
        <input type="hidden" name="teamId" value={teamId} />
        <input name="name" required placeholder="Neues Mitglied" className="rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-100" />
        <button type="submit" className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500">
          Hinzufügen
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Test laufen lassen, grün bestätigen**

Run: `npx vitest run src/components/TeamMembers.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/TeamMembers.tsx src/components/TeamMembers.test.tsx
git commit -m "feat(ui): TeamMembers roster management"
```

---

### Task 1.6: Teams-Seite zusammensetzen

**Files:**
- Modify: `src/app/(app)/settings/teams/page.tsx`

- [ ] **Step 1: Seite ersetzen**

`src/app/(app)/settings/teams/page.tsx`:

```tsx
import { TeamForm } from "@/components/TeamForm";
import { TeamEditor } from "@/components/TeamEditor";
import { TeamMembers } from "@/components/TeamMembers";
import { loadTeamsWithMembers } from "@/lib/view/loaders";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const teams = await loadTeamsWithMembers();

  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Teams / Jira</h1>

      <div className="mb-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <TeamForm />
      </div>

      <div className="space-y-4">
        {teams.length === 0 && <p className="text-sm text-slate-400">Noch keine Teams angelegt.</p>}
        {teams.map((t) => (
          <div key={t.id} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <TeamEditor team={{ id: t.id, name: t.name, jiraBoardId: t.jiraBoardId, syncIntervalMinutes: t.syncIntervalMinutes }} />
            <div className={`mt-2 text-xs ${t.lastSyncError ? "text-red-400" : "text-slate-400"}`}>
              {t.lastSyncError
                ? `Sync-Fehler: ${t.lastSyncError}`
                : t.lastSyncedAt
                ? `zuletzt synchronisiert: ${new Date(t.lastSyncedAt).toLocaleString("de-DE")}`
                : "noch nicht synchronisiert"}
            </div>
            <TeamMembers teamId={t.id} members={t.members.map((m) => ({ id: m.id, name: m.name }))} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build-Check + alle Tests**

Run: `npx tsc --noEmit && npm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/settings/teams/page.tsx
git commit -m "feat(ui): teams page with editor and member roster"
```

---

## Phase 2 — Kapazität Ist/Soll (Historie, aus Roster)

### Task 2.1: Schema-Migration — `CapacityEntry` Soll/Ist + Unique

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_capacity_ist_soll/migration.sql`

- [ ] **Step 1: Schema ändern**

In `prisma/schema.prisma` das Modell `CapacityEntry` ersetzen:

```prisma
model CapacityEntry {
  id                String      @id @default(cuid())
  sprint            Sprint      @relation(fields: [sprintId], references: [id], onDelete: Cascade)
  sprintId          String
  teamMember        TeamMember? @relation(fields: [teamMemberId], references: [id], onDelete: SetNull)
  teamMemberId      String?
  name              String
  plannedPersonDays Float       @default(0)
  actualPersonDays  Float       @default(0)

  @@unique([sprintId, teamMemberId])
}
```

- [ ] **Step 2: Migration als Entwurf erzeugen**

Run: `npx prisma migrate dev --create-only --name capacity_ist_soll`
Expected: Eine neue, noch nicht angewendete Migrationsdatei wird erzeugt.

- [ ] **Step 3: Migrations-SQL durch datenerhaltende Variante ersetzen**

Inhalt der erzeugten `migration.sql` vollständig durch Folgendes ersetzen:

```sql
-- Add new columns
ALTER TABLE "CapacityEntry" ADD COLUMN "plannedPersonDays" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "CapacityEntry" ADD COLUMN "actualPersonDays" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Carry existing personDays into both planned and actual
UPDATE "CapacityEntry" SET "plannedPersonDays" = "personDays", "actualPersonDays" = "personDays";

-- Drop old column
ALTER TABLE "CapacityEntry" DROP COLUMN "personDays";

-- Unique key for upsert by (sprint, member)
CREATE UNIQUE INDEX "CapacityEntry_sprintId_teamMemberId_key" ON "CapacityEntry"("sprintId", "teamMemberId");
```

- [ ] **Step 4: Migration anwenden + Client generieren**

Run: `npx prisma migrate dev`
Expected: Migration `capacity_ist_soll` wird angewendet, Prisma Client neu generiert.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): capacity entry planned/actual person days + unique"
```

---

### Task 2.2: Domain-Typ + Mapper anpassen

**Files:**
- Modify: `src/lib/domain/types.ts`
- Modify: `src/lib/view/mappers.ts`

- [ ] **Step 1: Domain-Typ ändern**

In `src/lib/domain/types.ts` `DomainCapacityEntry` ersetzen:

```ts
export interface DomainCapacityEntry {
  teamMemberId: string | null;
  name: string;
  plannedPersonDays: number;
  actualPersonDays: number;
}
```

- [ ] **Step 2: Mapper ändern**

In `src/lib/view/mappers.ts` `toDomainCapacityEntry` ersetzen:

```ts
export function toDomainCapacityEntry(c: CapacityEntry): DomainCapacityEntry {
  return {
    teamMemberId: c.teamMemberId,
    name: c.name,
    plannedPersonDays: c.plannedPersonDays,
    actualPersonDays: c.actualPersonDays,
  };
}
```

- [ ] **Step 3: Commit** (Build-Check folgt nach Task 2.4, wenn alle Konsumenten aktualisiert sind)

```bash
git add src/lib/domain/types.ts src/lib/view/mappers.ts
git commit -m "feat(domain): capacity entry planned/actual fields"
```

---

### Task 2.3: `capacityRepository` auf Upsert umstellen

**Files:**
- Modify: `src/lib/repositories/capacityRepository.ts`
- Test: `src/lib/repositories/capacityRepository.test.ts`

- [ ] **Step 1: Test ersetzen**

`src/lib/repositories/capacityRepository.test.ts` vollständig ersetzen:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { createTeam } from "./teamRepository";
import { addMember } from "./teamMemberRepository";
import { upsertSprint } from "./sprintRepository";
import {
  upsertCapacityEntry,
  listCapacityForSprint,
  listCapacityForSprints,
  removeCapacityEntry,
} from "./capacityRepository";

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
  const member = await addMember(team.id, "Alice");
  const sprint = await upsertSprint(team.id, {
    jiraSprintId: "100", name: "Sprint 1", state: "ACTIVE",
    startDate: null, endDate: null, completeDate: null,
    committedPoints: 0, completedPoints: 0,
  });
  return { sprintId: sprint.id, memberId: member.id };
}

describe("capacityRepository", () => {
  it("inserts then updates the same (sprint, member) entry", async () => {
    const { sprintId, memberId } = await makeSprint();

    await upsertCapacityEntry(sprintId, memberId, { name: "Alice", plannedPersonDays: 8, actualPersonDays: 8 });
    await upsertCapacityEntry(sprintId, memberId, { name: "Alice", plannedPersonDays: 8, actualPersonDays: 5 });

    const entries = await listCapacityForSprint(sprintId);
    expect(entries.length).toBe(1);
    expect(entries[0].plannedPersonDays).toBe(8);
    expect(entries[0].actualPersonDays).toBe(5);
  });

  it("lists entries across multiple sprints", async () => {
    const { sprintId, memberId } = await makeSprint();
    await upsertCapacityEntry(sprintId, memberId, { name: "Alice", plannedPersonDays: 8, actualPersonDays: 8 });

    const entries = await listCapacityForSprints([sprintId]);
    expect(entries.length).toBe(1);
    expect(entries[0].sprintId).toBe(sprintId);
  });

  it("removes a capacity entry", async () => {
    const { sprintId, memberId } = await makeSprint();
    const entry = await upsertCapacityEntry(sprintId, memberId, { name: "Alice", plannedPersonDays: 2, actualPersonDays: 2 });
    await removeCapacityEntry(entry.id);
    expect((await listCapacityForSprint(sprintId)).length).toBe(0);
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/repositories/capacityRepository.test.ts`
Expected: FAIL — `upsertCapacityEntry`/`listCapacityForSprints` nicht exportiert.

- [ ] **Step 3: Implementieren**

`src/lib/repositories/capacityRepository.ts` vollständig ersetzen:

```ts
import { prisma } from "@/lib/db";
import type { CapacityEntry } from "@prisma/client";

export interface UpsertCapacityInput {
  name: string;
  plannedPersonDays: number;
  actualPersonDays: number;
}

/** Legt einen Kapazitätseintrag pro (Sprint, Mitglied) an oder aktualisiert ihn. */
export function upsertCapacityEntry(
  sprintId: string,
  teamMemberId: string,
  input: UpsertCapacityInput,
): Promise<CapacityEntry> {
  return prisma.capacityEntry.upsert({
    where: { sprintId_teamMemberId: { sprintId, teamMemberId } },
    create: {
      sprintId,
      teamMemberId,
      name: input.name,
      plannedPersonDays: input.plannedPersonDays,
      actualPersonDays: input.actualPersonDays,
    },
    update: {
      name: input.name,
      plannedPersonDays: input.plannedPersonDays,
      actualPersonDays: input.actualPersonDays,
    },
  });
}

export function listCapacityForSprint(sprintId: string): Promise<CapacityEntry[]> {
  return prisma.capacityEntry.findMany({ where: { sprintId }, orderBy: { name: "asc" } });
}

export function listCapacityForSprints(sprintIds: string[]): Promise<CapacityEntry[]> {
  return prisma.capacityEntry.findMany({ where: { sprintId: { in: sprintIds } } });
}

export function removeCapacityEntry(id: string): Promise<CapacityEntry> {
  return prisma.capacityEntry.delete({ where: { id } });
}
```

- [ ] **Step 4: Test laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/repositories/capacityRepository.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/repositories/capacityRepository.ts src/lib/repositories/capacityRepository.test.ts
git commit -m "feat(repo): capacity upsert by (sprint, member)"
```

---

### Task 2.4: Kapazitäts-Metrik auf Soll/Ist umstellen

**Files:**
- Modify: `src/lib/metrics/capacity.ts`
- Test: `src/lib/metrics/capacity.test.ts`

- [ ] **Step 1: Test ersetzen**

`src/lib/metrics/capacity.test.ts` vollständig ersetzen:

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
  { teamMemberId: "a", name: "Alice", plannedPersonDays: 8, actualPersonDays: 6 },
  { teamMemberId: "b", name: "Bob", plannedPersonDays: 8, actualPersonDays: 8 },
];

describe("calcCapacityEfficiency", () => {
  it("sums planned and actual person days separately", () => {
    const result = calcCapacityEfficiency(sprint(28), entries);
    expect(result.totalPlanned).toBe(16);
    expect(result.totalActual).toBe(14);
  });

  it("computes efficiency on the actual (Ist) person days", () => {
    const result = calcCapacityEfficiency(sprint(28), entries);
    expect(result.efficiency).toBe(2);
  });

  it("returns 0 efficiency when there is no actual capacity (no divide-by-zero)", () => {
    const result = calcCapacityEfficiency(sprint(28), []);
    expect(result.totalPlanned).toBe(0);
    expect(result.totalActual).toBe(0);
    expect(result.efficiency).toBe(0);
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/metrics/capacity.test.ts`
Expected: FAIL — `totalPlanned`/`totalActual` existieren nicht.

- [ ] **Step 3: Implementieren**

`src/lib/metrics/capacity.ts` vollständig ersetzen:

```ts
import type { DomainSprint, DomainCapacityEntry } from "@/lib/domain/types";

export interface CapacityResult {
  totalPlanned: number; // Soll-Personentage
  totalActual: number; // Ist-Personentage
  efficiency: number; // Story Points pro Ist-Personentag
}

/** Soll-/Ist-Summen und Effizienz (completedPoints / Ist-Personentage). */
export function calcCapacityEfficiency(
  sprint: DomainSprint,
  entries: DomainCapacityEntry[],
): CapacityResult {
  const totalPlanned = entries.reduce((sum, e) => sum + e.plannedPersonDays, 0);
  const totalActual = entries.reduce((sum, e) => sum + e.actualPersonDays, 0);
  // Effizienz = Durchsatz pro tatsächlich verfügbarem Personentag (Ist).
  const efficiency = totalActual === 0 ? 0 : sprint.completedPoints / totalActual;
  return { totalPlanned, totalActual, efficiency };
}
```

- [ ] **Step 4: Test laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/metrics/capacity.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/metrics/capacity.ts src/lib/metrics/capacity.test.ts
git commit -m "feat(metrics): capacity totals split into planned/actual"
```

---

### Task 2.5: Loader `loadCapacity` + `loadDashboard` anpassen

**Files:**
- Modify: `src/lib/view/loaders.ts`

- [ ] **Step 1: Imports anpassen**

In `src/lib/view/loaders.ts` die bestehende Capacity-Repository-Importzeile
(`import { listCapacityForSprint } from "@/lib/repositories/capacityRepository";`)
durch die folgende **ersetzen** und `workingDaysBetween` neu hinzufügen (sonst doppelter Import → Typfehler):

```ts
import { listCapacityForSprint, listCapacityForSprints } from "@/lib/repositories/capacityRepository";
import { workingDaysBetween } from "@/lib/metrics/workingDays";
```

- [ ] **Step 2: `loadDashboard` anpassen**

`loadDashboard` ersetzen (Rückgabe nutzt jetzt Ist-Personentage):

```ts
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
    totalPlanned: capacity.totalPlanned,
    totalActual: capacity.totalActual,
    efficiency: capacity.efficiency,
  };
}
```

- [ ] **Step 3: `loadCapacity` ersetzen (Roster-Zeilen + Default-Soll)**

```ts
export async function loadCapacity(sprintId: string) {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: { team: { include: { members: { orderBy: { name: "asc" } } } } },
  });
  if (!sprint) return null;

  const entries = await listCapacityForSprint(sprintId);
  const byMember = new Map(entries.filter((e) => e.teamMemberId).map((e) => [e.teamMemberId as string, e]));
  const defaultSoll =
    sprint.startDate && sprint.endDate ? workingDaysBetween(sprint.startDate, sprint.endDate).length : 0;

  const rows = sprint.team.members.map((m) => {
    const e = byMember.get(m.id);
    return {
      teamMemberId: m.id,
      name: m.name,
      plannedPersonDays: e ? e.plannedPersonDays : defaultSoll,
      actualPersonDays: e ? e.actualPersonDays : defaultSoll,
    };
  });

  const domainEntries = rows.map((r) => ({
    teamMemberId: r.teamMemberId,
    name: r.name,
    plannedPersonDays: r.plannedPersonDays,
    actualPersonDays: r.actualPersonDays,
  }));
  const result = calcCapacityEfficiency(toDomainSprint(sprint), domainEntries);

  return { sprintName: sprint.name, completedPoints: sprint.completedPoints, rows, ...result };
}
```

- [ ] **Step 4: Build-Check**

Run: `npx tsc --noEmit`
Expected: FAIL nur noch in `dashboard/page.tsx` und `capacity/page.tsx` (werden in Task 2.6–2.8 behoben). Falls andere Fehler auftreten, hier beheben.

- [ ] **Step 5: Commit**

```bash
git add src/lib/view/loaders.ts
git commit -m "feat(view): roster-driven loadCapacity and Ist/Soll dashboard totals"
```

---

### Task 2.6: Dashboard-Seite auf Ist-Personentage umstellen

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx:31`

- [ ] **Step 1: KPI-Karte anpassen**

In `src/app/(app)/dashboard/page.tsx` die Kapazitäts-Karte ersetzen:

```tsx
        <KpiCard label="Kapazität" value={`${formatPoints(data.totalActual)} PT`} hint={`Ist · Soll ${formatPoints(data.totalPlanned)} PT`} />
```

- [ ] **Step 2: Build-Check**

Run: `npx tsc --noEmit`
Expected: nur noch `capacity/page.tsx` offen.

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/dashboard/page.tsx
git commit -m "feat(ui): dashboard shows actual person days with planned hint"
```

---

### Task 2.7: `CapacityRoster`-Komponente (ersetzt `CapacityForm`)

**Files:**
- Create: `src/components/CapacityRoster.tsx`
- Test: `src/components/CapacityRoster.test.tsx`
- Delete: `src/components/CapacityForm.tsx`, `src/components/CapacityForm.test.tsx`
- Modify: `src/app/(app)/capacity/actions.ts`

- [ ] **Step 1: Actions ersetzen**

`src/app/(app)/capacity/actions.ts` vollständig ersetzen:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { upsertCapacityEntry } from "@/lib/repositories/capacityRepository";

export async function upsertCapacity(formData: FormData) {
  const sprintId = String(formData.get("sprintId") ?? "");
  const teamMemberId = String(formData.get("teamMemberId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const plannedPersonDays = Number(formData.get("plannedPersonDays") ?? "0");
  const actualPersonDays = Number(formData.get("actualPersonDays") ?? "0");
  if (!sprintId || !teamMemberId || !name) return;
  if (!Number.isFinite(plannedPersonDays) || plannedPersonDays < 0) return;
  if (!Number.isFinite(actualPersonDays) || actualPersonDays < 0) return;

  await upsertCapacityEntry(sprintId, teamMemberId, { name, plannedPersonDays, actualPersonDays });
  revalidatePath("/capacity");
  revalidatePath("/dashboard");
}
```

- [ ] **Step 2: Failing-Test schreiben**

`src/components/CapacityRoster.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/app/(app)/capacity/actions", () => ({ upsertCapacity: vi.fn() }));

import { CapacityRoster } from "./CapacityRoster";

describe("CapacityRoster", () => {
  it("renders one Soll/Ist row per member with the hidden sprintId", () => {
    const { container } = render(
      <CapacityRoster
        sprintId="s123"
        rows={[{ teamMemberId: "m1", name: "Alice", plannedPersonDays: 8, actualPersonDays: 6 }]}
      />,
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    const planned = container.querySelector('input[name="plannedPersonDays"]') as HTMLInputElement;
    const actual = container.querySelector('input[name="actualPersonDays"]') as HTMLInputElement;
    expect(planned.value).toBe("8");
    expect(actual.value).toBe("6");
    const hidden = container.querySelector('input[name="sprintId"]') as HTMLInputElement;
    expect(hidden.value).toBe("s123");
  });

  it("shows a hint when the team has no members", () => {
    render(<CapacityRoster sprintId="s1" rows={[]} />);
    expect(screen.getByText(/keine Mitglieder/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/components/CapacityRoster.test.tsx`
Expected: FAIL — Komponente existiert nicht.

- [ ] **Step 4: Implementieren**

`src/components/CapacityRoster.tsx`:

```tsx
"use client";

import { upsertCapacity } from "@/app/(app)/capacity/actions";

export interface CapacityRosterRow {
  teamMemberId: string;
  name: string;
  plannedPersonDays: number;
  actualPersonDays: number;
}

export function CapacityRoster({ sprintId, rows }: { sprintId: string; rows: CapacityRosterRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400">Dieses Team hat noch keine Mitglieder — unter Einstellungen → Teams anlegen.</p>;
  }

  return (
    <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800">
      {rows.map((r) => (
        <li key={r.teamMemberId} className="p-3 text-sm">
          <form action={upsertCapacity} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="sprintId" value={sprintId} />
            <input type="hidden" name="teamMemberId" value={r.teamMemberId} />
            <input type="hidden" name="name" value={r.name} />
            <span className="min-w-32 font-medium">{r.name}</span>
            <label className="flex flex-col text-xs text-slate-400">
              Soll (PT)
              <input name="plannedPersonDays" type="number" step="0.5" min="0" defaultValue={r.plannedPersonDays} className="mt-1 w-24 rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-100" />
            </label>
            <label className="flex flex-col text-xs text-slate-400">
              Ist (PT)
              <input name="actualPersonDays" type="number" step="0.5" min="0" defaultValue={r.actualPersonDays} className="mt-1 w-24 rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-100" />
            </label>
            <button type="submit" className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500">
              Speichern
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 5: Alte CapacityForm löschen**

```bash
git rm src/components/CapacityForm.tsx src/components/CapacityForm.test.tsx
```

- [ ] **Step 6: Test laufen lassen, grün bestätigen**

Run: `npx vitest run src/components/CapacityRoster.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/CapacityRoster.tsx src/components/CapacityRoster.test.tsx src/app/(app)/capacity/actions.ts
git commit -m "feat(ui): roster-based capacity entry with Ist/Soll, drop CapacityForm"
```

---

### Task 2.8: Kapazitäts-Seite neu aufbauen

**Files:**
- Modify: `src/app/(app)/capacity/page.tsx`

- [ ] **Step 1: Seite ersetzen**

`src/app/(app)/capacity/page.tsx`:

```tsx
import { CapacityRoster } from "@/components/CapacityRoster";
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

      <div className="mb-6 grid grid-cols-4 gap-4">
        <Stat label="PT Soll" value={`${formatPoints(data.totalPlanned)} PT`} />
        <Stat label="PT Ist" value={`${formatPoints(data.totalActual)} PT`} />
        <Stat label="Geliefert" value={`${formatPoints(data.completedPoints)} SP`} />
        <Stat label="Effizienz" value={`${formatPoints(data.efficiency)} SP/PT`} />
      </div>

      <CapacityRoster sprintId={sprintId} rows={data.rows} />
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

- [ ] **Step 2: Build-Check + alle Tests**

Run: `npx tsc --noEmit && npm test`
Expected: PASS. Falls `src/lib/sync/syncTeam.test.ts` an `personDays` scheitert, in Task 2.9 beheben.

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/capacity/page.tsx
git commit -m "feat(ui): capacity page with roster rows and Ist/Soll totals"
```

---

### Task 2.9: `syncTeam`-Test auf neues Kapazitäts-Schema anpassen

**Files:**
- Modify: `src/lib/sync/syncTeam.test.ts:87`

- [ ] **Step 1: Manuellen Kapazitätseintrag im Test anpassen**

In `src/lib/sync/syncTeam.test.ts` die Zeile, die einen Eintrag mit `personDays` erzeugt, ersetzen. Da der Eintrag nun an ein Mitglied gekoppelt ist, zuerst ein Mitglied anlegen:

```ts
    const member = await prisma.teamMember.create({ data: { teamId: team.id, name: "Alice" } });
    await prisma.capacityEntry.create({
      data: { sprintId: sprint.id, teamMemberId: member.id, name: "Alice", plannedPersonDays: 8, actualPersonDays: 8 },
    });
```

- [ ] **Step 2: Test laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/sync/syncTeam.test.ts`
Expected: PASS (die "does not delete manual capacity entries"-Erwartung bleibt 1).

- [ ] **Step 3: Commit**

```bash
git add src/lib/sync/syncTeam.test.ts
git commit -m "test(sync): adapt capacity fixture to planned/actual schema"
```

---

## Phase 3 — Velocity-Tabelle

### Task 3.1: `formatDelta`-Helfer

**Files:**
- Modify: `src/lib/format.ts`
- Test: `src/lib/format.test.ts`

- [ ] **Step 1: Failing-Test ergänzen**

In `src/lib/format.test.ts` Import von `formatDelta` ergänzen und Tests anfügen:

```ts
import { formatDelta } from "./format";
```

```ts
describe("formatDelta", () => {
  it("prefixes a plus for positive values", () => {
    expect(formatDelta(3)).toBe("+3");
  });

  it("uses a real minus sign for negative values", () => {
    expect(formatDelta(-2)).toBe("−2");
  });

  it("shows ±0 for zero", () => {
    expect(formatDelta(0)).toBe("±0");
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/format.test.ts`
Expected: FAIL — `formatDelta` nicht exportiert.

- [ ] **Step 3: Implementieren**

In `src/lib/format.ts` anhängen:

```ts
/** Vorzeichenbehaftete Differenz: "+3", "−2", "±0" (de-DE). */
export function formatDelta(value: number): string {
  if (value === 0) return "±0";
  const sign = value > 0 ? "+" : "−";
  return sign + new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(Math.abs(value));
}
```

- [ ] **Step 4: Test laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/format.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts
git commit -m "feat(format): signed delta formatter"
```

---

### Task 3.2: Velocity-Metrik um PT, Delta und Zeilen-Trend erweitern

**Files:**
- Modify: `src/lib/metrics/velocity.ts`
- Test: `src/lib/metrics/velocity.test.ts`

- [ ] **Step 1: Test ersetzen**

`src/lib/metrics/velocity.test.ts` vollständig ersetzen:

```ts
import { describe, it, expect } from "vitest";
import { calcVelocityTrend, type VelocityInput } from "./velocity";
import type { DomainSprint } from "@/lib/domain/types";

function sprint(name: string, committed: number, completed: number): DomainSprint {
  return {
    id: name, name, state: "CLOSED",
    startDate: null, endDate: null, completeDate: null,
    committedPoints: committed, completedPoints: completed,
  };
}

function input(name: string, committed: number, completed: number, planned: number, actual: number): VelocityInput {
  return { sprint: sprint(name, committed, completed), plannedPersonDays: planned, actualPersonDays: actual };
}

describe("calcVelocityTrend", () => {
  it("maps each sprint to velocity/committed/carriedOver and person days", () => {
    const result = calcVelocityTrend([input("S1", 40, 30, 20, 18)]);
    expect(result.points[0]).toMatchObject({
      sprintName: "S1", velocity: 30, committed: 40, carriedOver: 10,
      plannedPersonDays: 20, actualPersonDays: 18,
    });
  });

  it("computes per-row delta and trend against the previous sprint", () => {
    const result = calcVelocityTrend([
      input("S1", 0, 20, 0, 0),
      input("S2", 0, 35, 0, 0),
      input("S3", 0, 25, 0, 0),
    ]);
    expect(result.points.map((p) => p.velocityDelta)).toEqual([0, 15, -10]);
    expect(result.points.map((p) => p.velocityTrend)).toEqual(["FLAT", "UP", "DOWN"]);
  });

  it("computes average and overall trend (first vs last)", () => {
    const result = calcVelocityTrend([input("S1", 0, 20, 0, 0), input("S2", 0, 30, 0, 0)]);
    expect(result.average).toBe(25);
    expect(result.trend).toBe("UP");
  });

  it("handles empty input", () => {
    const result = calcVelocityTrend([]);
    expect(result.points).toEqual([]);
    expect(result.average).toBe(0);
    expect(result.trend).toBe("FLAT");
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/metrics/velocity.test.ts`
Expected: FAIL — `VelocityInput` und neue Felder fehlen.

- [ ] **Step 3: Implementieren**

`src/lib/metrics/velocity.ts` vollständig ersetzen:

```ts
import type { DomainSprint, TrendDirection } from "@/lib/domain/types";
import { calcCarryOver } from "./carryOver";

export interface VelocityPoint {
  sprintName: string;
  velocity: number;
  committed: number;
  carriedOver: number;
  plannedPersonDays: number;
  actualPersonDays: number;
  velocityDelta: number; // Velocity − Vorsprint-Velocity (erster Sprint: 0)
  velocityTrend: TrendDirection;
}

export interface VelocityInput {
  sprint: DomainSprint;
  plannedPersonDays: number;
  actualPersonDays: number;
}

export interface VelocityTrend {
  points: VelocityPoint[];
  average: number;
  trend: TrendDirection;
}

/** Velocity je Sprint mit PT-Summen, Delta/Trend zum Vorsprint sowie Gesamt-Durchschnitt und -Trend. */
export function calcVelocityTrend(inputs: VelocityInput[]): VelocityTrend {
  const points: VelocityPoint[] = inputs.map((inp, i) => {
    const velocity = inp.sprint.completedPoints;
    const prev = i > 0 ? inputs[i - 1].sprint.completedPoints : null;
    const velocityDelta = prev === null ? 0 : velocity - prev;
    const velocityTrend: TrendDirection =
      velocityDelta > 0 ? "UP" : velocityDelta < 0 ? "DOWN" : "FLAT";
    return {
      sprintName: inp.sprint.name,
      velocity,
      committed: inp.sprint.committedPoints,
      carriedOver: calcCarryOver(inp.sprint),
      plannedPersonDays: inp.plannedPersonDays,
      actualPersonDays: inp.actualPersonDays,
      velocityDelta,
      velocityTrend,
    };
  });

  if (points.length === 0) {
    return { points, average: 0, trend: "FLAT" };
  }

  const average = points.reduce((sum, p) => sum + p.velocity, 0) / points.length;
  const first = points[0].velocity;
  const last = points[points.length - 1].velocity;
  const trend: TrendDirection = last > first ? "UP" : last < first ? "DOWN" : "FLAT";

  return { points, average, trend };
}
```

- [ ] **Step 4: Test laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/metrics/velocity.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/metrics/velocity.ts src/lib/metrics/velocity.test.ts
git commit -m "feat(metrics): velocity points carry person days, delta and row trend"
```

---

### Task 3.3: Loader `loadVelocity` aggregiert Kapazität pro Sprint

**Files:**
- Modify: `src/lib/view/loaders.ts`

- [ ] **Step 1: `loadVelocity` ersetzen**

```ts
export async function loadVelocity(teamId: string) {
  const sprints = (await listSprintsForTeam(teamId)).filter((s) => s.state !== "FUTURE");
  const caps = await listCapacityForSprints(sprints.map((s) => s.id));

  const plannedBySprint = new Map<string, number>();
  const actualBySprint = new Map<string, number>();
  for (const c of caps) {
    plannedBySprint.set(c.sprintId, (plannedBySprint.get(c.sprintId) ?? 0) + c.plannedPersonDays);
    actualBySprint.set(c.sprintId, (actualBySprint.get(c.sprintId) ?? 0) + c.actualPersonDays);
  }

  const inputs = sprints.map((s) => ({
    sprint: toDomainSprint(s),
    plannedPersonDays: plannedBySprint.get(s.id) ?? 0,
    actualPersonDays: actualBySprint.get(s.id) ?? 0,
  }));

  return calcVelocityTrend(inputs);
}
```

- [ ] **Step 2: Build-Check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/view/loaders.ts
git commit -m "feat(view): loadVelocity aggregates planned/actual person days per sprint"
```

---

### Task 3.4: `VelocityTable`-Komponente

**Files:**
- Create: `src/components/VelocityTable.tsx`
- Test: `src/components/VelocityTable.test.tsx`

- [ ] **Step 1: Failing-Test schreiben**

`src/components/VelocityTable.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VelocityTable } from "./VelocityTable";
import type { VelocityPoint } from "@/lib/metrics/velocity";

const points: VelocityPoint[] = [
  { sprintName: "S1", velocity: 20, committed: 25, carriedOver: 5, plannedPersonDays: 20, actualPersonDays: 18, velocityDelta: 0, velocityTrend: "FLAT" },
  { sprintName: "S2", velocity: 30, committed: 30, carriedOver: 0, plannedPersonDays: 20, actualPersonDays: 20, velocityDelta: 10, velocityTrend: "UP" },
];

describe("VelocityTable", () => {
  it("renders a row per sprint with the signed delta and trend marker", () => {
    render(<VelocityTable points={points} />);
    expect(screen.getByText("S1")).toBeInTheDocument();
    expect(screen.getByText("S2")).toBeInTheDocument();
    // S2 stieg um 10 → +10 mit Aufwärts-Symbol
    expect(screen.getByText("+10")).toBeInTheDocument();
    expect(screen.getByText("±0")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/components/VelocityTable.test.tsx`
Expected: FAIL — Komponente existiert nicht.

- [ ] **Step 3: Implementieren**

`src/components/VelocityTable.tsx`:

```tsx
import { formatPoints, formatDelta, trendSymbol } from "@/lib/format";
import type { VelocityPoint } from "@/lib/metrics/velocity";

function trendClass(trend: VelocityPoint["velocityTrend"]): string {
  return trend === "UP" ? "text-emerald-400" : trend === "DOWN" ? "text-red-400" : "text-slate-400";
}

export function VelocityTable({ points }: { points: VelocityPoint[] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-400">
          <th className="py-2 pr-4">Sprint</th>
          <th className="py-2 pr-4 text-right">Commitment (SP)</th>
          <th className="py-2 pr-4 text-right">PT Soll</th>
          <th className="py-2 pr-4 text-right">PT Ist</th>
          <th className="py-2 pr-4 text-right">Velocity (SP)</th>
          <th className="py-2 pr-4 text-right">Δ Vorsprint</th>
        </tr>
      </thead>
      <tbody>
        {points.map((p) => (
          <tr key={p.sprintName} className="border-b border-slate-800/60">
            <td className="py-2 pr-4">{p.sprintName}</td>
            <td className="py-2 pr-4 text-right">{formatPoints(p.committed)}</td>
            <td className="py-2 pr-4 text-right">{formatPoints(p.plannedPersonDays)}</td>
            <td className="py-2 pr-4 text-right">{formatPoints(p.actualPersonDays)}</td>
            <td className="py-2 pr-4 text-right font-medium">{formatPoints(p.velocity)}</td>
            <td className={`py-2 pr-4 text-right ${trendClass(p.velocityTrend)}`}>
              {trendSymbol(p.velocityTrend)} {formatDelta(p.velocityDelta)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Test laufen lassen, grün bestätigen**

Run: `npx vitest run src/components/VelocityTable.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/VelocityTable.tsx src/components/VelocityTable.test.tsx
git commit -m "feat(ui): VelocityTable with planned/actual PT, delta and trend"
```

---

### Task 3.5: Velocity-Seite um Tabelle ergänzen

**Files:**
- Modify: `src/app/(app)/velocity/page.tsx`

- [ ] **Step 1: Tabelle unter dem Chart einfügen**

`src/app/(app)/velocity/page.tsx` ersetzen:

```tsx
import { VelocityChart } from "@/components/charts/VelocityChart";
import { VelocityTable } from "@/components/VelocityTable";
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
    <div className="space-y-8">
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-bold">Velocity</h1>
        <span className="text-sm text-slate-400">
          {trendSymbol(trend.trend)} Ø {formatPoints(trend.average)} SP / Sprint
        </span>
      </div>
      {trend.points.length === 0 ? (
        <p className="text-slate-400">Noch keine abgeschlossenen Sprints.</p>
      ) : (
        <>
          <VelocityChart data={trend.points} average={trend.average} />
          <VelocityTable points={trend.points} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build-Check + alle Tests**

Run: `npx tsc --noEmit && npm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/velocity/page.tsx
git commit -m "feat(ui): velocity page shows chart and table"
```

---

## Phase 4 — Burndown: Ticket-Verlaufslinie (inkl. Sub-Tickets)

### Task 4.0: Verifikation — liefert die Sprint-Issue-API Sub-Tasks?

**Files:** keine Codeänderung; Erkenntnis dokumentieren.

- [ ] **Step 1: Prüfen**

Feststellen, ob `/rest/agile/1.0/sprint/{id}/issue` Sub-Tasks zurückgibt. Quellen in Reihenfolge:
1. Falls eine erreichbare Jira-Instanz/Sandbox vorhanden ist: einen Sprint mit bekanntem Sub-Task abfragen und prüfen, ob dessen Key in der Antwort steht.
2. Andernfalls Jira-Doku konsultieren: Der Agile-Endpoint liefert standardmäßig alle Vorgänge des Sprints inkl. Sub-Tasks, sofern sie dem Board-Filter entsprechen.

- [ ] **Step 2: Entscheidung festhalten**

- Wenn Sub-Tasks enthalten sind: keine Client-Änderung nötig — `countOpenTickets` (Task 4.3) zählt sie automatisch mit. Diese Annahme im Commit-Text von Task 4.5 vermerken.
- Wenn **nicht**: vor Task 4.5 `fetchSprintIssues` erweitern, sodass Sub-Tasks der Sprint-Vorgänge separat geladen und an die Issue-Liste angehängt werden (JQL `parent in (...)` über `/rest/api/3/search` mit `fields=status,issuetype,<storyPointsField>`; `addedAfterSprintStart=false`, Story Points wie geliefert). Diese Erweiterung ist nur für die Ticket-Zählung relevant; SP-Summen bleiben unverändert, da Sub-Tasks i.d.R. 0 SP tragen.

> Für die restlichen Tasks dieser Phase wird angenommen, dass die synchronisierten Issues bereits alle relevanten Tickets (inkl. Sub-Tasks) enthalten.

---

### Task 4.1: Schema-Migration — `BurndownPoint.remainingTickets`

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Schema ändern**

In `prisma/schema.prisma` im Modell `BurndownPoint` nach `remainingBugs` ergänzen:

```prisma
  remainingTickets Int      @default(0)
```

- [ ] **Step 2: Migration erstellen + anwenden**

Run: `npx prisma migrate dev --name burndown_tickets`
Expected: additive Migration (nur `ADD COLUMN ... DEFAULT 0`), angewendet, Client regeneriert.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): persist remainingTickets in burndown snapshots"
```

---

### Task 4.2: Domain-Typ + Mapper für `remainingTickets`

**Files:**
- Modify: `src/lib/domain/types.ts`
- Modify: `src/lib/view/mappers.ts`

- [ ] **Step 1: Domain-Typ erweitern**

In `src/lib/domain/types.ts` `DomainBurndownPoint` um ein Feld erweitern:

```ts
export interface DomainBurndownPoint {
  date: Date;
  remainingPoints: number;
  completedPoints: number;
  remainingBugs: number;
  remainingTickets: number;
}
```

- [ ] **Step 2: Mapper erweitern**

In `src/lib/view/mappers.ts` `toDomainBurndownPoint` ersetzen:

```ts
export function toDomainBurndownPoint(p: BurndownPoint): DomainBurndownPoint {
  return {
    date: p.date,
    remainingPoints: p.remainingPoints,
    completedPoints: p.completedPoints,
    remainingBugs: p.remainingBugs,
    remainingTickets: p.remainingTickets,
  };
}
```

- [ ] **Step 3: Bestehende Burndown-Test-Fixtures auf das Pflichtfeld anpassen**

`remainingTickets` ist jetzt Pflichtfeld auf `DomainBurndownPoint`, daher müssen die vorhandenen Fixtures in `src/lib/metrics/burndown.test.ts` ergänzt werden, sonst schlägt `tsc --noEmit` fehl.

In `calcBurndown` ("passes actual points through sorted by date") beide Objekte ergänzen:

```ts
    const points: DomainBurndownPoint[] = [
      { date: new Date("2026-05-19"), remainingPoints: 30, completedPoints: 10, remainingBugs: 3, remainingTickets: 0 },
      { date: new Date("2026-05-18"), remainingPoints: 40, completedPoints: 0, remainingBugs: 5, remainingTickets: 0 },
    ];
```

Im `calcBugBurndown`-Block den `points`-Helfer ergänzen:

```ts
  const points = (vals: Array<[string, number]>): DomainBurndownPoint[] =>
    vals.map(([d, bugs]) => ({ date: new Date(d), remainingPoints: 0, completedPoints: 0, remainingBugs: bugs, remainingTickets: 0 }));
```

- [ ] **Step 4: Build-Check + Burndown-Tests**

Run: `npx tsc --noEmit && npx vitest run src/lib/metrics/burndown.test.ts`
Expected: PASS (bestehende Tests grün, keine Typfehler).

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/types.ts src/lib/view/mappers.ts src/lib/metrics/burndown.test.ts
git commit -m "feat(domain): carry remainingTickets through burndown point"
```

---

### Task 4.3: `countOpenTickets`-Mapper

**Files:**
- Modify: `src/lib/jira/mapper.ts`
- Test: `src/lib/jira/mapper.test.ts`

- [ ] **Step 1: Failing-Test ergänzen**

In `src/lib/jira/mapper.test.ts` Import um `countOpenTickets` erweitern und Test anfügen (Helfer zum Issue-Bauen analog zu vorhandenen Tests verwenden; falls keiner existiert, inline-Objekt):

```ts
import { countOpenTickets } from "./mapper";
import type { DomainIssue } from "@/lib/domain/types";

function issue(type: string, category: DomainIssue["statusCategory"]): DomainIssue {
  return { jiraKey: "X-1", summary: "X", issueType: type, storyPoints: 0, status: "s", statusCategory: category, resolvedAt: null, addedAfterSprintStart: false };
}

describe("countOpenTickets", () => {
  it("counts all non-done issues including sub-tasks", () => {
    const issues = [
      issue("Story", "DONE"),
      issue("Story", "IN_PROGRESS"),
      issue("Sub-task", "TODO"),
      issue("Bug", "TODO"),
    ];
    expect(countOpenTickets(issues)).toBe(3);
  });

  it("returns 0 when everything is done", () => {
    expect(countOpenTickets([issue("Story", "DONE")])).toBe(0);
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/jira/mapper.test.ts`
Expected: FAIL — `countOpenTickets` nicht exportiert.

- [ ] **Step 3: Implementieren**

In `src/lib/jira/mapper.ts` nach `countOpenBugs` anfügen:

```ts
/** Anzahl offener (nicht-DONE) Vorgänge — alle Typen, inkl. Sub-Tasks. */
export function countOpenTickets(issues: DomainIssue[]): number {
  return issues.filter((i) => i.statusCategory !== "DONE").length;
}
```

- [ ] **Step 4: Test laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/jira/mapper.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/jira/mapper.ts src/lib/jira/mapper.test.ts
git commit -m "feat(metrics): countOpenTickets across all issue types"
```

---

### Task 4.4: `recordBurndownPoint` um `remainingTickets` erweitern

**Files:**
- Modify: `src/lib/repositories/burndownRepository.ts`
- Test: `src/lib/repositories/burndownRepository.test.ts`

- [ ] **Step 1: Test anpassen**

In `src/lib/repositories/burndownRepository.test.ts` die beiden `recordBurndownPoint`-Aufrufe um ein 6. Argument (`remainingTickets`) erweitern und eine Assertion ergänzen:

```ts
    await recordBurndownPoint(sprintId, day, 30, 10, 4, 12);
    await recordBurndownPoint(sprintId, day, 25, 15, 2, 9);

    const points = await listBurndownForSprint(sprintId);
    expect(points.length).toBe(1);
    expect(points[0].remainingPoints).toBe(25);
    expect(points[0].completedPoints).toBe(15);
    expect(points[0].remainingBugs).toBe(2);
    expect(points[0].remainingTickets).toBe(9);
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/repositories/burndownRepository.test.ts`
Expected: FAIL — Funktion akzeptiert kein 6. Argument / Feld fehlt.

- [ ] **Step 3: Implementieren**

`src/lib/repositories/burndownRepository.ts` `recordBurndownPoint` ersetzen:

```ts
export function recordBurndownPoint(
  sprintId: string,
  date: Date,
  remainingPoints: number,
  completedPoints: number,
  remainingBugs: number,
  remainingTickets: number,
): Promise<BurndownPoint> {
  const day = atMidnightUtc(date);
  return prisma.burndownPoint.upsert({
    where: { sprintId_date: { sprintId, date: day } },
    create: { sprintId, date: day, remainingPoints, completedPoints, remainingBugs, remainingTickets },
    update: { remainingPoints, completedPoints, remainingBugs, remainingTickets },
  });
}
```

- [ ] **Step 4: Test laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/repositories/burndownRepository.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/repositories/burndownRepository.ts src/lib/repositories/burndownRepository.test.ts
git commit -m "feat(repo): record remainingTickets in burndown snapshot"
```

---

### Task 4.5: `syncTeam` schreibt offene Tickets

**Files:**
- Modify: `src/lib/sync/syncTeam.ts`
- Test: `src/lib/sync/syncTeam.test.ts`

- [ ] **Step 1: Test erweitern**

In `src/lib/sync/syncTeam.test.ts` im ersten Test (mit den 4 AB-Issues) eine Assertion auf `remainingTickets` ergänzen. Von den 4 Issues sind 2 nicht-DONE (AB-2 TODO, AB-3 TODO):

```ts
    expect(burndown[0].remainingBugs).toBe(1);
    expect(burndown[0].remainingTickets).toBe(2);
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/sync/syncTeam.test.ts`
Expected: FAIL — `remainingTickets` ist 0 (noch nicht geschrieben).

- [ ] **Step 3: Implementieren**

In `src/lib/sync/syncTeam.ts` den Import und den Burndown-Aufruf erweitern:

```ts
import { computeSprintPoints, countOpenBugs, countOpenTickets } from "@/lib/jira/mapper";
```

```ts
      if (s.state === "ACTIVE") {
        await recordBurndownPoint(
          sprint.id,
          new Date(),
          Math.max(0, committedPoints - completedPoints),
          completedPoints,
          countOpenBugs(issues, bugTypes),
          countOpenTickets(issues),
        );
      }
```

- [ ] **Step 4: Test laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/sync/syncTeam.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync/syncTeam.ts src/lib/sync/syncTeam.test.ts
git commit -m "feat(sync): snapshot open-ticket count per active sprint"
```

---

### Task 4.6: `calcTicketBurndown`-Metrik

**Files:**
- Modify: `src/lib/metrics/burndown.ts`
- Test: `src/lib/metrics/burndown.test.ts`

- [ ] **Step 1: Failing-Test ergänzen**

In `src/lib/metrics/burndown.test.ts` einen Block für `calcTicketBurndown` ergänzen (Import erweitern). Muster analog zu den vorhandenen Bug-Burndown-Tests; ein Sprint mit Start/Ende und zwei Snapshots:

```ts
import { calcTicketBurndown } from "./burndown";
```

```ts
describe("calcTicketBurndown", () => {
  it("builds an ideal line from the first snapshot and an actual line from remainingTickets", () => {
    const sprint = {
      id: "s1", name: "S1", state: "ACTIVE" as const,
      startDate: new Date("2026-05-18T00:00:00.000Z"),
      endDate: new Date("2026-05-22T00:00:00.000Z"),
      completeDate: null, committedPoints: 0, completedPoints: 0,
    };
    const points = [
      { date: new Date("2026-05-18T00:00:00.000Z"), remainingPoints: 0, completedPoints: 0, remainingBugs: 0, remainingTickets: 10 },
      { date: new Date("2026-05-20T00:00:00.000Z"), remainingPoints: 0, completedPoints: 0, remainingBugs: 0, remainingTickets: 6 },
    ];
    const result = calcTicketBurndown(sprint, points);
    expect(result.actual.map((p) => p.remainingTickets)).toEqual([10, 6]);
    expect(result.ideal[0].remainingTickets).toBe(10);
    expect(result.ideal[result.ideal.length - 1].remainingTickets).toBe(0);
  });

  it("returns empty lines without snapshots", () => {
    const sprint = {
      id: "s1", name: "S1", state: "ACTIVE" as const,
      startDate: new Date("2026-05-18T00:00:00.000Z"),
      endDate: new Date("2026-05-22T00:00:00.000Z"),
      completeDate: null, committedPoints: 0, completedPoints: 0,
    };
    expect(calcTicketBurndown(sprint, [])).toEqual({ ideal: [], actual: [] });
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/metrics/burndown.test.ts`
Expected: FAIL — `calcTicketBurndown` nicht exportiert.

- [ ] **Step 3: Implementieren**

In `src/lib/metrics/burndown.ts` anfügen:

```ts
export interface TicketBurndownLinePoint {
  date: Date;
  remainingTickets: number;
}

export interface TicketBurndown {
  ideal: TicketBurndownLinePoint[];
  actual: TicketBurndownLinePoint[];
}

/**
 * Ticket-Burndown: Ist-Linie aus den gespeicherten remainingTickets (nach Datum sortiert)
 * und eine lineare Ideallinie vom Ticket-Stand des ersten Snapshots auf 0 über die
 * Arbeitstage. Ohne Sprint-Daten oder ohne Snapshots: leere Linien.
 */
export function calcTicketBurndown(
  sprint: DomainSprint,
  points: DomainBurndownPoint[],
): TicketBurndown {
  if (!sprint.startDate || !sprint.endDate || points.length === 0) {
    return { ideal: [], actual: [] };
  }

  const sorted = [...points].sort((a, b) => a.date.getTime() - b.date.getTime());
  const startTickets = sorted[0].remainingTickets;

  const days = workingDaysBetween(sprint.startDate, sprint.endDate);
  const steps = days.length <= 1 ? 1 : days.length - 1;
  const ideal: TicketBurndownLinePoint[] = days.map((date, i) => ({
    date,
    remainingTickets: Math.max(0, days.length === 1 ? 0 : startTickets * (1 - i / steps)),
  }));

  const actual: TicketBurndownLinePoint[] = sorted.map((p) => ({
    date: p.date,
    remainingTickets: p.remainingTickets,
  }));

  return { ideal, actual };
}
```

- [ ] **Step 4: Test laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/metrics/burndown.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/metrics/burndown.ts src/lib/metrics/burndown.test.ts
git commit -m "feat(metrics): add calcTicketBurndown"
```

---

### Task 4.7: Loader `loadBurndown` liefert Ticket-Burndown

**Files:**
- Modify: `src/lib/view/loaders.ts`

- [ ] **Step 1: Import + Rückgabe erweitern**

In `src/lib/view/loaders.ts` die bestehende burndown-Metrik-Importzeile
(`import { calcBurndown, calcBugBurndown } from "@/lib/metrics/burndown";`) durch die folgende **ersetzen**:

```ts
import { calcBurndown, calcBugBurndown, calcTicketBurndown } from "@/lib/metrics/burndown";
```

```ts
export async function loadBurndown(sprintId: string) {
  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (!sprint) return null;
  const domain = toDomainSprint(sprint);
  const points = (await listBurndownForSprint(sprintId)).map(toDomainBurndownPoint);
  const burndown = calcBurndown(domain, points);
  const bugBurndown = calcBugBurndown(domain, points);
  const ticketBurndown = calcTicketBurndown(domain, points);
  return { sprintName: sprint.name, ...burndown, bugBurndown, ticketBurndown };
}
```

- [ ] **Step 2: Build-Check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/view/loaders.ts
git commit -m "feat(view): expose ticketBurndown from loadBurndown"
```

---

### Task 4.8: Burndown-Seite um Ticket-Abschnitt ergänzen

**Files:**
- Modify: `src/app/(app)/burndown/page.tsx`

- [ ] **Step 1: Dritten Abschnitt einfügen**

In `src/app/(app)/burndown/page.tsx` nach dem Bug-Block (vor dem schließenden `</div>` des Wrappers) die Ticket-Zeilen aufbauen und rendern. Direkt nach dem `bugRows`-Block ergänzen:

```tsx
  const ticketByLabel = new Map<string, BurndownRow>();
  for (const p of data.ticketBurndown.ideal) {
    const label = formatDateShort(p.date);
    ticketByLabel.set(label, { label, ideal: roundTo1(p.remainingTickets), actual: null });
  }
  for (const p of data.ticketBurndown.actual) {
    const label = formatDateShort(p.date);
    const row = ticketByLabel.get(label) ?? { label, ideal: null, actual: null };
    row.actual = p.remainingTickets;
    ticketByLabel.set(label, row);
  }
  const ticketRows = [...ticketByLabel.values()];
```

Und im JSX nach dem Bug-`<div>` einen weiteren Abschnitt anfügen:

```tsx
      <div>
        <h2 className="mb-4 text-xl font-bold">Ticket-Burndown · Offene Tickets</h2>
        {ticketRows.length === 0 ? (
          <p className="text-slate-400">Für diesen Sprint wurden noch keine Ticket-Daten erfasst.</p>
        ) : (
          <BurndownChart data={ticketRows} actualName="Offene Tickets" />
        )}
      </div>
```

- [ ] **Step 2: Build-Check + alle Tests**

Run: `npx tsc --noEmit && npm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/burndown/page.tsx
git commit -m "feat(ui): burndown page shows open-ticket line"
```

---

## Abschluss

- [ ] **Gesamte Suite grün:** `npm test`
- [ ] **Typen sauber:** `npx tsc --noEmit`
- [ ] **Lint:** `npm run lint`
- [ ] Manuelle Sichtprüfung der vier Seiten (Teams, Kapazität, Velocity, Burndown) per `npm run dev`.

## Spec-Abdeckung (Self-Review)

- Team bearbeiten + löschen → Task 1.1, 1.3, 1.4, 1.6
- Personen im Team gespeichert (Roster CRUD) → Task 1.2, 1.5, 1.6
- Kapazität Ist/Soll pro Person/Sprint (Historie) → Task 2.1–2.4
- Auto aus Roster (virtuelle Zeilen + Upsert, Default-Soll = Arbeitstage) → Task 2.5, 2.7, 2.8
- Effizienz auf Ist-Basis, Dashboard-Anpassung → Task 2.4, 2.5, 2.6
- Velocity-Tabelle (PT Soll/Ist, Velocity, Δ +/− mit Trend-Icon) + Chart bleibt → Task 3.1–3.5
- Burndown Ticket-Anzahl inkl. Sub-Tickets als eigene Linie → Task 4.0–4.8
- Sub-Task-SP-Handling (nur Zählung, keine SP-Änderung) → Task 4.0, 4.3
