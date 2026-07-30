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
  async fetchBoardColumns() { return []; }
  async fetchBoardSprints(): Promise<MappedSprint[]> { return []; }
  async fetchSprintIssues() { return []; }
  async setStoryPoints() {}
}

class FailingJira implements JiraClient {
  async fetchBoardColumns() { return []; }
  async fetchBoardSprints(): Promise<MappedSprint[]> { throw new Error("boom"); }
  async fetchSprintIssues(): Promise<[]> { return []; }
  async setStoryPoints() {}
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

  it("continues syncing remaining teams when one fails", async () => {
    const a = await createTeam({ name: "A", jiraBoardId: "1" });
    const b = await createTeam({ name: "B", jiraBoardId: "2" });
    teams.push(a.id, b.id);

    let call = 0;
    await syncAllTeams(() => (call++ === 0 ? new FailingJira() : new NoopJira()));

    const ra = await prisma.team.findUnique({ where: { id: a.id } });
    const rb = await prisma.team.findUnique({ where: { id: b.id } });
    expect(ra?.lastSyncError).toMatch(/boom/);
    expect(rb?.lastSyncedAt).not.toBeNull();
  });
});
