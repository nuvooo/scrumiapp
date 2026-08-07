import { BurndownChart, ChartLegend, type BurndownRow } from "@/components/charts/BurndownChart";
import { BurndownTabs } from "@/components/charts/BurndownTabs";
import { Celebration } from "@/components/Celebration";
import { SprintSelect } from "@/components/TeamSprintSelector";
import { loadTeams, loadSprints, loadBurndown, loadCelebration } from "@/lib/view/loaders";
import { resolveTeamId, resolveSprintId, sprintOptions } from "@/lib/view/selection";
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
  if (!teamId) return <p className="text-muted">Kein Team vorhanden.</p>;

  const sprints = await loadSprints(teamId);
  const sprintId = resolveSprintId(sprints, sprint);
  if (!sprintId) return <p className="text-muted">Kein Sprint vorhanden.</p>;

  const data = await loadBurndown(sprintId);
  if (!data) return <p className="text-muted">Keine Burndown-Daten.</p>;

  const celebration = await loadCelebration(sprintId);

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

  const ticketByLabel = new Map<string, BurndownRow>();
  for (const p of data.ticketBurndown.ideal) {
    const label = formatDateShort(p.date);
    ticketByLabel.set(label, { label, ideal: roundTo1(p.remainingTickets), actual: null });
  }
  for (const p of data.ticketBurndown.actual) {
    const label = formatDateShort(p.date);
    const row = ticketByLabel.get(label) ?? { label, ideal: null, actual: null };
    row.actual = p.remainingTickets;
    ticketByLabel.set(label, row);
  }
  const ticketRows = [...ticketByLabel.values()];

  return (
    <div>
      <Celebration effect={celebration} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[29px] font-semibold tracking-[-0.028em]">Burndown</h1>
          <div className="mt-[7px] text-[13px] text-muted">
            {data.sprintName} · Restaufwand über die Arbeitstage des Sprints
          </div>
        </div>
        <SprintSelect sprints={sprintOptions(sprints)} value={sprintId} />
      </div>

      <div className="card mt-6 p-[18px]">
        <BurndownTabs ticketRows={ticketRows} storyRows={rows} />
      </div>

      <div className="card mt-3.5 p-[18px]">
        <div className="flex flex-wrap items-center gap-4">
          <div className="text-sm font-semibold">Bug-Burndown · Offene Bugs</div>
          <ChartLegend
            items={[
              { type: "dash", color: "#6B7590", label: "Ideallinie" },
              { type: "line", color: "#F2A65A", label: "Offene Bugs" },
            ]}
          />
        </div>
        {bugRows.length === 0 ? (
          <p className="mt-4 text-muted">Für diesen Sprint wurden noch keine Bug-Daten erfasst.</p>
        ) : (
          <BurndownChart data={bugRows} unit="Bugs" color="warn" height={240} />
        )}
      </div>
    </div>
  );
}
