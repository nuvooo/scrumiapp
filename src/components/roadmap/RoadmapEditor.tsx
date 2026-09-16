"use client";

import "./roadmap.css";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addGoalAction, addJiraItemAction, createBlockAction, createLabelAction, createLaneAction,
  createMilestoneAction, deleteBlockAction, deleteItemAction, deleteLabelAction, deleteLaneAction,
  deleteMilestoneAction, deleteRoadmapAction, moveBlockAction, moveItemAction, moveLaneAction,
  refreshStatusesAction, renameLaneAction, renameRoadmapAction, setItemLabelsAction, shiftBlockAction,
  updateBlockAction, updateGoalAction, updateLabelAction, updateMilestoneAction, updateRoadmapRangeAction,
} from "@/app/(app)/roadmap/actions";
import { addDays, dayDiff, dayKey, formatDay, type Zoom } from "@/lib/view/roadmapDays";
import { INBOX_ID, type DropPosition } from "@/lib/view/roadmapTree";
import { RoadmapBoard } from "./RoadmapBoard";
import { RoadmapItemDrawer } from "./RoadmapItemDrawer";
import { RoadmapGoalDialog } from "./RoadmapGoalDialog";
import { RoadmapBlockDialog, type BlockOption } from "./RoadmapBlockDialog";
import { RoadmapLanesDialog } from "./RoadmapLanesDialog";
import { RoadmapSidePanel, type SidePanelIssue } from "./RoadmapSidePanel";
import { RoadmapConfirmDialog } from "./RoadmapConfirmDialog";
import { RoadmapLabelsDialog } from "./RoadmapLabelsDialog";
import { RoadmapMilestoneDialog } from "./RoadmapMilestoneDialog";
import { useIsRoadmapModerator } from "./useRoadmapRole";
import type { BlockView, LaneView, MilestoneView, Placement, RoadmapItemView, RoadmapView } from "./types";

export type { RoadmapView } from "./types";

/** Eingeklappte Blöcke pro Roadmap im localStorage — neue Blöcke sind damit standardmäßig offen. */
const closedKey = (roadmapId: string) => `roadmap-closed:${roadmapId}`;

function readClosed(roadmapId: string): Set<string> {
  try {
    const raw = localStorage.getItem(closedKey(roadmapId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeClosed(roadmapId: string, closed: Set<string>) {
  try {
    localStorage.setItem(closedKey(roadmapId), JSON.stringify([...closed]));
  } catch {
    /* localStorage nicht verfügbar */
  }
}

/** Blöcke als eingerückte Auswahlliste (Baumreihenfolge). */
function blockOptions(blocks: BlockView[], excludeSubtreeOf: string | null = null): BlockOption[] {
  const byParent = new Map<string | null, BlockView[]>();
  for (const b of blocks) {
    const list = byParent.get(b.parentId) ?? [];
    list.push(b);
    byParent.set(b.parentId, list);
  }
  const out: BlockOption[] = [];
  const rec = (parentId: string | null, depth: number, disabled: boolean) => {
    const list = (byParent.get(parentId) ?? []).sort((a, b) => a.position - b.position);
    for (const b of list) {
      const dis = disabled || b.id === excludeSubtreeOf;
      out.push({ id: b.id, label: `${"  ".repeat(depth)}${depth > 0 ? "└ " : ""}${b.name}`, disabled: dis });
      rec(b.id, depth + 1, dis);
    }
  };
  rec(null, 0, false);
  return out;
}

function blockPath(blocks: BlockView[], blockId: string | null): string {
  if (!blockId) return "Eingangskorb";
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const names: string[] = [];
  let cur = byId.get(blockId);
  while (cur) {
    names.unshift(cur.name);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return names.join(" › ") || "Eingangskorb";
}

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
  const [zoom, setZoom] = useState<Zoom>("m");
  const [present, setPresent] = useState(false);
  const [showDeps, setShowDeps] = useState(true);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [blockDialog, setBlockDialog] = useState<{ block: BlockView | null; parentId: string | null } | null>(null);
  const [blockToDelete, setBlockToDelete] = useState<BlockView | null>(null);
  const [lanesDialogOpen, setLanesDialogOpen] = useState(false);
  const [laneToDelete, setLaneToDelete] = useState<{ lane: LaneView; count: number } | null>(null);
  const [confirmRoadmapDelete, setConfirmRoadmapDelete] = useState(false);
  const [labelsDialogOpen, setLabelsDialogOpen] = useState(false);
  const [milestoneDialog, setMilestoneDialog] = useState<{ milestone: MilestoneView | null } | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Server-Refresh (revalidatePath) liefert neue Props → lokalen State resyncen.
  const [syncedItems, setSyncedItems] = useState(roadmap.items);
  if (syncedItems !== roadmap.items) {
    setSyncedItems(roadmap.items);
    setItems(roadmap.items);
  }

  // Klappzustand aus dem localStorage (nach dem Mount — kein Hydration-Mismatch).
  useEffect(() => {
    setClosed(readClosed(roadmap.id));
  }, [roadmap.id]);

  const allBlockIds = useMemo(() => [...roadmap.blocks.map((b) => b.id), INBOX_ID], [roadmap.blocks]);
  const open = useMemo(() => new Set(allBlockIds.filter((id) => !closed.has(id))), [allBlockIds, closed]);

  const today = dayKey(new Date());
  const todayIndex = dayDiff(roadmap.startDate, today);
  const totalDays = dayDiff(roadmap.startDate, roadmap.endDate) + 1;
  const currentDay = todayIndex < 0 ? roadmap.startDate : todayIndex >= totalDays ? roadmap.endDate : today;

  const containedKeys = useMemo(
    () => new Set(items.filter((i) => i.jiraKey !== null).map((i) => i.jiraKey as string)),
    [items],
  );
  const options = useMemo(() => blockOptions(roadmap.blocks), [roadmap.blocks]);
  const selectedItem = selectedItemId === null ? null : items.find((i) => i.id === selectedItemId) ?? null;
  const itemCountByLane = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) m.set(i.laneId, (m.get(i.laneId) ?? 0) + 1);
    return m;
  }, [items]);

  const facts = useMemo(
    () => ({
      tickets: items.length,
      done: items.filter((i) => i.statusCategory === "done").length,
      sp: items.reduce((s, i) => s + i.storyPoints, 0),
      blocks: roadmap.blocks.length,
    }),
    [items, roadmap.blocks.length],
  );

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
          return s
            ? {
                ...i,
                statusCategory: s.statusCategory,
                statusLabel: s.statusLabel,
                storyPoints: s.storyPoints,
                assignee: s.assignee,
                blockedBy: s.blockedBy,
              }
            : i;
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

  const toggle = (blockId: string) => {
    const next = new Set(closed);
    if (next.has(blockId)) next.delete(blockId);
    else next.add(blockId);
    setClosed(next);
    writeClosed(roadmap.id, next);
  };
  const collapseAll = () => {
    const next = new Set(allBlockIds);
    setClosed(next);
    writeClosed(roadmap.id, next);
  };
  const expandAll = () => {
    const next = new Set<string>();
    setClosed(next);
    writeClosed(roadmap.id, next);
  };

  const moveItem = (itemId: string, placement: Placement) => {
    const before = items.find((i) => i.id === itemId);
    if (!before) return;
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, laneId: placement.laneId, blockId: placement.blockId, startDate: placement.startDate, endDate: placement.endDate }
          : i,
      ),
    );
    run(
      () => moveItemAction(itemId, placement),
      () => setItems((prev) => prev.map((i) => (i.id === itemId ? before : i))),
    );
  };

  const shiftBlock = (blockId: string, deltaDays: number, itemIds: string[]) => {
    const ids = new Set(itemIds);
    const before = items;
    setItems((prev) =>
      prev.map((i) =>
        ids.has(i.id) ? { ...i, startDate: addDays(i.startDate, deltaDays), endDate: addDays(i.endDate, deltaDays) } : i,
      ),
    );
    run(() => shiftBlockAction(blockId, deltaDays), () => setItems(before));
  };

  const moveBlock = (blockId: string, targetId: string | null, position: DropPosition) =>
    run(() => moveBlockAction(blockId, targetId, position));

  const addIssue = (issue: SidePanelIssue, laneId: string, blockId: string | null, startDate: string, endDate: string) =>
    run(() =>
      addJiraItemAction(
        roadmap.id,
        laneId,
        blockId,
        {
          jiraKey: issue.jiraKey,
          title: issue.summary,
          issueType: issue.issueType,
          statusCategory: issue.statusCategory,
          statusLabel: issue.statusLabel,
          storyPoints: issue.storyPoints,
          assignee: issue.assignee,
        },
        startDate,
        endDate,
      ),
    );

  const togglePresent = () => {
    const next = !present;
    setPresent(next);
    if (next) {
      setSelectedItemId(null);
      setPanelOpen(false);
    }
  };

  const zoomButtons: { key: Zoom; label: string }[] = [
    { key: "q", label: "Quartal" },
    { key: "m", label: "Monat" },
    { key: "w", label: "Woche" },
  ];

  // ---------- Render ----------
  return (
    <div className="rm flex flex-col gap-3.5" data-present={present ? "1" : "0"} data-full-width>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
            Roadmap · Stand {formatDay(today)}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            {isModerator && !present ? (
              <input
                type="text"
                defaultValue={roadmap.name}
                aria-label="Roadmap-Name"
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== roadmap.name)
                    run(() => renameRoadmapAction(roadmap.id, e.target.value));
                }}
                className="min-w-[240px] rounded-[7px] border border-transparent bg-transparent px-2 py-1 text-[24px] font-semibold tracking-[-0.02em] text-fg hover:border-edge focus:border-edge focus:bg-field"
              />
            ) : (
              <h1 className="px-2 py-1 text-[24px] font-semibold tracking-[-0.02em] text-fg">{roadmap.name}</h1>
            )}
            {isModerator && !present ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  defaultValue={roadmap.startDate}
                  aria-label="Startdatum"
                  onBlur={(e) => {
                    if (e.target.value && e.target.value !== roadmap.startDate)
                      run(() => updateRoadmapRangeAction(roadmap.id, e.target.value, roadmap.endDate));
                  }}
                  className="rounded-[7px] border border-edge bg-field px-2 py-1 text-[12px] text-mid"
                />
                <span className="text-[12px] text-faint">–</span>
                <input
                  type="date"
                  defaultValue={roadmap.endDate}
                  aria-label="Enddatum"
                  onBlur={(e) => {
                    if (e.target.value && e.target.value !== roadmap.endDate)
                      run(() => updateRoadmapRangeAction(roadmap.id, roadmap.startDate, e.target.value));
                  }}
                  className="rounded-[7px] border border-edge bg-field px-2 py-1 text-[12px] text-mid"
                />
              </div>
            ) : (
              <span className="text-[12px] text-faint">
                {formatDay(roadmap.startDate)} – {formatDay(roadmap.endDate)}
              </span>
            )}
            {statusStale && (
              <span className="text-[11.5px] text-warn" title="Jira nicht erreichbar — angezeigte Status können veraltet sein">
                Status evtl. veraltet
              </span>
            )}
            {!isModerator && !present && (
              <span className="text-[11.5px] text-faint" title="Zum Bearbeiten die Moderator-Rolle im Profil (unten links) aktivieren">
                Nur-Lese-Ansicht
              </span>
            )}
          </div>
        </div>
        <div className="rm-facts">
          <div className="rm-fact"><b>{facts.tickets}</b><span>Tickets</span></div>
          <div className="rm-fact"><b>{facts.done}</b><span>Erledigt</span></div>
          <div className="rm-fact"><b>{facts.sp}</b><span>Story Points</span></div>
          <div className="rm-fact"><b>{facts.blocks}</b><span>Blöcke</span></div>
        </div>
      </div>

      {error && (
        <div className="rounded-[10px] border border-[#5a2a2a] bg-[#1d0e0e] px-3.5 py-2.5 text-[13px] text-danger">
          {error}
        </div>
      )}

      <div>
        <div className="rm-toolbar">
          <div className="rm-seg hidepres" role="group" aria-label="Zoom">
            {zoomButtons.map((z) => (
              <button key={z.key} type="button" aria-pressed={zoom === z.key} onClick={() => setZoom(z.key)}>
                {z.label}
              </button>
            ))}
          </div>
          <div className="rm-tsep hidepres" />
          <button type="button" className="rm-btn hidepres" onClick={collapseAll}>Alles einklappen</button>
          <button type="button" className="rm-btn hidepres" onClick={expandAll}>Alles ausklappen</button>
          <button type="button" className="rm-btn hidepres" aria-pressed={showDeps} onClick={() => setShowDeps((v) => !v)}>
            Abhängigkeiten
          </button>
          {isModerator && (
            <>
              <div className="rm-tsep hidepres" />
              <button type="button" className="rm-btn hidepres" onClick={() => setBlockDialog({ block: null, parentId: null })}>
                + Block
              </button>
              <button type="button" className="rm-btn hidepres" onClick={() => setGoalDialogOpen(true)}>+ Ziel</button>
              <button type="button" className="rm-btn hidepres" onClick={() => setMilestoneDialog({ milestone: null })}>
                + Meilenstein
              </button>
              <button type="button" className="rm-btn hidepres" onClick={() => setPanelOpen((v) => !v)} title="Tickets aus Jira hinzufügen">
                ⧉ Tickets
              </button>
              <button type="button" className="rm-btn hidepres" onClick={() => setLanesDialogOpen(true)}>Streams</button>
              <button type="button" className="rm-btn hidepres" onClick={() => setLabelsDialogOpen(true)}>Labels</button>
              <button type="button" className="rm-btn danger hidepres" onClick={() => setConfirmRoadmapDelete(true)}>
                Löschen
              </button>
            </>
          )}
          <div className="rm-spacer" />
          <div className="rm-legend hidepres">
            <span><i style={{ background: "var(--open)" }} />Offen</span>
            <span><i style={{ background: "var(--wip)" }} />In Bearbeitung</span>
            <span><i style={{ background: "var(--ok)" }} />Ausgeführt</span>
          </div>
          <button type="button" className="rm-btn" aria-pressed={present} onClick={togglePresent}>
            Präsentationsmodus
          </button>
        </div>

        <RoadmapBoard
          roadmap={roadmap}
          items={items}
          zoom={zoom}
          present={present}
          showDeps={showDeps}
          open={open}
          selectedItemId={selectedItemId}
          isModerator={isModerator && !present}
          onToggle={toggle}
          onSelectItem={setSelectedItemId}
          onMoveItem={moveItem}
          onShiftBlock={shiftBlock}
          onMoveBlock={moveBlock}
          onDropIssue={addIssue}
          onEditBlock={(id) => {
            const block = roadmap.blocks.find((b) => b.id === id);
            if (block) setBlockDialog({ block, parentId: block.parentId });
          }}
          onEditMilestone={(m) => setMilestoneDialog({ milestone: m })}
        />
      </div>

      {isModerator && panelOpen && (
        <RoadmapSidePanel
          sprintIssues={sprintIssues}
          containedKeys={containedKeys}
          onClose={() => setPanelOpen(false)}
          onAdd={(issue) => {
            const firstLane = roadmap.lanes[0];
            if (firstLane) addIssue(issue, firstLane.id, null, currentDay, addDays(currentDay, 13));
          }}
        />
      )}

      {selectedItem && !present && (
        <RoadmapItemDrawer
          key={selectedItem.id}
          item={selectedItem}
          lanes={roadmap.lanes}
          blockOptions={options}
          blockPath={blockPath(roadmap.blocks, selectedItem.blockId)}
          labels={roadmap.labels}
          pending={pending}
          error={error}
          readOnly={!isModerator}
          onClose={() => setSelectedItemId(null)}
          onDelete={() => {
            const gone: RoadmapItemView = selectedItem;
            setSelectedItemId(null);
            setItems((prev) => prev.filter((i) => i.id !== gone.id));
            run(
              () => deleteItemAction(gone.id),
              () => setItems((prev) => [...prev, gone]),
            );
          }}
          onSavePlacement={(placement) => moveItem(selectedItem.id, placement)}
          onSaveGoal={(title, description, statusCategory, storyPoints) =>
            run(() => updateGoalAction(selectedItem.id, title, description, statusCategory, storyPoints))
          }
          onSaveLabels={(labelIds) => {
            setItems((prev) => prev.map((i) => (i.id === selectedItem.id ? { ...i, labelIds } : i)));
            run(() => setItemLabelsAction(selectedItem.id, labelIds));
          }}
        />
      )}

      {goalDialogOpen && (
        <RoadmapGoalDialog
          lanes={roadmap.lanes}
          blockOptions={options}
          defaultDate={currentDay}
          pending={pending}
          error={error}
          onClose={() => setGoalDialogOpen(false)}
          onCreate={(laneId, blockId, title, description, start, end, storyPoints) => {
            setGoalDialogOpen(false);
            run(() => addGoalAction(roadmap.id, laneId, blockId, title, description, start, end, storyPoints));
          }}
        />
      )}

      {blockDialog && (
        <RoadmapBlockDialog
          block={blockDialog.block}
          parentOptions={options}
          defaultParentId={blockDialog.parentId}
          pending={pending}
          error={error}
          onClose={() => setBlockDialog(null)}
          onCreate={(name, parentId, hue) => {
            setBlockDialog(null);
            run(() => createBlockAction(roadmap.id, name, parentId, hue));
          }}
          onUpdate={(name, hue) => {
            const block = blockDialog.block;
            setBlockDialog(null);
            if (block) run(() => updateBlockAction(block.id, name, hue));
          }}
          onDelete={() => {
            const block = blockDialog.block;
            setBlockDialog(null);
            if (block) setBlockToDelete(block);
          }}
        />
      )}

      {blockToDelete && (
        <RoadmapConfirmDialog
          title="Block löschen"
          message={`Block „${blockToDelete.name}" samt Unterblöcken löschen? Die Tickets bleiben erhalten und landen im Eingangskorb.`}
          confirmLabel="Löschen"
          pending={pending}
          onClose={() => setBlockToDelete(null)}
          onConfirm={() => {
            const id = blockToDelete.id;
            setBlockToDelete(null);
            run(() => deleteBlockAction(id));
          }}
        />
      )}

      {lanesDialogOpen && (
        <RoadmapLanesDialog
          lanes={roadmap.lanes}
          itemCountByLane={itemCountByLane}
          pending={pending}
          onClose={() => setLanesDialogOpen(false)}
          onCreate={(name) => run(() => createLaneAction(roadmap.id, name))}
          onRename={(id, name) => run(() => renameLaneAction(id, name))}
          onMove={(id, direction) => run(() => moveLaneAction(id, direction))}
          onDelete={(lane, count) => setLaneToDelete({ lane, count })}
        />
      )}

      {laneToDelete && (
        <RoadmapConfirmDialog
          title="Stream löschen"
          message={
            laneToDelete.count > 0
              ? `Stream „${laneToDelete.lane.name}" mit ${laneToDelete.count} ${laneToDelete.count === 1 ? "Ticket" : "Tickets"} löschen? Die Tickets werden mitgelöscht.`
              : `Stream „${laneToDelete.lane.name}" löschen?`
          }
          confirmLabel="Löschen"
          pending={pending}
          onClose={() => setLaneToDelete(null)}
          onConfirm={() => {
            const id = laneToDelete.lane.id;
            setLaneToDelete(null);
            run(() => deleteLaneAction(id));
          }}
        />
      )}

      {confirmRoadmapDelete && (
        <RoadmapConfirmDialog
          title="Roadmap löschen"
          message={`Roadmap „${roadmap.name}" mit allen Blöcken, Streams und Einträgen wirklich löschen?`}
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

      {labelsDialogOpen && (
        <RoadmapLabelsDialog
          labels={roadmap.labels}
          pending={pending}
          onClose={() => setLabelsDialogOpen(false)}
          onCreate={(name, color) => run(() => createLabelAction(roadmap.id, name, color))}
          onUpdate={(id, name, color) => run(() => updateLabelAction(id, name, color))}
          onDelete={(id) => run(() => deleteLabelAction(id))}
        />
      )}

      {milestoneDialog && (
        <RoadmapMilestoneDialog
          milestone={milestoneDialog.milestone}
          defaultDate={currentDay}
          pending={pending}
          error={error}
          onClose={() => setMilestoneDialog(null)}
          onSubmit={(title, date, color) => {
            const existing = milestoneDialog.milestone;
            setMilestoneDialog(null);
            run(() =>
              existing
                ? updateMilestoneAction(existing.id, title, date, color)
                : createMilestoneAction(roadmap.id, title, date, color),
            );
          }}
          onDelete={() => {
            const existing = milestoneDialog.milestone;
            setMilestoneDialog(null);
            if (existing) run(() => deleteMilestoneAction(existing.id));
          }}
        />
      )}
    </div>
  );
}
