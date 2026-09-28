import type { JiraClient, MappedSprint } from "@/lib/jira/jiraClient";
import { getBugIssueTypes } from "@/lib/jira/jiraClient";
import { computeSprintPoints, countOpenBugs, countOpenTickets } from "@/lib/jira/mapper";
import { getTeam, updateTeamSyncStatus, saveTeamBoardColumns } from "@/lib/repositories/teamRepository";
import { upsertSprint, listAllSprintsForTeam } from "@/lib/repositories/sprintRepository";
import { replaceIssuesForSprint } from "@/lib/repositories/issueRepository";
import { recordBurndownPoint } from "@/lib/repositories/burndownRepository";
import { hasDaily, snapshotDay } from "./daily";
import { syncStarted, syncAdvanced, syncFinished } from "./progress";

/** Tag des Burndown-Punkts für diesen Sprint-Sync oder null (kein Punkt). */
function burndownDay(
  s: MappedSprint,
  justClosed: boolean,
  dailyMode: boolean,
  snapshot: boolean,
  now: Date,
): Date | null {
  if (!dailyMode) return s.state === "ACTIVE" ? now : null;
  if (s.state === "ACTIVE") return snapshot ? snapshotDay(now, s.startDate) : null;
  return justClosed ? s.completeDate ?? now : null;
}

export interface SyncOptions {
  /** Auch abgeschlossene Sprints neu laden (z. B. nach Filter-/Feldänderungen). */
  full?: boolean;
  /** Daily-Snapshot: Burndown-Stand als Ergebnis des Vortags festhalten. */
  snapshot?: boolean;
  /** Zeitpunkt des Syncs (für Tests). */
  now?: Date;
}

/**
 * Synchronisiert ein Team aus Jira. Wirft nicht: Fehler werden in Team.lastSyncError
 * festgehalten, damit ein fehlschlagendes Team andere nicht blockiert. Manuelle
 * Kapazitätsdaten werden nie angefasst.
 *
 * Inkrementell: Abgeschlossene Sprints sind gespeichert und ändern sich nicht
 * mehr. Ein Folge-Sync fragt Jira daher nur nach aktiven und geplanten Sprints;
 * lokal noch offene Sprints, die Jira dort nicht mehr führt, werden einzeln
 * nachgeladen (einmalig, sie sind inzwischen abgeschlossen). Der erste Sync und
 * { full: true } laden alle Sprints.
 *
 * Burndown: Ohne Daily-Einstellung schreibt jeder Sync den heutigen Stand. Mit
 * Daily entsteht ein Punkt nur beim Snapshot kurz vor dem Daily (datiert auf den
 * Vortag) und beim Abschluss eines Sprints — so verfälschen Syncs im Laufe des
 * Tages das Ergebnis nicht.
 */
export async function syncTeam(
  teamId: string,
  client: JiraClient,
  bugTypes: Set<string> = getBugIssueTypes(),
  opts: SyncOptions = {},
): Promise<void> {
  const team = await getTeam(teamId);
  if (!team) return;
  const now = opts.now ?? new Date();
  const dailyMode = hasDaily(team);

  try {
    await saveTeamBoardColumns(teamId, await client.fetchBoardColumns(team.jiraBoardId));
    const localSprints = await listAllSprintsForTeam(teamId);
    const known = new Map(localSprints.map((s) => [s.jiraSprintId, s]));
    const incremental = !opts.full && localSprints.length > 0;

    let sprints: MappedSprint[];
    if (incremental) {
      sprints = await client.fetchBoardSprints(team.jiraBoardId, ["active", "future"]);
      const listed = new Set(sprints.map((s) => s.jiraSprintId));
      for (const local of localSprints) {
        if (local.state === "CLOSED" || listed.has(local.jiraSprintId)) continue;
        const current = await client.fetchSprint(local.jiraSprintId);
        if (current) sprints.push(current);
      }
    } else {
      sprints = await client.fetchBoardSprints(team.jiraBoardId);
    }

    const toProcess = sprints.filter((s) => {
      if (opts.full) return true;
      const local = known.get(s.jiraSprintId);
      return !(local && local.state === "CLOSED" && s.state === "CLOSED");
    });
    const skipped = incremental
      ? localSprints.filter((s) => s.state === "CLOSED").length
      : sprints.length - toProcess.length;
    syncStarted(team.name, toProcess.length, skipped);

    for (const s of toProcess) {
      const issues = await client.fetchSprintIssues(team.jiraBoardId, s.jiraSprintId);
      const { committedPoints, completedPoints } = computeSprintPoints(issues, {
        start: s.startDate,
        end: s.completeDate ?? s.endDate,
      });

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

      const justClosed = s.state === "CLOSED" && known.get(s.jiraSprintId)?.state === "ACTIVE";
      const day = burndownDay(s, justClosed, dailyMode, opts.snapshot ?? false, now);
      if (day) {
        await recordBurndownPoint(
          sprint.id,
          day,
          Math.max(0, committedPoints - completedPoints),
          completedPoints,
          countOpenBugs(issues, bugTypes),
          countOpenTickets(issues, bugTypes),
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
