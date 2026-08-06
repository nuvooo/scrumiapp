import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { ProfileDock } from "@/components/ProfileDock";
import { TeamSprintSelector } from "@/components/TeamSprintSelector";
import { SyncButton } from "@/components/SyncButton";
import { loadTeams, loadSprints } from "@/lib/view/loaders";
import { resolveTeamId } from "@/lib/view/selection";

function jiraHostFromEnv(): string | null {
  const base = process.env.JIRA_BASE_URL;
  if (!base) return null;
  try {
    return new URL(base).host;
  } catch {
    return base;
  }
}

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

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const teams = await loadTeams();
  const defaultTeamId = resolveTeamId(teams, undefined);
  const sprints = defaultTeamId ? await loadSprints(defaultTeamId) : [];
  const lastSyncedLabel = formatLastSync(teams.map((t) => t.lastSyncedAt));

  return (
    <div className="flex min-h-screen">
      <Sidebar jiraHost={jiraHostFromEnv()} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-line bg-[rgba(8,11,17,0.66)] px-4 py-3.5 backdrop-blur-xl lg:px-[34px]">
          <MobileNav jiraHost={jiraHostFromEnv()} />
          <TeamSprintSelector
            teams={teams.map((t) => ({ id: t.id, name: t.name }))}
            sprints={sprints.map((s) => ({
              id: s.id,
              name: s.state === "ACTIVE" ? `${s.name} (aktiv)` : s.state === "FUTURE" ? `${s.name} (geplant)` : s.name,
            }))}
          />
          <div className="ml-auto">
            <SyncButton lastSyncedLabel={lastSyncedLabel} />
          </div>
        </header>
        <main className="max-w-[1320px] flex-1 px-4 pb-10 pt-5 lg:px-[34px] lg:pb-[60px] lg:pt-[34px]">{children}</main>
      </div>
      {/* Profil immer unten links sichtbar (dockt in der Sidebar an) */}
      <ProfileDock />
    </div>
  );
}
