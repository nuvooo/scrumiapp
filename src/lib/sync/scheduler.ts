import cron from "node-cron";
import { syncAllTeams } from "./syncAll";
import { syncTeam } from "./syncTeam";
import { isSnapshotMinute, DAILY_TIME_ZONE } from "./daily";
import { withSyncLock } from "./lock";
import { listTeams } from "@/lib/repositories/teamRepository";
import { JiraCloudClient, jiraConfigFromEnv } from "@/lib/jira/jiraClient";

let started = false;
let running = false;

/**
 * Startet den Intervall-Sync und die minütliche Daily-Prüfung. Das Intervall
 * (Minuten) kommt aus SYNC_DEFAULT_INTERVAL. Idempotent: mehrfaches Aufrufen
 * startet nur einen Job.
 */
export function startScheduler(): void {
  if (started) return;
  started = true;

  const minutes = Number(process.env.SYNC_DEFAULT_INTERVAL ?? "60");
  const expression = `*/${Math.max(1, minutes)} * * * *`;

  cron.schedule(expression, async () => {
    if (running) return;
    running = true;
    try {
      await withSyncLock(() => syncAllTeams());
    } catch (err) {
      console.error("[scrumi] sync run failed:", err);
    } finally {
      running = false;
    }
  });

  // Daily-Snapshot: eine Minute vor dem Daily synchronisieren und den
  // Burndown-Stand des Vortags festhalten.
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      const due = (await listTeams()).filter((t) => isSnapshotMinute(t, now));
      for (const team of due) {
        console.log(`[scrumi] daily snapshot for ${team.name}`);
        await withSyncLock(() =>
          syncTeam(team.id, new JiraCloudClient(jiraConfigFromEnv()), undefined, { snapshot: true, now }),
        );
      }
    } catch (err) {
      console.error("[scrumi] daily snapshot failed:", err);
    }
  });

  console.log(`[scrumi] sync scheduler started (every ${minutes} min, daily snapshots in ${DAILY_TIME_ZONE})`);
}
