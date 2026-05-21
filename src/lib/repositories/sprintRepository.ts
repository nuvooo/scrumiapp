import { prisma } from "@/lib/db";
import type { Sprint, SprintState } from "@prisma/client";

export interface UpsertSprintInput {
  jiraSprintId: string;
  name: string;
  state: SprintState;
  startDate: Date | null;
  endDate: Date | null;
  completeDate: Date | null;
  committedPoints: number;
  completedPoints: number;
}

/** Legt einen Sprint an oder aktualisiert ihn anhand (teamId, jiraSprintId). */
export function upsertSprint(teamId: string, input: UpsertSprintInput): Promise<Sprint> {
  return prisma.sprint.upsert({
    where: { teamId_jiraSprintId: { teamId, jiraSprintId: input.jiraSprintId } },
    create: { teamId, ...input },
    update: {
      name: input.name,
      state: input.state,
      startDate: input.startDate,
      endDate: input.endDate,
      completeDate: input.completeDate,
      committedPoints: input.committedPoints,
      completedPoints: input.completedPoints,
    },
  });
}

export function listSprintsForTeam(teamId: string): Promise<Sprint[]> {
  return prisma.sprint.findMany({
    where: { teamId },
    orderBy: { startDate: "asc" },
  });
}
