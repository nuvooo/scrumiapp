import { CapacityRoster } from "@/components/CapacityRoster";
import { loadTeams, loadSprints, loadCapacity } from "@/lib/view/loaders";
import { resolveTeamId, resolveSprintId } from "@/lib/view/selection";
import { formatPoints } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CapacityPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; sprint?: string }>;
}) {
  const { team, sprint } = await searchParams;
  const teams = await loadTeams();
  const teamId = resolveTeamId(teams, team);
  if (!teamId) return <p className="text-slate-400">Kein Team vorhanden.</p>;

  const sprints = await loadSprints(teamId);
  const sprintId = resolveSprintId(sprints, sprint);
  if (!sprintId) return <p className="text-slate-400">Kein Sprint vorhanden.</p>;

  const data = await loadCapacity(sprintId);
  if (!data) return <p className="text-slate-400">Kein Sprint gefunden.</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">Kapazität · {data.sprintName}</h1>

      <div className="mb-6 grid grid-cols-4 gap-4">
        <Stat label="PT Soll" value={`${formatPoints(data.totalPlanned)} PT`} />
        <Stat label="PT Ist" value={`${formatPoints(data.totalActual)} PT`} />
        <Stat label="Geliefert" value={`${formatPoints(data.completedPoints)} SP`} />
        <Stat label="Effizienz" value={`${formatPoints(data.efficiency)} SP/PT`} />
      </div>

      <CapacityRoster sprintId={sprintId} rows={data.rows} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
