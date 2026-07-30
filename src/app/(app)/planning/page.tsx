import Link from "next/link";
import { KpiCard } from "@/components/KpiCard";
import { PlanningList } from "@/components/PlanningList";
import { loadTeams, loadPlanning } from "@/lib/view/loaders";
import { resolveTeamId } from "@/lib/view/selection";
import { formatPoints } from "@/lib/format";

export const dynamic = "force-dynamic";

const VERDICT = {
  ok: { dot: "bg-ok", text: "text-ok", label: "Das Commitment liegt im Rahmen der Prognose." },
  tight: { dot: "bg-warn", text: "text-warn", label: "Knapp über der Prognose — im Planning besprechen." },
  over: { dot: "bg-danger", text: "text-danger", label: "Deutlich über der Prognose — Scope reduzieren." },
} as const;

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; sprint?: string }>;
}) {
  const { team } = await searchParams;
  const teams = await loadTeams();
  const teamId = resolveTeamId(teams, team);
  if (!teamId) return <p className="text-muted">Kein Team vorhanden.</p>;

  const data = await loadPlanning(teamId);
  if (!data) {
    return (
      <div>
        <h1 className="text-[29px] font-semibold tracking-[-0.028em]">Planning</h1>
        <p className="mt-[7px] text-[13px] text-muted">
          Kein geplanter Sprint — lege den nächsten Sprint in Jira an und synchronisiere.
        </p>
      </div>
    );
  }

  const { summary } = data;
  const verdict = summary.verdict ? VERDICT[summary.verdict] : null;

  return (
    <div>
      <h1 className="text-[29px] font-semibold tracking-[-0.028em]">Planning</h1>
      <div className="mt-[7px] text-[13px] text-muted">
        {data.sprintName} · Planungs-Check für den nächsten Sprint ·{" "}
        <Link href="/refinement" className="text-link hover:text-linkhi">
          Schätzen im Refinement →
        </Link>
      </div>

      <div className="mt-[26px] grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
        <KpiCard label="Eingeplant" value={formatPoints(summary.plannedPoints)} unit="SP" size="md" />
        <KpiCard
          label="Forecast"
          value={data.forecast !== null ? `≈ ${formatPoints(data.forecast)}` : "–"}
          unit={data.forecast !== null ? "SP" : undefined}
          size="md"
          hint={data.totalPlanned > 0 ? `bei ${formatPoints(data.totalPlanned)} PT Soll-Kapazität` : "keine Kapazität gepflegt"}
          monoHint
        />
        <KpiCard
          label="Ohne Schätzung"
          value={String(summary.unestimatedCount)}
          unit={summary.unestimatedCount === 1 ? "Ticket" : "Tickets"}
          size="md"
        />
      </div>

      {verdict && (
        <div className="card mt-3.5 flex items-center gap-2.5 px-[18px] py-3">
          <span className={`h-2 w-2 flex-none rounded-full ${verdict.dot}`} />
          <span className={`text-[13px] ${verdict.text}`}>
            {verdict.label}
            {summary.overBy > 0 && ` (${formatPoints(summary.overBy)} SP über der Prognose)`}
          </span>
        </div>
      )}

      <PlanningList issues={data.issues} />
    </div>
  );
}
