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
});
