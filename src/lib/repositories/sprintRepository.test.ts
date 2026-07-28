import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { createTeam } from "./teamRepository";
import { upsertSprint, listSprintsForTeam } from "./sprintRepository";

const teams: string[] = [];

afterEach(async () => {
  if (teams.length) {
    await prisma.team.deleteMany({ where: { id: { in: teams } } });
    teams.length = 0;
  }
});

describe("sprintRepository", () => {
  it("creates a sprint on first upsert", async () => {
    const team = await createTeam({ name: "Alpha", jiraBoardId: "42" });
    teams.push(team.id);

    const sprint = await upsertSprint(team.id, {
      jiraSprintId: "100", name: "Sprint 1", state: "ACTIVE",
      startDate: null, endDate: null, completeDate: null,
      committedPoints: 40, completedPoints: 0,
    });

    expect(sprint.name).toBe("Sprint 1");
    expect(sprint.committedPoints).toBe(40);
  });

  it("updates the same sprint on second upsert (idempotent by jiraSprintId)", async () => {
    const team = await createTeam({ name: "Alpha", jiraBoardId: "42" });
    teams.push(team.id);

    const first = await upsertSprint(team.id, {
      jiraSprintId: "100", name: "Sprint 1", state: "ACTIVE",
      startDate: null, endDate: null, completeDate: null,
      committedPoints: 40, completedPoints: 0,
    });
    const second = await upsertSprint(team.id, {
      jiraSprintId: "100", name: "Sprint 1", state: "CLOSED",
      startDate: null, endDate: null, completeDate: null,
      committedPoints: 40, completedPoints: 34,
    });

    expect(second.id).toBe(first.id);
    expect(second.state).toBe("CLOSED");
    expect(second.completedPoints).toBe(34);

    const all = await listSprintsForTeam(team.id);
    expect(all.length).toBe(1);
  });

  it("filters sprints before the team's metricsSince cutoff, keeping undated ones", async () => {
    const team = await createTeam({ name: "Alpha", jiraBoardId: "42" });
    teams.push(team.id);

    const base = {
      state: "CLOSED" as const,
      endDate: null,
      completeDate: null,
      committedPoints: 0,
      completedPoints: 0,
    };
    await upsertSprint(team.id, { ...base, jiraSprintId: "1", name: "Alt", startDate: new Date(Date.UTC(2026, 0, 5)) });
    await upsertSprint(team.id, { ...base, jiraSprintId: "2", name: "Neu", startDate: new Date(Date.UTC(2026, 3, 1)) });
    await upsertSprint(team.id, { ...base, jiraSprintId: "3", name: "Ohne Datum", startDate: null });

    // Ohne Stichtag: alle drei
    expect((await listSprintsForTeam(team.id)).length).toBe(3);

    await prisma.team.update({ where: { id: team.id }, data: { metricsSince: new Date(Date.UTC(2026, 2, 1)) } });

    const filtered = await listSprintsForTeam(team.id);
    expect(filtered.map((s) => s.name).sort()).toEqual(["Neu", "Ohne Datum"]);
  });
});
