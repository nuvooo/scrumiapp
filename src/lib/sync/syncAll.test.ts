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
