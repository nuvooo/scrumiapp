import cron from "node-cron";
import { syncAllTeams } from "./syncAll";

let started = false;

/**
 * Startet den Intervall-Sync. Das Intervall (Minuten) kommt aus SYNC_DEFAULT_INTERVAL.
 * Idempotent: mehrfaches Aufrufen startet nur einen Job.
 */
export function startScheduler(): void {
  if (started) return;
  started = true;

  const minutes = Number(process.env.SYNC_DEFAULT_INTERVAL ?? "60");
  const expression = `*/${Math.max(1, minutes)} * * * *`;

  cron.schedule(expression, () => {
    syncAllTeams().catch((err) => console.error("[scrumi] sync run failed:", err));
  });

  console.log(`[scrumi] sync scheduler started (every ${minutes} min)`);
}
