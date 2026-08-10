import { prisma } from "@/lib/db";
import type { CarryOverPlan } from "@prisma/client";

export function upsertCarryOverMark(
  sprintId: string,
  jiraKey: string,
  takeAlong: boolean,
  remainingPoints: number,
): Promise<CarryOverPlan> {
  return prisma.carryOverPlan.upsert({
    where: { sprintId_jiraKey: { sprintId, jiraKey } },
    create: { sprintId, jiraKey, takeAlong, remainingPoints },
    update: { takeAlong, remainingPoints },
  });
}

export function listCarryOverForSprint(sprintId: string): Promise<CarryOverPlan[]> {
  return prisma.carryOverPlan.findMany({ where: { sprintId }, orderBy: { jiraKey: "asc" } });
}

export function deleteCarryOverMark(sprintId: string, jiraKey: string): Promise<{ count: number }> {
  return prisma.carryOverPlan.deleteMany({ where: { sprintId, jiraKey } });
}
