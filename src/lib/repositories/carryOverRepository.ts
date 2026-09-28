import { prisma } from "@/lib/db";
import type { CarryOverPlan } from "@prisma/client";

/** Zielsprint und Snapshot (Titel, Original-SP) einer Mitnahme. */
export interface CarryOverSnapshot {
  targetSprintId?: string | null;
  summary?: string;
  storyPoints?: number;
}

export function upsertCarryOverMark(
  sprintId: string,
  jiraKey: string,
  takeAlong: boolean,
  remainingPoints: number,
  snapshot: CarryOverSnapshot = {},
): Promise<CarryOverPlan> {
  return prisma.carryOverPlan.upsert({
    where: { sprintId_jiraKey: { sprintId, jiraKey } },
    create: { sprintId, jiraKey, takeAlong, remainingPoints, ...snapshot },
    update: { takeAlong, remainingPoints, ...snapshot },
  });
}

export function listCarryOverForSprint(sprintId: string): Promise<CarryOverPlan[]> {
  return prisma.carryOverPlan.findMany({ where: { sprintId }, orderBy: { jiraKey: "asc" } });
}

/** Mitgenommene Tickets (takeAlong) mit einem der Sprints als Ziel. */
export function listCarriedIntoSprints(sprintIds: string[]): Promise<CarryOverPlan[]> {
  return prisma.carryOverPlan.findMany({
    where: { targetSprintId: { in: sprintIds }, takeAlong: true },
    orderBy: { jiraKey: "asc" },
  });
}

export function deleteCarryOverMark(sprintId: string, jiraKey: string): Promise<{ count: number }> {
  return prisma.carryOverPlan.deleteMany({ where: { sprintId, jiraKey } });
}
