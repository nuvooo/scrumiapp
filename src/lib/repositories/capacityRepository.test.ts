import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { createTeam } from "./teamRepository";
import { addMember } from "./teamMemberRepository";
import { upsertSprint } from "./sprintRepository";
import {
  upsertCapacityEntry,
  listCapacityForSprint,
  listCapacityForSprints,
  removeCapacityEntry,
} from "./capacityRepository";

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
  const member = await addMember(team.id, "Alice");
  const sprint = await upsertSprint(team.id, {
    jiraSprintId: "100", name: "Sprint 1", state: "ACTIVE",
    startDate: null, endDate: null, completeDate: null,
    committedPoints: 0, completedPoints: 0,
  });
  return { sprintId: sprint.id, memberId: member.id };
}

describe("capacityRepository", () => {
  it("inserts then updates the same (sprint, member) entry", async () => {
    const { sprintId, memberId } = await makeSprint();

    await upsertCapacityEntry(sprintId, memberId, { name: "Alice", plannedPersonDays: 8, actualPersonDays: 8 });
    await upsertCapacityEntry(sprintId, memberId, { name: "Alice", plannedPersonDays: 8, actualPersonDays: 5 });

    const entries = await listCapacityForSprint(sprintId);
    expect(entries.length).toBe(1);
    expect(entries[0].plannedPersonDays).toBe(8);
    expect(entries[0].actualPersonDays).toBe(5);
  });

  it("lists entries across multiple sprints", async () => {
    const { sprintId, memberId } = await makeSprint();
    await upsertCapacityEntry(sprintId, memberId, { name: "Alice", plannedPersonDays: 8, actualPersonDays: 8 });

    const entries = await listCapacityForSprints([sprintId]);
    expect(entries.length).toBe(1);
    expect(entries[0].sprintId).toBe(sprintId);
  });

  it("removes a capacity entry", async () => {
    const { sprintId, memberId } = await makeSprint();
    const entry = await upsertCapacityEntry(sprintId, memberId, { name: "Alice", plannedPersonDays: 2, actualPersonDays: 2 });
    await removeCapacityEntry(entry.id);
    expect((await listCapacityForSprint(sprintId)).length).toBe(0);
  });
});
