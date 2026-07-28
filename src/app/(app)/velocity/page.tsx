import { VelocityChart } from "@/components/charts/VelocityChart";
import { VelocityTable } from "@/components/VelocityTable";
import { loadTeams, loadVelocity, loadVelocityForecast } from "@/lib/view/loaders";
import { resolveTeamId } from "@/lib/view/selection";
import { formatPoints } from "@/lib/format";

export const dynamic = "force-dynamic";

const TREND = {
  UP: { arrow: "↑", className: "text-ok" },
  DOWN: { arrow: "↓", className: "text-warn" },
  FLAT: { arrow: "→", className: "text-mint" },
} as const;

export default async function VelocityPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const { team } = await searchParams;
  const teams = await loadTeams();
  const teamId = resolveTeamId(teams, team);
  if (!teamId) return <p className="text-muted">Kein Team vorhanden.</p>;

  const teamName = teams.find((t) => t.id === teamId)?.name ?? "";
  const trend = await loadVelocity(teamId);
  const forecast = await loadVelocityForecast(teamId);
  const t = TREND[trend.trend];

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-3.5">
        <h1 className="text-[29px] font-semibold tracking-[-0.028em]">Velocity</h1>
        <div className={`flex items-center gap-[7px] rounded-full border border-edge bg-field px-2.5 py-1 font-mono text-[12.5px] ${t.className}`}>
          <span className="text-sm">{t.arrow}</span>Ø {formatPoints(trend.average)} SP / Sprint
        </div>
        {forecast && (
          <div
            className="flex items-center gap-[7px] rounded-full border border-edge bg-field px-2.5 py-1 font-mono text-[12.5px] text-accent"
            title={`Basis: Ø ${formatPoints(forecast.efficiency)} SP/PT aus ${forecast.basedOnSprints} abgeschlossenen Sprints × ${formatPoints(forecast.plannedPersonDays)} geplante PT`}
          >
            Prognose {formatPoints(forecast.possiblePoints)} SP
          </div>
        )}
      </div>
      <div className="mt-[7px] text-[13px] text-muted">
        Abgeschlossene Story Points der letzten {trend.points.length} Sprints · {teamName}
        {forecast && (
          <>
            {" "}
            · Prognose für {forecast.sprintName}: {formatPoints(forecast.possiblePoints)} SP bei{" "}
            {formatPoints(forecast.plannedPersonDays)} PT
          </>
        )}
      </div>

      {trend.points.length === 0 && trend.rows.length === 0 ? (
        <div className="card mt-6 px-10 py-[52px] text-center">
          <div className="text-[15px] font-semibold">Noch keine Sprints.</div>
          <div className="mt-[7px] text-[13px] text-muted">Sobald Sprints in Jira angelegt oder geschlossen werden, erscheinen sie hier.</div>
        </div>
      ) : (
        <>
          {trend.points.length > 0 && (
            <div className="card mt-6 p-[18px]">
              <VelocityChart data={trend.points} average={trend.average} />
            </div>
          )}
          {trend.rows.length > 0 && (
            <div className="mt-3.5">
              <VelocityTable rows={trend.rows} teamId={teamId} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
