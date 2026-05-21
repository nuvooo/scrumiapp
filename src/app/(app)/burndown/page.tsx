import { BurndownChart, type BurndownRow } from "@/components/charts/BurndownChart";
import { loadTeams, loadSprints, loadBurndown } from "@/lib/view/loaders";
import { resolveTeamId, resolveSprintId } from "@/lib/view/selection";
import { formatDateShort, roundTo1 } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BurndownPage({
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

  const data = await loadBurndown(sprintId);
  if (!data) return <p className="text-slate-400">Keine Burndown-Daten.</p>;

  const byLabel = new Map<string, BurndownRow>();
  for (const p of data.ideal) {
    const label = formatDateShort(p.date);
    byLabel.set(label, { label, ideal: roundTo1(p.remainingPoints), actual: null });
  }
  for (const p of data.actual) {
    const label = formatDateShort(p.date);
    const row = byLabel.get(label) ?? { label, ideal: null, actual: null };
    row.actual = roundTo1(p.remainingPoints);
    byLabel.set(label, row);
  }
  const rows = [...byLabel.values()];

  const bugByLabel = new Map<string, BurndownRow>();
  for (const p of data.bugBurndown.ideal) {
    const label = formatDateShort(p.date);
    bugByLabel.set(label, { label, ideal: roundTo1(p.remainingBugs), actual: null });
  }
  for (const p of data.bugBurndown.actual) {
    const label = formatDateShort(p.date);
    const row = bugByLabel.get(label) ?? { label, ideal: null, actual: null };
    row.actual = p.remainingBugs;
    bugByLabel.set(label, row);
  }
  const bugRows = [...bugByLabel.values()];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="mb-4 text-2xl font-bold">Burndown · {data.sprintName}</h1>
        {rows.length === 0 ? (
          <p className="text-slate-400">Dieser Sprint hat noch keine Burndown-Punkte.</p>
        ) : (
          <BurndownChart data={rows} />
        )}
      </div>
      <div>
        <h2 className="mb-4 text-xl font-bold">Bug-Burndown · Offene Bugs</h2>
        {bugRows.length === 0 ? (
          <p className="text-slate-400">Für diesen Sprint wurden noch keine Bug-Daten erfasst.</p>
        ) : (
          <BurndownChart data={bugRows} actualName="Offene Bugs" />
        )}
      </div>
    </div>
  );
}
