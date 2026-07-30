import Link from "next/link";
import { CreateRefinement } from "@/components/refinement/CreateRefinement";
import { loadTeams } from "@/lib/view/loaders";
import { resolveTeamId } from "@/lib/view/selection";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const STATE_LABEL = {
  DRAFT: { label: "Vorbereitung", className: "border-edge bg-field text-dim" },
  RUNNING: { label: "läuft", className: "border-[#1F3D2B] bg-[#0F1A14] text-ok" },
  DONE: { label: "abgeschlossen", className: "border-edge bg-field text-faint" },
} as const;

export default async function RefinementPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; sprint?: string }>;
}) {
  const { team } = await searchParams;
  const teams = await loadTeams();
  const teamId = resolveTeamId(teams, team);
  if (!teamId) return <p className="text-muted">Kein Team vorhanden.</p>;

  const refinements = await prisma.refinement.findMany({
    where: { teamId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { tickets: true, participants: true } } },
  });

  return (
    <div>
      <h1 className="text-[29px] font-semibold tracking-[-0.028em]">Refinement</h1>
      <div className="mt-[7px] text-[13px] text-muted">
        Session anlegen, Link teilen, gemeinsam schätzen — Ergebnisse landen direkt in Jira.
      </div>

      <div className="mt-6">
        <CreateRefinement teamId={teamId} />
      </div>

      <div className="card mt-3.5 overflow-hidden">
        <div className="border-b border-line px-[18px] py-[15px] text-sm font-semibold">Sessions</div>
        {refinements.map((r) => {
          const tag = STATE_LABEL[r.state];
          return (
            <Link
              key={r.id}
              href={`/refinement/${r.id}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-row px-[18px] py-3 text-[13px] last:border-b-0 hover:bg-raise"
            >
              <span className="min-w-0 flex-1 truncate font-medium text-fg">{r.name}</span>
              <span className={`flex-none rounded-full border px-2 py-[2px] font-mono text-[10.5px] ${tag.className}`}>
                {tag.label}
              </span>
              <span className="flex-none font-mono text-[11px] text-dim">
                {r._count.tickets} Tickets · {r._count.participants} Teilnehmer
              </span>
              <span className="flex-none font-mono text-[11px] text-faint">
                {r.createdAt.toLocaleDateString("de-DE")}
              </span>
            </Link>
          );
        })}
        {refinements.length === 0 && (
          <div className="px-[18px] py-8 text-center text-[13px] text-muted">
            Noch keine Refinements — lege oben das erste an.
          </div>
        )}
      </div>
    </div>
  );
}
