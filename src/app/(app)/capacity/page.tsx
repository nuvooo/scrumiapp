import { CapacityForm } from "@/components/CapacityForm";
import { deleteCapacity } from "./actions";
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

      <div className="mb-6 grid grid-cols-3 gap-4">
        <Stat label="Personentage" value={`${formatPoints(data.totalPersonDays)} PT`} />
        <Stat label="Geliefert" value={`${formatPoints(data.completedPoints)} SP`} />
        <Stat label="Effizienz" value={`${formatPoints(data.efficiency)} SP/PT`} />
      </div>

      <div className="mb-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <CapacityForm sprintId={sprintId} />
      </div>

      <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800">
        {data.entries.length === 0 && <li className="p-3 text-sm text-slate-400">Noch keine Einträge.</li>}
        {data.entries.map((e) => (
          <li key={e.id} className="flex items-center justify-between p-3 text-sm">
            <span>{e.name}</span>
            <span className="flex items-center gap-4">
              <span>{formatPoints(e.personDays)} PT</span>
              <form action={deleteCapacity}>
                <input type="hidden" name="id" value={e.id} />
                <button className="text-slate-500 hover:text-red-400" aria-label="Löschen">✕</button>
              </form>
            </span>
          </li>
        ))}
      </ul>
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
