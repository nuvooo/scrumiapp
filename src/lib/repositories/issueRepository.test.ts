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
  jiraKey: key, summary: key, issueType: "Story", storyPoints: points, status: "Done", statusCategory: "DONE",
  resolvedAt: null, addedAfterSprintStart: false,
});

describe("issueRepository", () => {
  it("replaces all issues for a sprint", async () => {
    const sprintId = await makeSprint();

    await replaceIssuesForSprint(sprintId, [issue("AB-1", 5), issue("AB-2", 3)]);
    let stored = await listIssuesForSprint(sprintId);
    expect(stored.length).toBe(2);

    await replaceIssuesForSprint(sprintId, [issue("AB-1", 8)]);
    stored = await listIssuesForSprint(sprintId);
    expect(stored.length).toBe(1);
    expect(stored[0].storyPoints).toBe(8);
  });
});
