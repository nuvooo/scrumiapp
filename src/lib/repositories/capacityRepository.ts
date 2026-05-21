import { prisma } from "@/lib/db";
import type { CapacityEntry } from "@prisma/client";

export interface UpsertCapacityInput {
  name: string;
  plannedPersonDays: number;
  actualPersonDays: number;
}

/** Legt einen Kapazitätseintrag pro (Sprint, Mitglied) an oder aktualisiert ihn. */
export function upsertCapacityEntry(
  sprintId: string,
  teamMemberId: string,
  input: UpsertCapacityInput,
): Promise<CapacityEntry> {
  return prisma.capacityEntry.upsert({
    where: { sprintId_teamMemberId: { sprintId, teamMemberId } },
    create: {
      sprintId,
      teamMemberId,
      name: input.name,
      plannedPersonDays: input.plannedPersonDays,
      actualPersonDays: input.actualPersonDays,
    },
    update: {
      name: input.name,
      plannedPersonDays: input.plannedPersonDays,
      actualPersonDays: input.actualPersonDays,
    },
  });
}

export function listCapacityForSprint(sprintId: string): Promise<CapacityEntry[]> {
  return prisma.capacityEntry.findMany({ where: { sprintId }, orderBy: { name: "asc" } });
}

export function listCapacityForSprints(sprintIds: string[]): Promise<CapacityEntry[]> {
  return prisma.capacityEntry.findMany({ where: { sprintId: { in: sprintIds } } });
}

export function removeCapacityEntry(id: string): Promise<CapacityEntry> {
  return prisma.capacityEntry.delete({ where: { id } });
}
