import { VelocityChart } from "@/components/charts/VelocityChart";
import { VelocityTable } from "@/components/VelocityTable";
import { loadTeams, loadVelocity } from "@/lib/view/loaders";
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
  const t = TREND[trend.trend];

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-3.5">
        <h1 className="text-[29px] font-semibold tracking-[-0.028em]">Velocity</h1>
        <div className={`flex items-center gap-[7px] rounded-full border border-edge bg-field px-2.5 py-1 font-mono text-[12.5px] ${t.className}`}>
          <span className="text-sm">{t.arrow}</span>Ø {formatPoints(trend.average)} SP / Sprint
        </div>
      </div>
      <div className="mt-[7px] text-[13px] text-muted">
        Abgeschlossene Story Points der letzten {trend.points.length} Sprints · {teamName}
      </div>

      {trend.points.length === 0 ? (
        <div className="card mt-6 px-10 py-[52px] text-center">
          <div className="text-[15px] font-semibold">Noch keine abgeschlossenen Sprints.</div>
          <div className="mt-[7px] text-[13px] text-muted">Sobald ein Sprint in Jira geschlossen wird, erscheint er hier.</div>
        </div>
      ) : (
        <>
          <div className="card mt-6 p-[18px]">
            <VelocityChart data={trend.points} average={trend.average} />
          </div>
          <div className="mt-3.5">
            <VelocityTable points={trend.points} />
          </div>
        </>
      )}
    </div>
  );
}
