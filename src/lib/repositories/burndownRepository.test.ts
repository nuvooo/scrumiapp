import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { createTeam } from "./teamRepository";
import { upsertSprint } from "./sprintRepository";
import { recordBurndownPoint, listBurndownForSprint } from "./burndownRepository";

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

describe("burndownRepository", () => {
  it("upserts one point per (sprint, date)", async () => {
    const sprintId = await makeSprint();
    const day = new Date("2026-05-20T00:00:00.000Z");

    await recordBurndownPoint(sprintId, day, 30, 10, 4, 12);
    await recordBurndownPoint(sprintId, day, 25, 15, 2, 9);

    const points = await listBurndownForSprint(sprintId);
    expect(points.length).toBe(1);
    expect(points[0].remainingPoints).toBe(25);
    expect(points[0].completedPoints).toBe(15);
    expect(points[0].remainingBugs).toBe(2);
    expect(points[0].remainingTickets).toBe(9);
  });
});
