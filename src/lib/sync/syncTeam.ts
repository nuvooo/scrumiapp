import type { JiraClient } from "@/lib/jira/jiraClient";
import { getBugIssueTypes } from "@/lib/jira/jiraClient";
import { computeSprintPoints, countOpenBugs, countOpenTickets } from "@/lib/jira/mapper";
import { getTeam, updateTeamSyncStatus } from "@/lib/repositories/teamRepository";
import { upsertSprint } from "@/lib/repositories/sprintRepository";
import { replaceIssuesForSprint } from "@/lib/repositories/issueRepository";
import { recordBurndownPoint } from "@/lib/repositories/burndownRepository";

/**
 * Synchronisiert ein Team aus Jira. Wirft nicht: Fehler werden in Team.lastSyncError
 * festgehalten, damit ein fehlschlagendes Team andere nicht blockiert. Manuelle
 * Kapazitätsdaten werden nie angefasst.
 */
export async function syncTeam(
  teamId: string,
  client: JiraClient,
  bugTypes: Set<string> = getBugIssueTypes(),
): Promise<void> {
  const team = await getTeam(teamId);
  if (!team) return;

  try {
    const sprints = await client.fetchBoardSprints(team.jiraBoardId);

    for (const s of sprints) {
      const issues = await client.fetchSprintIssues(s.jiraSprintId);
      const { committedPoints, completedPoints } = computeSprintPoints(issues);

      const sprint = await upsertSprint(teamId, {
        jiraSprintId: s.jiraSprintId,
        name: s.name,
        state: s.state,
        startDate: s.startDate,
        endDate: s.endDate,
        completeDate: s.completeDate,
        committedPoints,
        completedPoints,
      });

      await replaceIssuesForSprint(sprint.id, issues);

      if (s.state === "ACTIVE") {
        await recordBurndownPoint(
          sprint.id,
          new Date(),
          Math.max(0, committedPoints - completedPoints),
          completedPoints,
          countOpenBugs(issues, bugTypes),
          countOpenTickets(issues),
        );
      }
    }

    await updateTeamSyncStatus(teamId, { lastSyncedAt: new Date(), lastSyncError: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[scrumi] syncTeam failed for ${teamId}:`, message);
    await updateTeamSyncStatus(teamId, { lastSyncError: message });
  }
}
