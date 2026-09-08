"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addGoalAction, addJiraItemAction, createLaneAction, deleteItemAction, deleteLaneAction,
  deleteRoadmapAction, moveItemAction, moveLaneAction, refreshStatusesAction,
  renameLaneAction, renameRoadmapAction, updateGoalAction, updateRoadmapRangeAction,
} from "@/app/(app)/roadmap/actions";
import {
  addMonths, barGeometry, monthColumns, monthDiff, monthIndexFromOffset, monthKey, quarterGroups,
} from "@/lib/view/roadmapGrid";
import { stackBars } from "@/lib/view/roadmapStack";
import { barClasses, typeBadge } from "./itemColors";
import { RoadmapItemDialog, type LaneOption, type RoadmapItemView } from "./RoadmapItemDialog";
import { RoadmapGoalDialog } from "./RoadmapGoalDialog";
import { RoadmapSidePanel, DRAG_MIME, type SidePanelIssue } from "./RoadmapSidePanel";
import { RoadmapConfirmDialog } from "./RoadmapConfirmDialog";
import { RoadmapPromptDialog } from "./RoadmapPromptDialog";
import { useIsRoadmapModerator } from "./useRoadmapRole";

export interface RoadmapLaneView {
  id: string;
  name: string;
}

export interface RoadmapView {
  id: string;
  name: string;
  /** "YYYY-MM" */
  startMonth: string;
  endMonth: string;
  lanes: RoadmapLaneView[];
  items: RoadmapItemView[];
}

interface DragState {
  itemId: string;
  mode: "move" | "resize-left" | "resize-right";
  originClientX: number;
  origStart: string;
  origEnd: string;
  origLaneId: string;
  moved: boolean;
}

const LANE_LABEL_WIDTH = 160;
const ROW_HEIGHT = 34;

export function RoadmapEditor({
  roadmap,
  sprintIssues,
  teamId,
}: {
  roadmap: RoadmapView;
  sprintIssues: SidePanelIssue[];
  teamId: string;
}) {
  const router = useRouter();
  const isModerator = useIsRoadmapModerator();
  const [items, setItems] = useState(roadmap.items);
  const [error, setError] = useState<string | null>(null);
  const [statusStale, setStatusStale] = useState(false);
  const [dialogItemId, setDialogItemId] = useState<string | null>(null);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [lanePromptOpen, setLanePromptOpen] = useState(false);
  const [confirmRoadmapDelete, setConfirmRoadmapDelete] = useState(false);
  const [laneToDelete, setLaneToDelete] = useState<{ id: string; name: string; count: number } | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [pending, startTransition] = useTransition();
  const gridRef = useRef<HTMLDivElement | null>(null);
  const laneRefs = useRef(new Map<string, HTMLDivElement>());

  // Server-Refresh (revalidatePath) liefert neue Props → lokalen State resyncen.
  const [syncedItems, setSyncedItems] = useState(roadmap.items);
  if (syncedItems !== roadmap.items) {
    setSyncedItems(roadmap.items);
    setItems(roadmap.items);
  }

  const columns = useMemo(() => monthColumns(roadmap.startMonth, roadmap.endMonth), [roadmap.startMonth, roadmap.endMonth]);
  const quarters = useMemo(() => quarterGroups(roadmap.startMonth, roadmap.endMonth), [roadmap.startMonth, roadmap.endMonth]);
  const monthCount = columns.length;
  const todayIndex = monthDiff(roadmap.startMonth, monthKey(new Date()));
  const currentMonth =
    todayIndex < 0 ? roadmap.startMonth : todayIndex >= monthCount ? roadmap.endMonth : monthKey(new Date());
  const columnsStyle = { gridTemplateColumns: `repeat(${monthCount}, minmax(56px, 1fr))` };
  const containedKeys = useMemo(
    () => new Set(items.filter((i) => i.jiraKey !== null).map((i) => i.jiraKey as string)),
    [items],
  );
  const lanes: LaneOption[] = roadmap.lanes;
  const dialogItem = dialogItemId === null ? null : items.find((i) => i.id === dialogItemId) ?? null;

  // Aktuelle Items für den pointerup-Handler ohne Re-Subscribe.
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // ---------- Status-Refresh beim Öffnen ----------
  useEffect(() => {
    let cancelled = false;
    refreshStatusesAction(roadmap.id).then((result) => {
      if (cancelled) return;
      if (!result.ok || !result.data) {
        setStatusStale(true);
        return;
      }
      const byKey = new Map(result.data.map((s) => [s.jiraKey, s]));
      setItems((prev) =>
        prev.map((i) => {
          const s = i.jiraKey === null ? undefined : byKey.get(i.jiraKey);
          return s ? { ...i, statusCategory: s.statusCategory, statusLabel: s.statusLabel } : i;
        }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [roadmap.id]);

  // ---------- Aktionen mit Fehleranzeige ----------
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, rollback?: () => void) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (!result.ok) {
        rollback?.();
        setError(result.error ?? "Aktion fehlgeschlagen.");
      }
    });

  // ---------- Balken-Drag (Pointer-Events) ----------
  const monthWidth = () => {
    const width = gridRef.current?.getBoundingClientRect().width ?? 0;
    return monthCount > 0 ? width / monthCount : 0;
  };

  const laneAtY = (clientY: number): string | null => {
    for (const [laneId, el] of laneRefs.current) {
      const rect = el.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) return laneId;
    }
    return null;
  };

  const startDrag = (e: React.PointerEvent, item: RoadmapItemView, mode: DragState["mode"]) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setDrag({
      itemId: item.id,
      mode,
      originClientX: e.clientX,
      origStart: item.startMonth,
      origEnd: item.endMonth,
      origLaneId: item.laneId,
      moved: false,
    });
  };

  useEffect(() => {
    if (!drag) return;
    const width = monthWidth();

    const onMove = (e: PointerEvent) => {
      let delta = width > 0 ? Math.round((e.clientX - drag.originClientX) / width) : 0;
      // Mindestens ein Monat des Balkens bleibt im Raster — sonst würde er unerreichbar.
      const rawStart = monthDiff(roadmap.startMonth, drag.origStart);
      const rawEnd = monthDiff(roadmap.startMonth, drag.origEnd);
      if (drag.mode === "move") {
        delta = Math.min(Math.max(delta, -rawEnd), monthCount - 1 - rawStart);
      } else if (drag.mode === "resize-left") {
        delta = Math.min(delta, monthCount - 1 - rawStart);
      } else {
        delta = Math.max(delta, -rawEnd);
      }
      const laneId = drag.mode === "move" ? laneAtY(e.clientY) ?? drag.origLaneId : drag.origLaneId;
      let start = drag.origStart;
      let end = drag.origEnd;
      if (drag.mode === "move") {
        start = addMonths(drag.origStart, delta);
        end = addMonths(drag.origEnd, delta);
      } else if (drag.mode === "resize-left") {
        start = addMonths(drag.origStart, delta);
        if (monthDiff(start, end) < 0) start = end;
      } else {
        end = addMonths(drag.origEnd, delta);
        if (monthDiff(start, end) < 0) end = start;
      }
      const changed = start !== drag.origStart || end !== drag.origEnd || laneId !== drag.origLaneId;
      if (changed && !drag.moved) setDrag({ ...drag, moved: true });
      setItems((prev) =>
        prev.map((i) => (i.id === drag.itemId ? { ...i, startMonth: start, endMonth: end, laneId } : i)),
      );
    };

    const onUp = () => {
      const item = itemsRef.current.find((i) => i.id === drag.itemId);
      setDrag(null);
      if (!item) return;
      if (!drag.moved) {
        setDialogItemId(item.id);
        return;
      }
      const rollback = () =>
        setItems((prev) =>
          prev.map((i) =>
            i.id === drag.itemId
              ? { ...i, startMonth: drag.origStart, endMonth: drag.origEnd, laneId: drag.origLaneId }
              : i,
          ),
        );
      run(() => moveItemAction(item.id, item.laneId, item.startMonth, item.endMonth), rollback);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag]);

  // ---------- Hinzufügen (Drop + "+" + Ziel) ----------
  const addIssueAt = (issue: SidePanelIssue, laneId: string, month: string) =>
    run(() =>
      addJiraItemAction(
        roadmap.id,
        laneId,
        {
          jiraKey: issue.jiraKey,
          title: issue.summary,
          issueType: issue.issueType,
          statusCategory: issue.statusCategory,
          statusLabel: issue.statusLabel,
        },
        month,
        month,
      ),
    );

  const onDropIssue = (e: React.DragEvent, laneId: string) => {
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    e.preventDefault();
    const issue = JSON.parse(raw) as SidePanelIssue;
    const laneEl = laneRefs.current.get(laneId);
    const rect = laneEl?.getBoundingClientRect();
    const index = rect ? monthIndexFromOffset(e.clientX - rect.left, rect.width / monthCount, monthCount) : 0;
    addIssueAt(issue, laneId, addMonths(roadmap.startMonth, index));
  };

  // ---------- Render ----------
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-3">
        {isModerator ? (
          <input
            type="text"
            defaultValue={roadmap.name}
            aria-label="Roadmap-Name"
            onBlur={(e) => {
              if (e.target.value.trim() && e.target.value !== roadmap.name)
                run(() => renameRoadmapAction(roadmap.id, e.target.value));
            }}
            className="min-w-[220px] rounded-[7px] border border-transparent bg-transparent px-2 py-1 text-[22px] font-semibold tracking-[-0.02em] text-fg hover:border-edge focus:border-edge focus:bg-field"
          />
        ) : (
          <h1 className="px-2 py-1 text-[22px] font-semibold tracking-[-0.02em] text-fg">{roadmap.name}</h1>
        )}
        {isModerator ? (
          <div className="flex items-center gap-1.5">
            <input
              type="month"
              defaultValue={roadmap.startMonth}
              aria-label="Startmonat"
              onBlur={(e) => {
                if (e.target.value && e.target.value !== roadmap.startMonth)
                  run(() => updateRoadmapRangeAction(roadmap.id, e.target.value, roadmap.endMonth));
              }}
              className="rounded-[7px] border border-edge bg-field px-2 py-1 text-[12px] text-mid"
            />
            <span className="text-[12px] text-faint">–</span>
            <input
              type="month"
              defaultValue={roadmap.endMonth}
              aria-label="Endmonat"
              onBlur={(e) => {
                if (e.target.value && e.target.value !== roadmap.endMonth)
                  run(() => updateRoadmapRangeAction(roadmap.id, roadmap.startMonth, e.target.value));
              }}
              className="rounded-[7px] border border-edge bg-field px-2 py-1 text-[12px] text-mid"
            />
          </div>
        ) : (
          <span className="text-[12px] text-faint">
            {roadmap.startMonth} – {roadmap.endMonth}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {statusStale && (
            <span className="text-[11.5px] text-warn" title="Jira nicht erreichbar — angezeigte Status können veraltet sein">
              Status evtl. veraltet
            </span>
          )}
          {isModerator ? (
            <>
              <button type="button" onClick={() => setGoalDialogOpen(true)} className="btn-primary px-3.5 py-[7px]">
                + Ziel
              </button>
              <button
                type="button"
                onClick={() => setLanePromptOpen(true)}
                className="btn-secondary px-3.5 py-[7px]"
              >
                + Bahn
              </button>
              <button
                type="button"
                onClick={() => setPanelOpen((v) => !v)}
                className="btn-secondary px-3.5 py-[7px]"
                title={panelOpen ? "Seitenleiste ausblenden" : "Seitenleiste einblenden"}
              >
                {panelOpen ? "⇥" : "⇤ Tickets"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmRoadmapDelete(true)}
                className="rounded-[9px] border border-[#5a2a2a] px-3 py-[7px] text-[12.5px] text-danger hover:bg-[#1d0e0e]"
              >
                Löschen
              </button>
            </>
          ) : (
            <span
              className="text-[11.5px] text-faint"
              title="Zum Bearbeiten die Moderator-Rolle im Profil (unten links) aktivieren"
            >
              Nur-Lese-Ansicht
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-[10px] border border-[#5a2a2a] bg-[#1d0e0e] px-3.5 py-2.5 text-[13px] text-danger">
          {error}
        </div>
      )}

      <div className="flex items-start gap-3.5">
        <div className="min-w-0 flex-1 overflow-x-auto pb-2">
          <div style={{ minWidth: LANE_LABEL_WIDTH + monthCount * 56 }}>
            {/* Kopfzeile: Quartale + Monate */}
            <div className="grid" style={{ gridTemplateColumns: `${LANE_LABEL_WIDTH}px 1fr` }}>
              <div />
              <div>
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
                <div className="grid border-b border-edge" style={columnsStyle} ref={gridRef}>
                  {columns.map((c, i) => (
                    <div
                      key={c.key}
                      className={`border-l border-edge px-1.5 py-0.5 text-[10.5px] ${
                        i === todayIndex ? "font-semibold text-accent" : "text-faint"
                      }`}
                    >
                      {c.label}
                      {i === todayIndex && " ·"}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bahnen */}
            {roadmap.lanes.map((lane, laneIndex) => {
              const laneItems = items.filter((i) => i.laneId === lane.id);
              const bars = laneItems.map((item) => {
                const raw = barGeometry(roadmap.startMonth, monthCount, item.startMonth, item.endMonth);
                // Komplett außerhalb: als 1-Monats-Marker am nächstgelegenen Rand rendern,
                // damit der Eintrag klickbar bleibt (Dialog kann den Zeitraum korrigieren).
                const geo =
                  raw ??
                  (monthDiff(roadmap.startMonth, item.endMonth) < 0
                    ? { start: 0, span: 1, clippedLeft: true, clippedRight: false }
                    : { start: monthCount - 1, span: 1, clippedLeft: false, clippedRight: true });
                return { item, geo };
              });
              const { rowById, rowCount } = stackBars(
                bars.map((b) => ({
                  id: b.item.id,
                  start: b.geo.start,
                  end: b.geo.start + b.geo.span - 1,
                  position: b.item.position,
                })),
              );
              return (
                <div
                  key={lane.id}
                  className="grid border-b border-edge/60"
                  style={{ gridTemplateColumns: `${LANE_LABEL_WIDTH}px 1fr` }}
                >
                  <div className="flex items-center gap-1 py-1 pr-2">
                    {isModerator ? (
                      <>
                        <input
                          type="text"
                          defaultValue={lane.name}
                          aria-label={`Bahn ${lane.name} umbenennen`}
                          onBlur={(e) => {
                            if (e.target.value.trim() && e.target.value !== lane.name)
                              run(() => renameLaneAction(lane.id, e.target.value));
                          }}
                          className="min-w-0 flex-1 rounded-[6px] border border-transparent bg-transparent px-1.5 py-0.5 text-[12.5px] text-mid hover:border-edge focus:border-edge focus:bg-field"
                        />
                        <button
                          type="button"
                          onClick={() => run(() => moveLaneAction(lane.id, -1))}
                          disabled={laneIndex === 0}
                          aria-label={`Bahn ${lane.name} nach oben`}
                          className="rounded px-1 text-[11px] text-faint hover:text-fg disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => run(() => moveLaneAction(lane.id, 1))}
                          disabled={laneIndex === roadmap.lanes.length - 1}
                          aria-label={`Bahn ${lane.name} nach unten`}
                          className="rounded px-1 text-[11px] text-faint hover:text-fg disabled:opacity-30"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => setLaneToDelete({ id: lane.id, name: lane.name, count: laneItems.length })}
                          aria-label={`Bahn ${lane.name} löschen`}
                          className="rounded px-1 text-[11px] text-faint hover:text-danger"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <span className="min-w-0 flex-1 truncate px-1.5 py-0.5 text-[12.5px] text-mid">{lane.name}</span>
                    )}
                  </div>
                  <div
                    ref={(el) => {
                      if (el) laneRefs.current.set(lane.id, el);
                      else laneRefs.current.delete(lane.id);
                    }}
                    onDragOver={(e) => {
                      if (e.dataTransfer.types.includes(DRAG_MIME)) e.preventDefault();
                    }}
                    onDrop={(e) => onDropIssue(e, lane.id)}
                    className="relative grid py-1"
                    style={{ ...columnsStyle, gridAutoRows: ROW_HEIGHT }}
                  >
                    {todayIndex >= 0 && todayIndex < monthCount && (
                      <div
                        className="pointer-events-none border-l border-dashed border-accent/50"
                        style={{ gridColumn: todayIndex + 1, gridRow: `1 / ${rowCount + 1}` }}
                      />
                    )}
                    {bars.map(({ item, geo }) => (
                      <div
                        key={item.id}
                        onPointerDown={isModerator ? (e) => startDrag(e, item, "move") : undefined}
                        onClick={isModerator ? undefined : () => setDialogItemId(item.id)}
                        title={`${item.title} (${item.startMonth} – ${item.endMonth})`}
                        style={{ gridColumn: `${geo.start + 1} / span ${geo.span}`, gridRow: rowById[item.id] + 1 }}
                        className={`group relative m-[2px] flex select-none items-center gap-1.5 overflow-hidden rounded-[7px] border px-2 text-[11.5px] leading-[26px] ${isModerator ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${barClasses(item.statusCategory)} ${drag?.itemId === item.id ? "ring-1 ring-accent" : ""}`}
                      >
                        {isModerator && (
                          <span
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              startDrag(e, item, "resize-left");
                            }}
                            className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100 group-hover:bg-accent/40"
                          />
                        )}
                        {geo.clippedLeft && <span className="flex-none">◂</span>}
                        <span className="flex-none font-mono text-[9px] uppercase tracking-[0.08em] opacity-70">
                          {typeBadge(item)}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                        {geo.clippedRight && <span className="flex-none">▸</span>}
                        {isModerator && (
                          <span
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              startDrag(e, item, "resize-right");
                            }}
                            className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100 group-hover:bg-accent/40"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {isModerator && panelOpen && (
          <RoadmapSidePanel
            sprintIssues={sprintIssues}
            containedKeys={containedKeys}
            onAdd={(issue) => {
              const firstLane = roadmap.lanes[0];
              if (firstLane) addIssueAt(issue, firstLane.id, currentMonth);
            }}
          />
        )}
      </div>

      {dialogItem && (
        <RoadmapItemDialog
          item={dialogItem}
          lanes={lanes}
          pending={pending}
          error={error}
          readOnly={!isModerator}
          onClose={() => setDialogItemId(null)}
          onDelete={() => {
            setDialogItemId(null);
            setItems((prev) => prev.filter((i) => i.id !== dialogItem.id));
            run(
              () => deleteItemAction(dialogItem.id),
              () => setItems((prev) => [...prev, dialogItem]),
            );
          }}
          onSavePlacement={(laneId, start, end) => {
            setDialogItemId(null);
            run(() => moveItemAction(dialogItem.id, laneId, start, end));
          }}
          onSaveGoal={(title, description, statusCategory) => {
            setDialogItemId(null);
            run(() => updateGoalAction(dialogItem.id, title, description, statusCategory));
          }}
        />
      )}

      {goalDialogOpen && (
        <RoadmapGoalDialog
          lanes={lanes}
          defaultMonth={currentMonth}
          pending={pending}
          error={error}
          onClose={() => setGoalDialogOpen(false)}
          onCreate={(laneId, title, description, start, end) => {
            setGoalDialogOpen(false);
            run(() => addGoalAction(roadmap.id, laneId, title, description, start, end));
          }}
        />
      )}

      {lanePromptOpen && (
        <RoadmapPromptDialog
          title="Neue Bahn"
          label="Name"
          placeholder="z. B. Frontend"
          confirmLabel="Anlegen"
          pending={pending}
          onClose={() => setLanePromptOpen(false)}
          onSubmit={(name) => {
            setLanePromptOpen(false);
            run(() => createLaneAction(roadmap.id, name));
          }}
        />
      )}

      {laneToDelete && (
        <RoadmapConfirmDialog
          title="Bahn löschen"
          message={
            laneToDelete.count > 0
              ? `Bahn „${laneToDelete.name}" mit ${laneToDelete.count} ${laneToDelete.count === 1 ? "Eintrag" : "Einträgen"} löschen? Die Einträge werden mitgelöscht.`
              : `Bahn „${laneToDelete.name}" löschen?`
          }
          confirmLabel="Löschen"
          pending={pending}
          onClose={() => setLaneToDelete(null)}
          onConfirm={() => {
            const id = laneToDelete.id;
            setLaneToDelete(null);
            run(() => deleteLaneAction(id));
          }}
        />
      )}

      {confirmRoadmapDelete && (
        <RoadmapConfirmDialog
          title="Roadmap löschen"
          message={`Roadmap „${roadmap.name}" mit allen Bahnen und Einträgen wirklich löschen?`}
          confirmLabel="Löschen"
          pending={pending}
          onClose={() => setConfirmRoadmapDelete(false)}
          onConfirm={() =>
            startTransition(async () => {
              setError(null);
              const result = await deleteRoadmapAction(roadmap.id);
              if (result.ok) router.push(`/roadmap?team=${teamId}`);
              else {
                setConfirmRoadmapDelete(false);
                setError(result.error ?? "Löschen fehlgeschlagen.");
              }
            })
          }
        />
      )}
    </div>
  );
}
