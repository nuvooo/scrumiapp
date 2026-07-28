import { CapacityRoster } from "@/components/CapacityRoster";
import { KpiCard } from "@/components/KpiCard";
import { loadTeams, loadSprints, loadCapacity } from "@/lib/view/loaders";
import { resolveTeamId, resolveSprintId } from "@/lib/view/selection";
import { formatPoints, formatDelta } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CapacityPage({
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

  const data = await loadCapacity(sprintId);
  if (!data) return <p className="text-muted">Kein Sprint gefunden.</p>;

  const delta = data.totalActual - data.totalPlanned;

  return (
    <div>
      <h1 className="text-[29px] font-semibold tracking-[-0.028em]">Kapazität</h1>
      <div className="mt-[7px] text-[13px] text-muted">Personentage je Teammitglied für {data.sprintName}</div>

      <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
        <KpiCard size="md" label="PT Soll" value={formatPoints(data.totalPlanned)} hint="geplante Personentage" />
        <KpiCard size="md" label="PT Ist" value={formatPoints(data.totalActual)} hint={`${formatDelta(delta)} PT gegenüber Plan`} />
        <KpiCard size="md" label="Geliefert" value={formatPoints(data.completedPoints)} unit="SP" hint="abgeschlossene Story Points" />
        <KpiCard size="md" label="Effizienz" value={formatPoints(data.efficiency)} unit="SP/PT" hint="Story Points pro Personentag" />
        <KpiCard
          size="md"
          label="Prognose"
          value={data.forecast ? formatPoints(data.forecast.possiblePoints) : "–"}
          unit={data.forecast ? "SP" : undefined}
          hint={
            data.forecast
              ? `bei ${formatPoints(data.totalPlanned)} PT Soll · Ø aus ${data.forecast.basedOnSprints} Sprints`
              : "noch keine abgeschlossenen Sprints als Basis"
          }
        />
      </div>

      <CapacityRoster sprintId={sprintId} rows={data.rows} />
    </div>
  );
}
