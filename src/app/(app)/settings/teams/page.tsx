import { TeamForm } from "@/components/TeamForm";
import { TeamEditor } from "@/components/TeamEditor";
import { TeamMembers } from "@/components/TeamMembers";
import { TeamSelect } from "@/components/TeamSprintSelector";
import { loadTeamsWithMembers } from "@/lib/view/loaders";
import { resolveTeamId } from "@/lib/view/selection";

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

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; sprint?: string }>;
}) {
  const { team } = await searchParams;
  const teams = await loadTeamsWithMembers();
  const activeTeamId = resolveTeamId(teams, team);

  return (
    <div>
      <h1 className="text-[29px] font-semibold tracking-[-0.028em]">Teams / Jira</h1>
      <div className="mt-[7px] text-[13px] text-muted">
        Aktive Auswahl festlegen, Teams anlegen, Jira-Boards verknüpfen und Sync-Intervalle festlegen
      </div>

      <div className="card mt-6 max-w-[820px] p-[18px]">
        <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">Aktives Team</div>
        <div className="mt-1.5 text-[13px] text-muted">
          Gilt für alle Analyse-Seiten (Dashboard, Burndown, Report …) — den Sprint wählst du direkt auf der Seite
        </div>
        <div className="mt-3">
          <TeamSelect teams={teams.map((t) => ({ id: t.id, name: t.name }))} value={activeTeamId ?? ""} />
        </div>
      </div>

      <div className="card mt-3.5 max-w-[820px] p-[18px]">
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
          <TeamMembers
            teamId={t.id}
            members={t.members.map((m) => ({ id: m.id, name: m.name, defaultPersonDays: m.defaultPersonDays }))}
          />
        </div>
      ))}
    </div>
  );
}
