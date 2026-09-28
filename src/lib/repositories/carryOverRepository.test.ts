import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { createTeam } from "./teamRepository";
import { upsertSprint } from "./sprintRepository";
import { upsertCarryOverMark, listCarryOverForSprint, deleteCarryOverMark, listCarriedIntoSprints } from "./carryOverRepository";

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

describe("carryOverRepository", () => {
  it("upserts one mark per (sprint, jiraKey)", async () => {
    const sprintId = await makeSprint();

    await upsertCarryOverMark(sprintId, "AB-1", true, 5);
    await upsertCarryOverMark(sprintId, "AB-1", true, 3);
    await upsertCarryOverMark(sprintId, "AB-2", false, 0);

    const marks = await listCarryOverForSprint(sprintId);
    expect(marks.map((m) => [m.jiraKey, m.takeAlong, m.remainingPoints])).toEqual([
      ["AB-1", true, 3],
      ["AB-2", false, 0],
    ]);
  });

  it("lists the taken-along marks of a target sprint with their snapshot", async () => {
    const sprintId = await makeSprint();
    const source = await prisma.sprint.findUniqueOrThrow({ where: { id: sprintId } });
    const target = await upsertSprint(source.teamId, {
      jiraSprintId: "101", name: "Sprint 2", state: "FUTURE",
      startDate: null, endDate: null, completeDate: null,
      committedPoints: 0, completedPoints: 0,
    });

    await upsertCarryOverMark(sprintId, "AB-1", true, 3, { targetSprintId: target.id, summary: "Suche", storyPoints: 8 });
    await upsertCarryOverMark(sprintId, "AB-2", false, 5, { targetSprintId: target.id, summary: "Login", storyPoints: 5 });

    const carried = await listCarriedIntoSprints([target.id]);
    expect(carried.map((c) => [c.jiraKey, c.summary, c.storyPoints, c.remainingPoints])).toEqual([
      ["AB-1", "Suche", 8, 3],
    ]);
  });

  it("deletes a mark", async () => {
    const sprintId = await makeSprint();
    await upsertCarryOverMark(sprintId, "AB-1", true, 5);

    await deleteCarryOverMark(sprintId, "AB-1");

    expect(await listCarryOverForSprint(sprintId)).toEqual([]);
  });
});
