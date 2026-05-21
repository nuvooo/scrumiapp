import { KpiCard } from "@/components/KpiCard";
import { loadTeams, loadSprints, loadDashboard } from "@/lib/view/loaders";
import { resolveTeamId, resolveSprintId } from "@/lib/view/selection";
import { formatPoints } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; sprint?: string }>;
}) {
  const { team, sprint } = await searchParams;
  const teams = await loadTeams();
  const teamId = resolveTeamId(teams, team);
  if (!teamId) return <Empty />;

  const sprints = await loadSprints(teamId);
  const sprintId = resolveSprintId(sprints, sprint);
  if (!sprintId) return <Empty />;

  const data = await loadDashboard(sprintId);
  if (!data) return <Empty />;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{data.sprintName}</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Velocity" value={formatPoints(data.velocity)} hint="erledigte Story Points" />
        <KpiCard label="Commitment" value={formatPoints(data.committed)} hint={`${formatPoints(data.carriedOver)} mitgenommen`} />
        <KpiCard label="Kapazität" value={`${formatPoints(data.totalActual)} PT`} hint={`Ist · Soll ${formatPoints(data.totalPlanned)} PT`} />
        <KpiCard label="Effizienz" value={formatPoints(data.efficiency)} hint="SP pro Personentag" />
      </div>
    </div>
  );
}

function Empty() {
  return (
    <p className="text-slate-400">
      Noch keine Daten. Lege unter <strong>Teams / Jira</strong> ein Team an und synchronisiere.
    </p>
  );
}
