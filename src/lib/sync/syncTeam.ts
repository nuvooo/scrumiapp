import type { JiraClient } from "@/lib/jira/jiraClient";
import { getBugIssueTypes } from "@/lib/jira/jiraClient";
import { computeSprintPoints, countOpenBugs, countOpenTickets } from "@/lib/jira/mapper";
import { getTeam, updateTeamSyncStatus } from "@/lib/repositories/teamRepository";
import { upsertSprint, listAllSprintsForTeam } from "@/lib/repositories/sprintRepository";
import { replaceIssuesForSprint } from "@/lib/repositories/issueRepository";
import { recordBurndownPoint } from "@/lib/repositories/burndownRepository";
import { syncStarted, syncAdvanced, syncFinished } from "./progress";

/**
 * Synchronisiert ein Team aus Jira. Wirft nicht: Fehler werden in Team.lastSyncError
 * festgehalten, damit ein fehlschlagendes Team andere nicht blockiert. Manuelle
 * Kapazitätsdaten werden nie angefasst.
 *
 * Inkrementell: Sprints, die lokal und in Jira bereits CLOSED sind, werden
 * übersprungen — ihre Issues ändern sich nicht mehr. Dadurch lädt ein Folge-Sync
 * nur aktive, geplante und neu abgeschlossene Sprints.
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
    const known = new Map((await listAllSprintsForTeam(teamId)).map((s) => [s.jiraSprintId, s]));

    const toProcess = sprints.filter((s) => {
      const local = known.get(s.jiraSprintId);
      return !(local && local.state === "CLOSED" && s.state === "CLOSED");
    });
    syncStarted(team.name, toProcess.length, sprints.length - toProcess.length);

    for (const s of toProcess) {
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
      syncAdvanced();
    }

    await updateTeamSyncStatus(teamId, { lastSyncedAt: new Date(), lastSyncError: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[scrumi] syncTeam failed for ${teamId}:`, message);
    await updateTeamSyncStatus(teamId, { lastSyncError: message });
  } finally {
    syncFinished();
  }
}
