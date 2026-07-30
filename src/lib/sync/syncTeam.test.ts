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
  async setStoryPoints() {}
  async searchIssues() { return []; }
  async fetchBacklogUnestimated() { return []; }
  async fetchBoardColumns() { return []; }
  constructor(private sprints: MappedSprint[], private issues: Record<string, DomainIssue[]>) {}
  async fetchBoardSprints(): Promise<MappedSprint[]> { return this.sprints; }
  async fetchSprintIssues(_boardId: string, sprintId: string): Promise<DomainIssue[]> { return this.issues[sprintId] ?? []; }
}

class FailingJira implements JiraClient {
  async setStoryPoints() {}
  async searchIssues() { return []; }
  async fetchBacklogUnestimated() { return []; }
  async fetchBoardColumns() { return []; }
  async fetchBoardSprints(): Promise<MappedSprint[]> { throw new Error("401 Unauthorized"); }
  async fetchSprintIssues(): Promise<DomainIssue[]> { return []; }
}

class CountingJira implements JiraClient {
  async setStoryPoints() {}
  async searchIssues() { return []; }
  async fetchBacklogUnestimated() { return []; }
  async fetchBoardColumns() { return []; }
  issueCalls: string[] = [];
  constructor(private sprints: MappedSprint[]) {}
  async fetchBoardSprints(): Promise<MappedSprint[]> { return this.sprints; }
  async fetchSprintIssues(boardId: string, sprintId: string): Promise<DomainIssue[]> {
    this.issueCalls.push(`${boardId}:${sprintId}`);
    return [];
  }
}

describe("syncTeam", () => {
  it("stores sprints, issues, computed points and a burndown point", async () => {
    const team = await createTeam({ name: "Alpha", jiraBoardId: "42" });
    teams.push(team.id);

    const client = new FakeJira(
      [{ jiraSprintId: "100", name: "Sprint 1", state: "ACTIVE",
         startDate: new Date("2026-05-18"), endDate: new Date("2026-05-22"), completeDate: null }],
      { "100": [
        { jiraKey: "AB-1", summary: "AB-1", issueType: "Story", storyPoints: 5, status: "Done", statusCategory: "DONE", resolvedAt: new Date("2026-05-19"), addedAfterSprintStart: false, onBoard: false, assignee: null, statusSince: null },
        { jiraKey: "AB-2", summary: "AB-2", issueType: "Story", storyPoints: 3, status: "To Do", statusCategory: "TODO", resolvedAt: null, addedAfterSprintStart: false, onBoard: true, assignee: null, statusSince: null },
        { jiraKey: "AB-3", summary: "AB-3", issueType: "Bug", storyPoints: 0, status: "To Do", statusCategory: "TODO", resolvedAt: null, addedAfterSprintStart: false, onBoard: true, assignee: null, statusSince: null },
        { jiraKey: "AB-4", summary: "AB-4", issueType: "Bug", storyPoints: 0, status: "Done", statusCategory: "DONE", resolvedAt: null, addedAfterSprintStart: false, onBoard: false, assignee: null, statusSince: null },
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
    // AB-3 (Bug) zählt nicht als Ticket — Bugs werden separat gezählt
    expect(burndown[0].remainingTickets).toBe(1);

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

  it("skips sprints that are already closed locally and in Jira", async () => {
    const team = await createTeam({ name: "Delta", jiraBoardId: "11" });
    teams.push(team.id);

    const client = new CountingJira([
      { jiraSprintId: "300", name: "Alt", state: "CLOSED", startDate: null, endDate: null, completeDate: null },
      { jiraSprintId: "301", name: "Neu", state: "ACTIVE", startDate: null, endDate: null, completeDate: null },
    ]);

    await syncTeam(team.id, client);
    expect(client.issueCalls).toEqual(["11:300", "11:301"]);

    // Zweiter Sync: der abgeschlossene Sprint wird nicht erneut geladen
    await syncTeam(team.id, client);
    expect(client.issueCalls).toEqual(["11:300", "11:301", "11:301"]);
  });

  it("reloads closed sprints when full is set", async () => {
    const team = await createTeam({ name: "Epsilon", jiraBoardId: "11" });
    teams.push(team.id);

    const client = new CountingJira([
      { jiraSprintId: "300", name: "Alt", state: "CLOSED", startDate: null, endDate: null, completeDate: null },
    ]);

    await syncTeam(team.id, client);
    await syncTeam(team.id, client, undefined, { full: true });
    expect(client.issueCalls).toEqual(["11:300", "11:300"]);
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
    const member = await prisma.teamMember.create({ data: { teamId: team.id, name: "Alice" } });
    await prisma.capacityEntry.create({
      data: { sprintId: sprint.id, teamMemberId: member.id, name: "Alice", plannedPersonDays: 8, actualPersonDays: 8 },
    });

    await syncTeam(team.id, client);

    const caps = await prisma.capacityEntry.findMany({ where: { sprintId: sprint.id } });
    expect(caps.length).toBe(1);
  });
});
