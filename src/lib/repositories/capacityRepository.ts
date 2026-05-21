import { prisma } from "@/lib/db";
import type { CapacityEntry } from "@prisma/client";

export interface CapacityEntryInput {
  name: string;
  personDays: number;
  teamMemberId?: string | null;
}

export function setCapacityEntry(
  sprintId: string,
  input: CapacityEntryInput,
): Promise<CapacityEntry> {
  return prisma.capacityEntry.create({
    data: {
      sprintId,
      name: input.name,
      personDays: input.personDays,
      teamMemberId: input.teamMemberId ?? null,
    },
  });
}

export function listCapacityForSprint(sprintId: string): Promise<CapacityEntry[]> {
  return prisma.capacityEntry.findMany({
    where: { sprintId },
    orderBy: { name: "asc" },
  });
}
