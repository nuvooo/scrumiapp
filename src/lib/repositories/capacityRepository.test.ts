import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { createTeam } from "./teamRepository";
import { upsertSprint } from "./sprintRepository";
import { addCapacityEntry, listCapacityForSprint } from "./capacityRepository";

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

describe("capacityRepository", () => {
  it("adds capacity entries for a sprint", async () => {
    const sprintId = await makeSprint();
    await addCapacityEntry(sprintId, { name: "Alice", personDays: 8 });
    await addCapacityEntry(sprintId, { name: "Bob", personDays: 6 });

    const entries = await listCapacityForSprint(sprintId);
    expect(entries.length).toBe(2);
    expect(entries.reduce((s, e) => s + e.personDays, 0)).toBe(14);
  });
});
