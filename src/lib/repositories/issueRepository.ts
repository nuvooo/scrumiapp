import { prisma } from "@/lib/db";
import type { Issue } from "@prisma/client";
import type { DomainIssue } from "@/lib/domain/types";

/**
 * Ersetzt den Issue-Satz eines Sprints atomar (löschen + neu anlegen).
 * Vermeidet verwaiste Issues, wenn welche aus dem Sprint entfernt wurden.
 */
export async function replaceIssuesForSprint(
  sprintId: string,
  issues: DomainIssue[],
): Promise<void> {
  await prisma.$transaction([
    prisma.issue.deleteMany({ where: { sprintId } }),
    prisma.issue.createMany({
      data: issues.map((i) => ({
        sprintId,
        jiraKey: i.jiraKey,
        summary: i.summary,
        issueType: i.issueType,
        storyPoints: i.storyPoints,
        status: i.status,
        statusCategory: i.statusCategory,
        resolvedAt: i.resolvedAt,
        addedAfterSprintStart: i.addedAfterSprintStart,
      })),
    }),
  ]);
}

export function listIssuesForSprint(sprintId: string): Promise<Issue[]> {
  return prisma.issue.findMany({ where: { sprintId }, orderBy: { jiraKey: "asc" } });
}
