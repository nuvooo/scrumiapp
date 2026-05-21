import { VelocityChart } from "@/components/charts/VelocityChart";
import { VelocityTable } from "@/components/VelocityTable";
import { loadTeams, loadVelocity } from "@/lib/view/loaders";
import { resolveTeamId } from "@/lib/view/selection";
import { formatPoints, trendSymbol } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function VelocityPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const { team } = await searchParams;
  const teams = await loadTeams();
  const teamId = resolveTeamId(teams, team);
  if (!teamId) return <p className="text-slate-400">Kein Team vorhanden.</p>;

  const trend = await loadVelocity(teamId);

  return (
    <div className="space-y-8">
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-bold">Velocity</h1>
        <span className="text-sm text-slate-400">
          {trendSymbol(trend.trend)} Ø {formatPoints(trend.average)} SP / Sprint
        </span>
      </div>
      {trend.points.length === 0 ? (
        <p className="text-slate-400">Noch keine abgeschlossenen Sprints.</p>
      ) : (
        <>
          <VelocityChart data={trend.points} average={trend.average} />
          <VelocityTable points={trend.points} />
        </>
      )}
    </div>
  );
}
