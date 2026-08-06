import Link from "next/link";
import { CreateRetro } from "@/components/retro/CreateRetro";
import { loadTeams } from "@/lib/view/loaders";
import { resolveTeamId } from "@/lib/view/selection";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function RetroPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; sprint?: string }>;
}) {
  const { team } = await searchParams;
  const teams = await loadTeams();
  const teamId = resolveTeamId(teams, team);
  if (!teamId) return <p className="text-muted">Kein Team vorhanden.</p>;

  const retros = await prisma.retro.findMany({
    where: { teamId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { participants: true, columns: true } },
      columns: { select: { _count: { select: { cards: true } } } },
    },
  });

  return (
    <div>
      <h1 className="text-[29px] font-semibold tracking-[-0.028em]">Retro</h1>
      <div className="mt-[7px] text-[13px] text-muted">
        Board anlegen, Link teilen, Karten schreiben, voten — anonym dank Verdeckt-Modus.
      </div>

      <div className="mt-6">
        <CreateRetro teamId={teamId} />
      </div>

      <div className="card mt-3.5 overflow-hidden">
        <div className="border-b border-line px-[18px] py-[15px] text-sm font-semibold">Boards</div>
        {retros.map((r) => {
          const cards = r.columns.reduce((sum, c) => sum + c._count.cards, 0);
          return (
            <Link
              key={r.id}
              href={`/retro/${r.id}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-row px-[18px] py-3 text-[13px] last:border-b-0 hover:bg-raise"
            >
              <span className="min-w-0 flex-1 truncate font-medium text-fg">{r.name}</span>
              <span className={`flex-none rounded-full border px-2 py-[2px] font-mono text-[10.5px] ${
                r.hidden ? "border-edge bg-field text-dim" : "border-[#1F3D2B] bg-[#0F1A14] text-ok"
              }`}>
                {r.hidden ? "verdeckt" : "sichtbar"}
              </span>
              <span className="flex-none font-mono text-[11px] text-dim">
                {cards} Karten · {r._count.participants} Teilnehmer
              </span>
              <span className="flex-none font-mono text-[11px] text-faint">
                {r.createdAt.toLocaleDateString("de-DE")}
              </span>
            </Link>
          );
        })}
        {retros.length === 0 && (
          <div className="px-[18px] py-8 text-center text-[13px] text-muted">
            Noch keine Retros — lege oben das erste Board an.
          </div>
        )}
      </div>
    </div>
  );
}
