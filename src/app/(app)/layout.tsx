import { Sidebar } from "@/components/Sidebar";
import { TeamSprintSelector } from "@/components/TeamSprintSelector";
import { SyncButton } from "@/components/SyncButton";
import { loadTeams, loadSprints } from "@/lib/view/loaders";
import { resolveTeamId } from "@/lib/view/selection";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const teams = await loadTeams();
  const defaultTeamId = resolveTeamId(teams, undefined);
  const sprints = defaultTeamId ? await loadSprints(defaultTeamId) : [];

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-3">
          <TeamSprintSelector
            teams={teams.map((t) => ({ id: t.id, name: t.name }))}
            sprints={sprints.map((s) => ({ id: s.id, name: s.name }))}
          />
          <SyncButton />
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
