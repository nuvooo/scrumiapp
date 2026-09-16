import Link from "next/link";
import { loadTeams } from "@/lib/view/loaders";
import { resolveTeamId } from "@/lib/view/selection";
import { listRoadmaps } from "@/lib/repositories/roadmapRepository";
import { monthKey, monthColumns, monthDiff, quarterGroups, barGeometry } from "@/lib/view/roadmapGrid";
import { stackBars } from "@/lib/view/roadmapStack";
import { barClasses } from "@/components/roadmap/itemColors";
import { NewRoadmapButton } from "@/components/roadmap/NewRoadmapButton";

export const dynamic = "force-dynamic";

export default async function RoadmapOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const { team } = await searchParams;
  const teams = await loadTeams();
  const teamId = resolveTeamId(teams, team);
  if (!teamId) return <p className="text-muted">Kein Team vorhanden.</p>;

  const roadmaps = await listRoadmaps(teamId);

  // Gemeinsame Zeitachse (monatsweise): frühester Start- bis spätester Endmonat aller Roadmaps.
  const startKeys = roadmaps.map((r) => monthKey(r.startDate));
  const endKeys = roadmaps.map((r) => monthKey(r.endDate));
  const gridStart = startKeys.length ? startKeys.reduce((a, b) => (a < b ? a : b)) : monthKey(new Date());
  const gridEnd = endKeys.length ? endKeys.reduce((a, b) => (a > b ? a : b)) : gridStart;
  const columns = monthColumns(gridStart, gridEnd);
  const quarters = quarterGroups(gridStart, gridEnd);
  const todayIndex = monthDiff(gridStart, monthKey(new Date()));
  const columnsStyle = { gridTemplateColumns: `repeat(${columns.length}, minmax(34px, 1fr))` };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[29px] font-semibold tracking-[-0.028em]">Roadmap</h1>
          <p className="mt-[7px] text-[13px] text-muted">
            Alle Roadmaps des Teams auf einer Zeitachse — zum Bearbeiten eine Roadmap öffnen.
          </p>
        </div>
        <NewRoadmapButton teamId={teamId} />
      </div>

      {roadmaps.length === 0 && (
        <div className="mt-[26px] rounded-[10px] border border-dashed border-edge py-12 text-center text-[13px] text-muted">
          Noch keine Roadmap — lege die erste an.
        </div>
      )}

      {roadmaps.length > 0 && (
        <div className="mt-[26px] overflow-x-auto pb-2">
          <div style={{ minWidth: columns.length * 34 }}>
            <div className="grid" style={columnsStyle}>
              {quarters.map((q) => (
                <div
                  key={q.label}
                  style={{ gridColumn: `span ${q.span}` }}
                  className="border-l border-edge px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-faint"
                >
                  {q.label}
                </div>
              ))}
            </div>
            <div className="grid border-b border-edge" style={columnsStyle}>
              {columns.map((c, i) => (
                <div
                  key={c.key}
                  className={`border-l border-edge px-1.5 py-0.5 text-[10.5px] ${i === todayIndex ? "text-accent" : "text-faint"}`}
                >
                  {c.label}
                </div>
              ))}
            </div>

            {roadmaps.map((roadmap) => {
              const laneIndex = new Map(roadmap.lanes.map((l, i) => [l.id, i]));
              const bars = roadmap.items
                .map((item) => {
                  const geo = barGeometry(gridStart, columns.length, monthKey(item.startDate), monthKey(item.endDate));
                  return geo ? { item, geo, sortKey: (laneIndex.get(item.laneId) ?? 0) * 1000 + item.position } : null;
                })
                .filter((b): b is NonNullable<typeof b> => b !== null);
              const { rowById, rowCount } = stackBars(
                bars.map((b) => ({ id: b.item.id, start: b.geo.start, end: b.geo.start + b.geo.span - 1, position: b.sortKey })),
              );
              const totalSp = roadmap.items.reduce((s, i) => s + i.storyPoints, 0);
              return (
                <div key={roadmap.id} className="mt-3">
                  <Link
                    href={`/roadmap/${roadmap.id}?team=${teamId}`}
                    className="text-[13.5px] font-semibold text-link hover:text-linkhi"
                  >
                    {roadmap.name}
                    {" · "}
                    <span className="font-mono text-[11.5px] text-faint">
                      {roadmap.blocks.length} {roadmap.blocks.length === 1 ? "Block" : "Blöcke"} · {roadmap.items.length} Tickets · {totalSp} SP
                    </span>
                    {" →"}
                  </Link>
                  <div
                    className="relative mt-1 grid rounded-[10px] border border-edge bg-field"
                    style={{ ...columnsStyle, gridAutoRows: 26 }}
                  >
                    {todayIndex >= 0 && todayIndex < columns.length && (
                      <div
                        className="pointer-events-none border-l border-dashed border-accent/50"
                        style={{ gridColumn: todayIndex + 1, gridRow: `1 / ${rowCount + 1}` }}
                      />
                    )}
                    {bars.map(({ item, geo }) => (
                      <Link
                        key={item.id}
                        href={`/roadmap/${roadmap.id}?team=${teamId}`}
                        title={item.title}
                        style={{ gridColumn: `${geo.start + 1} / span ${geo.span}`, gridRow: rowById[item.id] + 1 }}
                        className={`m-[2px] truncate rounded-[6px] border px-1.5 text-[11px] leading-[20px] ${barClasses(item.statusCategory)}`}
                      >
                        {geo.clippedLeft && "◂ "}
                        {item.title}
                        {geo.clippedRight && " ▸"}
                      </Link>
                    ))}
                    {bars.length === 0 && (
                      <div className="col-span-full py-2 text-center text-[11.5px] text-faint" style={{ gridColumn: `1 / ${columns.length + 1}` }}>
                        Noch keine Einträge
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
