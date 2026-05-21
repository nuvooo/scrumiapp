import { TeamForm } from "@/components/TeamForm";
import { TeamEditor } from "@/components/TeamEditor";
import { TeamMembers } from "@/components/TeamMembers";
import { loadTeamsWithMembers } from "@/lib/view/loaders";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const teams = await loadTeamsWithMembers();

  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Teams / Jira</h1>

      <div className="mb-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <TeamForm />
      </div>

      <div className="space-y-4">
        {teams.length === 0 && <p className="text-sm text-slate-400">Noch keine Teams angelegt.</p>}
        {teams.map((t) => (
          <div key={t.id} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <TeamEditor team={{ id: t.id, name: t.name, jiraBoardId: t.jiraBoardId, syncIntervalMinutes: t.syncIntervalMinutes }} />
            <div className={`mt-2 text-xs ${t.lastSyncError ? "text-red-400" : "text-slate-400"}`}>
              {t.lastSyncError
                ? `Sync-Fehler: ${t.lastSyncError}`
                : t.lastSyncedAt
                ? `zuletzt synchronisiert: ${new Date(t.lastSyncedAt).toLocaleString("de-DE")}`
                : "noch nicht synchronisiert"}
            </div>
            <TeamMembers teamId={t.id} members={t.members.map((m) => ({ id: m.id, name: m.name }))} />
          </div>
        ))}
      </div>
    </div>
  );
}
