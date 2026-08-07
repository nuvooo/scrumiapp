import { BackupPanel } from "@/components/BackupPanel";
import { SyncButton } from "@/components/SyncButton";
import { loadTeams } from "@/lib/view/loaders";

export const dynamic = "force-dynamic";

function formatLastSync(dates: (Date | null)[]): string | null {
  const times = dates.filter((d): d is Date => d !== null).map((d) => d.getTime());
  if (times.length === 0) return null;
  return new Date(Math.max(...times)).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function DataPage() {
  const teams = await loadTeams();
  const lastSyncedLabel = formatLastSync(teams.map((t) => t.lastSyncedAt));

  return (
    <div>
      <h1 className="text-[29px] font-semibold tracking-[-0.028em]">Daten</h1>
      <div className="mt-[7px] text-[13px] text-muted">
        Jira synchronisieren, Datenbestand als Backup exportieren oder aus einer Backup-Datei wiederherstellen
      </div>

      <div className="card mt-6 max-w-[820px] p-[18px]">
        <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">Jira-Synchronisation</div>
        <div className="mt-1.5 text-[13px] text-muted">
          Holt Sprints und Issues aller Teams frisch aus Jira Cloud
        </div>
        <div className="mt-3">
          <SyncButton lastSyncedLabel={lastSyncedLabel} />
        </div>
      </div>

      <BackupPanel />
    </div>
  );
}
