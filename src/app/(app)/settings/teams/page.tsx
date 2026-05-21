import { TeamForm } from "@/components/TeamForm";
import { loadTeams } from "@/lib/view/loaders";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const teams = await loadTeams();

  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Teams / Jira</h1>

      <div className="mb-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <TeamForm />
      </div>

      <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800">
        {teams.length === 0 && <li className="p-3 text-sm text-slate-400">Noch keine Teams angelegt.</li>}
        {teams.map((t) => (
          <li key={t.id} className="flex items-center justify-between p-3 text-sm">
            <span>
              <strong>{t.name}</strong> · Board {t.jiraBoardId} · alle {t.syncIntervalMinutes} min
            </span>
            <span className={t.lastSyncError ? "text-red-400" : "text-slate-400"}>
              {t.lastSyncError
                ? `Sync-Fehler: ${t.lastSyncError}`
                : t.lastSyncedAt
                ? `zuletzt: ${new Date(t.lastSyncedAt).toLocaleString("de-DE")}`
                : "noch nicht synchronisiert"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
