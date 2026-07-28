import { TeamForm } from "@/components/TeamForm";
import { TeamEditor } from "@/components/TeamEditor";
import { TeamMembers } from "@/components/TeamMembers";
import { loadTeamsWithMembers } from "@/lib/view/loaders";

export const dynamic = "force-dynamic";

function syncStatus(team: { lastSyncError: string | null; lastSyncedAt: Date | null }) {
  if (team.lastSyncError) return { text: `Sync-Fehler: ${team.lastSyncError}`, tone: "error" as const };
  if (team.lastSyncedAt)
    return {
      text: `zuletzt synchronisiert: ${team.lastSyncedAt.toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`,
      tone: "ok" as const,
    };
  return { text: "noch nicht synchronisiert", tone: "none" as const };
}

export default async function TeamsPage() {
  const teams = await loadTeamsWithMembers();

  return (
    <div>
      <h1 className="text-[29px] font-semibold tracking-[-0.028em]">Teams / Jira</h1>
      <div className="mt-[7px] text-[13px] text-muted">
        Teams anlegen, Jira-Boards verknüpfen und Sync-Intervalle festlegen
      </div>

      <div className="card mt-6 max-w-[820px] p-[18px]">
        <TeamForm />
      </div>

      {teams.length === 0 && <p className="mt-4 text-sm text-muted">Noch keine Teams angelegt.</p>}
      {teams.map((t) => (
        <div key={t.id} className="card mt-3.5 max-w-[820px] p-[18px]">
          <TeamEditor
            team={{
              id: t.id,
              name: t.name,
              jiraBoardId: t.jiraBoardId,
              syncIntervalMinutes: t.syncIntervalMinutes,
              metricsSince: t.metricsSince ? t.metricsSince.toISOString().slice(0, 10) : null,
            }}
            status={syncStatus(t)}
          />
          <TeamMembers teamId={t.id} members={t.members.map((m) => ({ id: m.id, name: m.name }))} />
        </div>
      ))}
    </div>
  );
}
