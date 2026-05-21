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
    expect(burndown[0].remainingPoints).toBe(3);

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

    await syncTeam(team.id, client);

    const caps = await prisma.capacityEntry.findMany({ where: { sprintId: sprint.id } });
    expect(caps.length).toBe(1);
  });
});
