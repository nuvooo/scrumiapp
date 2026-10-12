"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  DndContext, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragMoveEvent, type DragStartEvent,
} from "@dnd-kit/core";
import {
  ZOOM_DAY_WIDTH, addDays, dayDiff, dayIndexFromOffset, dayKey, formatDay, formatDayShort,
  monthHeaders, weekHeaders, weekOffset, type Zoom,
} from "@/lib/view/roadmapDays";
import {
  INBOX_ID, blockProgress, buildRows, buildTree, canMoveBlock, leaves, span, statusOf,
  type DropPosition, type RoadmapTree, type RowLane, type TreeBlock, type TreeItem,
} from "@/lib/view/roadmapTree";
import {
  clampSpan, deltaDays, issueDurationDays, shiftedSpan, ticketTarget, treeDropPosition,
  type DragMode, type DropTarget,
} from "@/lib/view/roadmapDrag";
import { laneHue } from "./itemColors";
import { DRAG_MIME, type SidePanelIssue } from "./RoadmapSidePanel";
import type { MilestoneView, Placement, RoadmapItemView, RoadmapView } from "./types";

const IND = (depth: number) => 4 + Math.min(depth, 6) * 12;
const TRACK_H = 30;

/** Daten am Draggable: was gezogen wird. */
type DragData =
  | { kind: "ticket"; item: TreeItem }
  | { kind: "block"; block: TreeBlock }
  | { kind: "grip"; block: TreeBlock };

/** Laufender Drag (Quelle der Wahrheit im Ref, Spiegel im State fürs Rendern). */
interface ActiveDrag {
  kind: DragData["kind"];
  /** Ticket-ID bzw. Block-ID */
  id: string;
  mode: DragMode;
  /** Ticket-Drag: Spurzelle/Blockzeile unter dem Zeiger */
  target: DropTarget | null;
  /** Griff-Drag: Zielblock und Position */
  treeDrop: { targetId: string | null; pos: DropPosition | "root" } | null;
}

interface Arrow {
  key: string;
  line: string;
  head: string;
}

/** Alles, was die Zeilen- und Balkenkomponenten vom Board brauchen. */
interface BoardCtx {
  roadmap: RoadmapView;
  tree: RoadmapTree;
  itemById: Map<string, RoadmapItemView>;
  laneNameById: Map<string, string>;
  dw: number;
  px: (i: number) => number;
  W: number;
  total: number;
  present: boolean;
  isModerator: boolean;
  selectedItemId: string | null;
  activeBlockId: string | null;
  drag: ActiveDrag | null;
  weekSnap: boolean;
  onToggle: (blockId: string) => void;
  onFocusBlock: (blockId: string | null) => void;
  onSelectItem: (itemId: string | null) => void;
  onEditBlock: (blockId: string) => void;
  onEditMilestone: (milestone: MilestoneView) => void;
  onBarKeyDown: (e: React.KeyboardEvent<HTMLDivElement>, item: TreeItem) => void;
}

const sameTarget = (a: DropTarget | null, b: DropTarget | null) =>
  a === b ||
  (!!a && !!b && a.kind === b.kind &&
    (a.kind !== "cell" || (b.kind === "cell" && a.laneId === b.laneId && a.blockId === b.blockId)) &&
    (a.kind !== "row" || (b.kind === "row" && a.blockId === b.blockId)));

export function RoadmapBoard({
  roadmap,
  items,
  zoom,
  present,
  showDeps,
  open,
  selectedItemId,
  activeBlockId,
  todayRequest,
  isModerator,
  onToggle,
  onFocusBlock,
  onSelectItem,
  onMoveItem,
  onShiftBlock,
  onMoveBlock,
  onDropIssue,
  onEditBlock,
  onEditMilestone,
}: {
  roadmap: RoadmapView;
  items: RoadmapItemView[];
  zoom: Zoom;
  present: boolean;
  showDeps: boolean;
  open: Set<string>;
  selectedItemId: string | null;
  /** Zuletzt angeklickter Block (hervorgehoben; Kontext für „Hinzufügen“) */
  activeBlockId: string | null;
  /** Jede Änderung scrollt zum heutigen Tag */
  todayRequest: number;
  isModerator: boolean;
  onToggle: (blockId: string) => void;
  onFocusBlock: (blockId: string | null) => void;
  onSelectItem: (itemId: string | null) => void;
  onMoveItem: (itemId: string, placement: Placement) => void;
  onShiftBlock: (blockId: string, deltaDays: number, itemIds: string[]) => void;
  onMoveBlock: (blockId: string, targetId: string | null, position: DropPosition) => void;
  onDropIssue: (issue: SidePanelIssue, laneId: string, blockId: string | null, startDate: string, endDate: string) => void;
  onEditBlock: (blockId: string) => void;
  onEditMilestone: (milestone: MilestoneView) => void;
}) {
  const dw = ZOOM_DAY_WIDTH[zoom];
  const px = (i: number) => i * dw;
  const total = Math.max(dayDiff(roadmap.startDate, roadmap.endDate) + 1, 1);
  const W = px(total);
  const todayIndex = dayDiff(roadmap.startDate, dayKey(new Date()));

  const boardRef = useRef<HTMLDivElement | null>(null);
  const rowsRef = useRef<HTMLDivElement | null>(null);
  const headClRef = useRef<HTMLDivElement | null>(null);

  const [drag, setDrag] = useState<ActiveDrag | null>(null);
  const [weekSnap, setWeekSnap] = useState(false);
  const [overlay, setOverlay] = useState<{ height: number; lw: number; arrows: Arrow[] }>({ height: 0, lw: 312, arrows: [] });
  const dragRef = useRef<ActiveDrag | null>(null);
  const weekSnapRef = useRef(false);
  const pointerRef = useRef({ x: 0, y: 0 });

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const laneNameById = useMemo(() => new Map(roadmap.lanes.map((l) => [l.id, l.name])), [roadmap.lanes]);
  const treeItems: TreeItem[] = useMemo(
    () =>
      items.map((i) => ({
        id: i.id,
        blockId: i.blockId,
        laneId: i.laneId,
        start: dayDiff(roadmap.startDate, i.startDate),
        end: dayDiff(roadmap.startDate, i.endDate),
        statusCategory: i.statusCategory,
        storyPoints: i.storyPoints,
        position: i.position,
      })),
    [items, roadmap.startDate],
  );
  const tree = useMemo(() => buildTree(roadmap.blocks, treeItems), [roadmap.blocks, treeItems]);
  const rows = useMemo(() => {
    const eff = present ? new Set([...open, ...tree.roots.map((r) => r.id)]) : open;
    return buildRows(tree, roadmap.lanes, { open: eff, present });
  }, [tree, roadmap.lanes, open, present]);
  const months = useMemo(() => monthHeaders(roadmap.startDate, roadmap.endDate), [roadmap.startDate, roadmap.endDate]);
  const weeks = useMemo(() => weekHeaders(roadmap.startDate, roadmap.endDate, zoom), [roadmap.startDate, roadmap.endDate, zoom]);
  const wo = weekOffset(roadmap.startDate);
  const jiraKeyToItem = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of items) if (i.jiraKey) m.set(i.jiraKey, i.id);
    return m;
  }, [items]);

  // Beim ersten Rendern so scrollen, dass „heute" nahe am linken Rand liegt.
  useEffect(() => {
    const el = boardRef.current;
    if (!el || todayIndex < 0) return;
    el.scrollLeft = Math.max(0, px(todayIndex) - 120);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // „Heute“-Button in der Werkzeugleiste: sanft zum heutigen Tag scrollen.
  useEffect(() => {
    const el = boardRef.current;
    if (!todayRequest || !el || todayIndex < 0) return;
    el.scrollTo({ left: Math.max(0, px(todayIndex) - 120), behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayRequest]);

  // Das Board füllt die freie Höhe bis zum unteren Rand des Viewports (statt
  // einer festen Maximalhöhe): Fensterhöhe minus Oberkante des Boards minus
  // unterer Innenabstand von <main>. Neu messen bei Resize und wenn sich der
  // Kopfbereich darüber umbricht (Body-Größe ändert sich).
  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const main = el.closest("main");
    const update = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      const pad = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0;
      const h = Math.max(320, Math.floor(window.innerHeight - top - pad));
      el.style.setProperty("--rm-board-h", `${h}px`);
    };
    update();
    window.addEventListener("resize", update);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(document.body);
    return () => {
      window.removeEventListener("resize", update);
      ro?.disconnect();
    };
  }, [present]);

  // Overlay: Höhe, Breite der linken Spalte und Abhängigkeitspfeile aus den gemessenen Balken.
  useLayoutEffect(() => {
    const rowsEl = rowsRef.current;
    if (!rowsEl) return;
    const height = rowsEl.scrollHeight;
    const lw = headClRef.current?.getBoundingClientRect().width ?? overlay.lw;
    const arrows: Arrow[] = [];
    if (showDeps && !present) {
      const wrap = rowsEl.getBoundingClientRect();
      for (const item of items) {
        for (const depKey of item.blockedBy) {
          const depId = jiraKeyToItem.get(depKey);
          if (!depId) continue;
          const a = rowsEl.querySelector<HTMLElement>(`.rm-bar[data-item="${depId}"]`);
          const b = rowsEl.querySelector<HTMLElement>(`.rm-bar[data-item="${item.id}"]`);
          if (!a || !b) continue;
          const ra = a.getBoundingClientRect();
          const rb = b.getBoundingClientRect();
          const x1 = ra.right - wrap.left;
          const y1 = ra.top + ra.height / 2 - wrap.top;
          const x2 = rb.left - wrap.left;
          const y2 = rb.top + rb.height / 2 - wrap.top;
          arrows.push({
            key: `${depId}->${item.id}`,
            line: `M${x1} ${y1} H${x1 + 8} V${y2} H${x2 - 6}`,
            head: `M${x2 - 6} ${y2 - 3.5} L${x2} ${y2} L${x2 - 6} ${y2 + 3.5} Z`,
          });
        }
      }
    }
    const same =
      overlay.height === height && overlay.lw === lw && overlay.arrows.length === arrows.length &&
      overlay.arrows.every((x, i) => x.key === arrows[i].key && x.line === arrows[i].line);
    if (!same) setOverlay({ height, lw, arrows });
  });

  // Während eines Drags: Zeigerposition (für davor/hinein/danach) und Umschalt-Taste (Wochenraster) mitführen.
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY };
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Shift") return;
      weekSnapRef.current = e.type === "keydown";
      setWeekSnap(weekSnapRef.current);
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", key);
    return () => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", key);
    };
  }, [dragging]);

  // ---------- Drag & Drop (dnd-kit) ----------
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const updateDrag = (next: ActiveDrag | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as DragData | undefined;
    if (!data) return;
    const ev = e.activatorEvent as PointerEvent;
    pointerRef.current = { x: ev.clientX, y: ev.clientY };
    weekSnapRef.current = !!ev.shiftKey;
    setWeekSnap(weekSnapRef.current);
    const target = ev.target as HTMLElement | null;
    const hdl = data.kind === "ticket" && target?.closest ? target.closest(".rm-hdl") : null;
    const mode: DragMode = hdl ? (hdl.classList.contains("l") ? "resizeL" : "resizeR") : "move";
    updateDrag({
      kind: data.kind,
      id: data.kind === "ticket" ? data.item.id : data.block.id,
      mode,
      target: null,
      treeDrop: null,
    });
  };

  const onDragMove = (e: DragMoveEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const over = e.over?.data.current as DropTarget | undefined;
    if (d.kind === "grip") {
      const node = tree.byId.get(d.id);
      let treeDrop: ActiveDrag["treeDrop"] = null;
      if (over && node && e.over) {
        if (over.kind === "miles") {
          if (node.parent) treeDrop = { targetId: null, pos: "root" };
        } else if (over.kind === "row" && over.blockId) {
          const target = tree.byId.get(over.blockId);
          if (target && canMoveBlock(node, target)) {
            const r = e.over.rect;
            const rel = r.height > 0 ? (pointerRef.current.y - r.top) / r.height : 0.5;
            treeDrop = { targetId: target.id, pos: treeDropPosition(rel) };
          }
        }
      }
      if (treeDrop?.targetId !== d.treeDrop?.targetId || treeDrop?.pos !== d.treeDrop?.pos) updateDrag({ ...d, treeDrop });
      return;
    }
    if (d.kind === "ticket" && d.mode === "move") {
      const target = over ?? null;
      if (!sameTarget(target, d.target)) updateDrag({ ...d, target });
    }
  };

  const finishDrag = () => {
    updateDrag(null);
    weekSnapRef.current = false;
    setWeekSnap(false);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const d = dragRef.current;
    const weeks = weekSnapRef.current;
    finishDrag();
    const data = e.active.data.current as DragData | undefined;
    if (!d || !data) return;

    if (data.kind === "grip") {
      const td = d.treeDrop;
      if (!td) return;
      if (td.pos === "root") onMoveBlock(d.id, null, "into");
      else if (td.targetId) onMoveBlock(d.id, td.targetId, td.pos);
      return;
    }

    const delta = deltaDays(e.delta.x, dw, weeks);
    if (data.kind === "block") {
      if (delta !== 0) onShiftBlock(d.id, delta, leaves(data.block).map((t) => t.id));
      return;
    }

    const item = data.item;
    const next = clampSpan(shiftedSpan({ start: item.start, end: item.end }, d.mode, delta), d.mode, total);
    const tgt = d.mode === "move" ? ticketTarget(item, d.target) : { laneId: item.laneId, blockId: item.blockId };
    const unchanged =
      next.start === item.start && next.end === item.end && tgt.laneId === item.laneId && tgt.blockId === item.blockId;
    if (unchanged) return;
    onMoveItem(item.id, {
      laneId: tgt.laneId,
      blockId: tgt.blockId,
      startDate: addDays(roadmap.startDate, next.start),
      endDate: addDays(roadmap.startDate, next.end),
    });
  };

  const onBarKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, item: TreeItem) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSelectItem(item.id);
      return;
    }
    if (!isModerator || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    e.preventDefault();
    const d = (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 7 : 1);
    const next = clampSpan({ start: item.start + d, end: item.end + d }, "move", total);
    if (next.start === item.start) return;
    onMoveItem(item.id, {
      laneId: item.laneId,
      blockId: item.blockId,
      startDate: addDays(roadmap.startDate, next.start),
      endDate: addDays(roadmap.startDate, next.end),
    });
  };

  // ---------- Drop aus dem Offcanvas (HTML5-DnD) ----------
  const onDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DRAG_MIME)) e.preventDefault();
  };
  const onDrop = (e: React.DragEvent) => {
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    e.preventDefault();
    const issue = JSON.parse(raw) as SidePanelIssue;
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const cell = under?.closest<HTMLElement>("[data-lane-cell]");
    const blockRow = under?.closest<HTMLElement>(".rm-row[data-blockid]");
    const firstLane = roadmap.lanes[0]?.id ?? "";
    const laneId = cell?.dataset.lane || firstLane;
    const blockId = cell ? cell.dataset.block || null : blockRow?.dataset.blockid ?? null;
    const rowsRect = rowsRef.current?.getBoundingClientRect();
    const x = rowsRect ? e.clientX - rowsRect.left - overlay.lw : 0;
    const startIdx = dayIndexFromOffset(x, dw, total);
    const days = issueDurationDays(issue, dayDiff);
    const endIdx = Math.min(startIdx + days - 1, total - 1);
    onDropIssue(issue, laneId, blockId, addDays(roadmap.startDate, startIdx), addDays(roadmap.startDate, endIdx));
  };

  // ---------- Rendering ----------
  const ctx: BoardCtx = {
    roadmap, tree, itemById, laneNameById, dw, px, W, total, present, isModerator,
    selectedItemId, activeBlockId, drag, weekSnap,
    onToggle, onFocusBlock, onSelectItem, onEditBlock, onEditMilestone, onBarKeyDown,
  };

  const boardClass = `rm-board ${drag?.kind === "grip" ? "treedrag" : ""} ${drag ? "dragging" : ""}`;
  const announcements = {
    onDragStart: () => "Ziehen gestartet.",
    onDragOver: () => "",
    onDragEnd: () => "Abgelegt.",
    onDragCancel: () => "Ziehen abgebrochen.",
  };

  return (
    <DndContext
      id={`rm-dnd-${roadmap.id}`}
      sensors={sensors}
      collisionDetection={pointerWithin}
      autoScroll={{ threshold: { x: 0.12, y: 0.15 } }}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={finishDrag}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: "Balken mit der Maus ziehen: waagerecht verschiebt den Termin, an den Rändern ändert die Dauer, senkrecht wechselt Spur oder Block. Tastatur: Pfeil links/rechts verschiebt tageweise, mit Umschalt wochenweise, Enter öffnet Details.",
        },
      }}
    >
      <div ref={boardRef} className={boardClass} style={{ "--dw": dw, "--wo": `${px(wo)}px` } as React.CSSProperties}>
        <div ref={rowsRef} className="rm-rows" onDragOver={onDragOver} onDrop={onDrop}>
          {/* Kopfzeile */}
          <div className="rm-row rm-head">
            <div className="rm-cl" ref={headClRef}>
              <div className="rm-headlabel">
                <div className="t">Blockstruktur</div>
                <div className="s hidepres">{isModerator ? "Pfeil = aufklappbar · Griff = umhängen" : "Pfeil = aufklappbar"}</div>
              </div>
            </div>
            <div className="rm-cr" style={{ width: W }}>
              <div className="rm-hmonths">
                {months.map((m) => (
                  <div key={m.key} className={`rm-hmonth ${m.quarterStart ? "q" : ""}`} style={{ left: px(m.start), width: px(m.days) }}>
                    {m.label}
                  </div>
                ))}
              </div>
              <div className="rm-hweeks">
                {weeks.map((w) => (
                  <div key={w.start} className={zoom === "q" ? "rm-hsprint" : "rm-hweek"} style={{ left: px(w.start), width: px(w.days) }}>
                    {w.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {rows.map((r) => {
            if (r.type === "miles") return <MilesRow key="miles" ctx={ctx} />;
            if (r.type === "lane") return <LaneRow key={`lane:${r.block.id}:${r.laneId}`} r={r} ctx={ctx} />;
            return <BlockRow key={`block:${r.block.id}`} block={r.block} open={r.open} groupFirst={r.groupFirst} inbox={r.inbox} ctx={ctx} />;
          })}

          {/* Overlay: Heute-Linie, Meilensteinlinien, Abhängigkeitspfeile */}
          <svg className="rm-ovl" width={overlay.lw + W} height={overlay.height}>
            {roadmap.milestones.map((m) => {
              const idx = dayDiff(roadmap.startDate, m.date);
              if (idx < 0 || idx >= total) return null;
              const x = overlay.lw + px(idx);
              return <line key={m.id} className="rm-msline" x1={x} y1={48} x2={x} y2={overlay.height} stroke={m.color} />;
            })}
            {todayIndex >= 0 && todayIndex < total && (
              <>
                <line className="rm-todayline" x1={overlay.lw + px(todayIndex) + dw / 2} y1={48} x2={overlay.lw + px(todayIndex) + dw / 2} y2={overlay.height} />
                <text className="rm-todaytag" x={overlay.lw + px(todayIndex) + dw / 2 + 4} y={62}>heute</text>
              </>
            )}
            {overlay.arrows.map((a) => (
              <g key={a.key}>
                <path className="rm-dep" d={a.line} />
                <path className="rm-dephead" d={a.head} />
              </g>
            ))}
          </svg>
        </div>
      </div>
    </DndContext>
  );
}

// ---------- Bausteine der linken Spalte ----------

const chevron = (
  <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true">
    <path d="M2.5 1 L6.5 4.5 L2.5 8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const gripIcon = (
  <svg width="8" height="12" viewBox="0 0 8 12" aria-hidden="true">
    <g fill="currentColor">
      <circle cx="1.5" cy="2" r="1.1" /><circle cx="6.5" cy="2" r="1.1" />
      <circle cx="1.5" cy="6" r="1.1" /><circle cx="6.5" cy="6" r="1.1" />
      <circle cx="1.5" cy="10" r="1.1" /><circle cx="6.5" cy="10" r="1.1" />
    </g>
  </svg>
);
const guides = (depth: number) =>
  Array.from({ length: depth }, (_, i) => <div key={i} className="rm-guide" style={{ left: IND(i) + 23 }} />);
const bands = (block: TreeBlock) =>
  block.bands.map((h, i) => <div key={i} className="rm-band" style={{ left: i * 4, background: `hsl(${h} 48% 50%)` }} />);

/** Griff zum Umhängen eines Blocks im Baum. */
function Grip({ block, ctx }: { block: TreeBlock; ctx: BoardCtx }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: `grip:${block.id}`, data: { kind: "grip", block } satisfies DragData });
  const dragging = ctx.drag?.kind === "grip" && ctx.drag.id === block.id;
  return (
    <div
      ref={setNodeRef}
      className={`rm-grip ${dragging ? "active" : ""}`}
      title="Ziehen, um den Block umzuhängen"
      {...attributes}
      aria-label={`Block ${block.name} umhängen`}
      {...listeners}
      onClick={(e) => e.stopPropagation()}
    >
      {gripIcon}
    </div>
  );
}

// ---------- Zeilen ----------

function MilesRow({ ctx }: { ctx: BoardCtx }) {
  const { roadmap, px, W, total, isModerator, drag, onEditMilestone } = ctx;
  const { setNodeRef } = useDroppable({ id: "miles", data: { kind: "miles" } satisfies DropTarget, disabled: !isModerator });
  const dropRoot = drag?.kind === "grip" && drag.treeDrop?.pos === "root";
  return (
    <div ref={setNodeRef} className={`rm-row rm-msrow ${dropRoot ? "dropinto" : ""}`}>
      <div className="rm-cl" style={{ height: 34 }}>
        <div className="rm-tw" style={{ paddingLeft: 14 }}>
          <span className="rm-nm" style={{ color: "var(--ink-3)", fontWeight: 500, marginLeft: 0 }}>Meilensteine</span>
        </div>
      </div>
      <div className="rm-cr grid" style={{ width: W, height: 34 }}>
        {roadmap.milestones.map((m) => {
          const idx = Math.min(Math.max(dayDiff(roadmap.startDate, m.date), 0), total - 1);
          return (
            <button
              key={m.id}
              type="button"
              className={`rm-ms ${isModerator ? "editable" : ""}`}
              style={{ left: px(idx), "--mc": m.color } as React.CSSProperties}
              title={`${m.title} · ${formatDay(m.date)}`}
              onClick={isModerator ? () => onEditMilestone(m) : undefined}
            >
              <i />
              <span>{m.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LaneRow({ r, ctx }: { r: RowLane; ctx: BoardCtx }) {
  const { W, isModerator, drag } = ctx;
  const depth = r.block.depth + 1;
  const hue = r.block.effectiveHue;
  const parallel = r.tracks.length > 1;
  const h = r.tracks.length * TRACK_H + 8;
  const sp = r.tracks.flat().reduce((s, t) => s + t.storyPoints, 0);
  const blockId = r.inbox ? null : r.block.id;
  const { setNodeRef } = useDroppable({
    id: `cell:${blockId ?? INBOX_ID}:${r.laneId}`,
    data: { kind: "cell", laneId: r.laneId, blockId } satisfies DropTarget,
    disabled: !isModerator,
  });
  const isDrop =
    drag?.kind === "ticket" && drag.target?.kind === "cell" && drag.target.laneId === r.laneId && drag.target.blockId === blockId;
  return (
    <div ref={setNodeRef} className={`rm-row lane ${isDrop ? "droptarget" : ""}`} style={{ "--rh": hue } as React.CSSProperties}>
      <div className="rm-cl" style={{ height: h }}>
        <div className="rm-tw" style={{ paddingLeft: IND(depth) }}>
          {guides(depth)}
          <div className="rm-grip gripspace" />
          <div className="rm-lanemark" />
          <div className="rm-av" style={{ background: `hsl(${laneHue(r.laneIndex)} 44% 46%)` }}>
            {r.laneName.slice(0, 2).toUpperCase()}
          </div>
          <div className="rm-nm">{r.laneName}</div>
          <div className="rm-meta">
            {parallel && <span className="rm-warnchip">{r.tracks.length} parallel</span>}
            <span className="rm-cnt">{sp} SP</span>
          </div>
        </div>
        {bands(r.block)}
      </div>
      <div className="rm-cr grid" style={{ width: W, height: h }} data-lane-cell data-lane={r.laneId} data-block={blockId ?? ""}>
        {r.tracks.map((track, ti) =>
          track.map((t) => <TicketBar key={t.id} t={t} hue={hue} top={4 + ti * TRACK_H} ctx={ctx} />),
        )}
      </div>
    </div>
  );
}

function BlockRow({
  block: n,
  open,
  groupFirst,
  inbox,
  ctx,
}: {
  block: TreeBlock;
  open: boolean;
  groupFirst: boolean;
  inbox: boolean;
  ctx: BoardCtx;
}) {
  const { W, isModerator, drag, activeBlockId, onToggle, onFocusBlock, onEditBlock } = ctx;
  const blockId = inbox ? null : n.id;
  const { setNodeRef } = useDroppable({
    id: `row:${blockId ?? INBOX_ID}`,
    data: { kind: "row", blockId } satisfies DropTarget,
    disabled: !isModerator,
  });
  const all = leaves(n);
  const sp = span(all);
  const { done, total: cnt } = blockProgress(n);
  const subCount = n.children.length;
  const rowH = open ? 24 : 40;
  const ticketDrop = drag?.kind === "ticket" && drag.target?.kind === "row" && drag.target.blockId === blockId;
  const treeDrop = drag?.kind === "grip" && drag.treeDrop?.targetId === n.id ? drag.treeDrop.pos : null;
  const dropClass = treeDrop && treeDrop !== "root" ? `drop${treeDrop}` : ticketDrop ? "dropinto" : "";
  const srcClass = drag?.kind === "grip" && drag.id === n.id ? "srcdrag" : "";
  const activeClass = !inbox && activeBlockId === n.id ? "active" : "";
  return (
    <div
      ref={setNodeRef}
      className={`rm-row block lvl${Math.min(n.depth, 4)} ${groupFirst ? "grpfirst" : ""} ${dropClass} ${srcClass} ${activeClass}`}
      data-blockid={inbox ? undefined : n.id}
      style={{ "--rh": n.effectiveHue } as React.CSSProperties}
    >
      <div
        className="rm-cl"
        style={{ height: rowH }}
        onClick={() => {
          onToggle(n.id);
          onFocusBlock(inbox ? null : n.id);
        }}
      >
        <div className="rm-tw" style={{ paddingLeft: IND(n.depth) }}>
          {guides(n.depth)}
          {isModerator && !inbox ? <Grip block={n} ctx={ctx} /> : <div className="rm-grip gripspace" />}
          <button
            type="button"
            className="rm-chev"
            aria-expanded={open}
            aria-label={`${open ? "Einklappen" : "Ausklappen"}: ${n.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(n.id);
            }}
          >
            {chevron}
          </button>
          <div className="rm-nm">{n.name}</div>
          <div className="rm-meta">
            {isModerator && !inbox && (
              <button
                type="button"
                className="rm-edit hidepres"
                aria-label={`Block ${n.name} bearbeiten`}
                title="Block bearbeiten"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditBlock(n.id);
                }}
              >
                ✎
              </button>
            )}
            {subCount > 0 && <span className="rm-cnt sub">{subCount} {subCount === 1 ? "Block" : "Blöcke"}</span>}
            <span className={`rm-cnt ${cnt > 0 && done === cnt ? "full" : ""}`}>{done}/{cnt}</span>
          </div>
        </div>
        {bands(n)}
      </div>
      <div className="rm-cr grid" style={{ width: W, height: rowH }}>
        {sp && <BlockBar block={n} sp={sp} open={open} done={done} cnt={cnt} all={all} ctx={ctx} />}
        {!sp && !open && !inbox && (
          <span
            className="rm-nm"
            style={{ position: "absolute", left: 10, top: 12, color: "var(--ink-3)", fontWeight: 400, fontSize: 11, marginLeft: 0 }}
          >
            noch keine Tickets — per Drag hierher oder über „+ Hinzufügen“
          </span>
        )}
      </div>
    </div>
  );
}

// ---------- Balken ----------

/** Zusammenfassungs-Balken eines Blocks: schmal bei offenem, breit mit Fortschritt bei eingeklapptem Block. */
function BlockBar({
  block: n,
  sp,
  open,
  done,
  cnt,
  all,
  ctx,
}: {
  block: TreeBlock;
  sp: { start: number; end: number };
  open: boolean;
  done: number;
  cnt: number;
  all: TreeItem[];
  ctx: BoardCtx;
}) {
  const { roadmap, px, dw, isModerator, weekSnap } = ctx;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `block:${n.id}`,
    data: { kind: "block", block: n } satisfies DragData,
    disabled: !isModerator,
  });
  const delta = isDragging && transform ? deltaDays(transform.x, dw, weekSnap) : 0;
  const style = {
    "--h": n.effectiveHue,
    left: px(sp.start),
    width: Math.max(px(sp.end - sp.start + 1), 12),
    top: open ? 8 : 9,
    transform: delta !== 0 ? `translate3d(${px(delta)}px, 0, 0)` : undefined,
  } as React.CSSProperties;
  const start = addDays(roadmap.startDate, sp.start + delta);
  const end = addDays(roadmap.startDate, sp.end + delta);
  const common = {
    ref: setNodeRef,
    style,
    ...attributes,
    ...listeners,
    "aria-label": `${n.name} verschieben`,
  };
  const tip = isDragging && (
    <div className="rm-dragtip" style={{ left: px(sp.start + delta), top: (open ? 8 : 9) - 26 }}>
      {formatDay(start)} – {formatDay(end)}{delta !== 0 && ` · ${delta > 0 ? "+" : ""}${delta} Tage`}
    </div>
  );
  if (open) {
    return (
      <>
        <div
          {...common}
          className={`rm-bar summary ${isDragging ? "dragging" : ""} ${isModerator ? "" : "ro"}`}
          title={`${n.name} · ${formatDayShort(start)}–${formatDay(end)}`}
        />
        {tip}
      </>
    );
  }
  return (
    <>
      <div
        {...common}
        className={`rm-bar blockbar ${isDragging ? "dragging" : ""} ${isModerator ? "" : "ro"}`}
        title={`${n.name} · ${formatDay(start)} – ${formatDay(end)}`}
      >
        <div className="rm-prog" style={{ width: `${cnt > 0 ? ((done / cnt) * 100).toFixed(1) : 0}%` }} />
        <span className="lbl">{n.name}</span>
        <span className="rm-pct">{done}/{cnt}</span>
        {all.map((t) => (
          <div key={t.id} className="rm-segtick" style={{ left: px(t.end + 1 - sp.start) }} />
        ))}
      </div>
      {tip}
    </>
  );
}

/** Ticket-Balken: verschiebbar (auch in andere Spur/Block), an den Rändern in der Dauer änderbar. */
function TicketBar({ t, hue, top, ctx }: { t: TreeItem; hue: number; top: number; ctx: BoardCtx }) {
  const { roadmap, tree, itemById, laneNameById, px, dw, total, isModerator, selectedItemId, drag, weekSnap, onSelectItem, onBarKeyDown } = ctx;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `ticket:${t.id}`,
    data: { kind: "ticket", item: t } satisfies DragData,
    disabled: !isModerator,
  });
  const view = itemById.get(t.id);
  if (!view) return null;
  const st = statusOf(t.statusCategory);
  const base = { start: t.start, end: t.end };
  const mode: DragMode = drag?.kind === "ticket" && drag.id === t.id ? drag.mode : "move";
  const active = isDragging && !!transform;

  let shown = base;
  let tx = 0;
  let ty = 0;
  let tip: React.ReactNode = null;
  if (active) {
    const delta = deltaDays(transform.x, dw, weekSnap);
    if (mode === "move") {
      tx = px(delta);
      ty = transform.y;
    } else {
      shown = shiftedSpan(base, mode, delta);
      if (mode === "resizeL") tx = px(shown.start - base.start);
    }
    const result = clampSpan(mode === "move" ? shiftedSpan(base, "move", delta) : shown, mode, total);
    const len = result.end - result.start + 1;
    let where = "";
    if (mode === "move" && drag?.target) {
      const tgt = ticketTarget(t, drag.target);
      if (tgt.laneId !== t.laneId || tgt.blockId !== t.blockId) {
        const laneName = tgt.laneId !== t.laneId ? laneNameById.get(tgt.laneId) ?? "" : "";
        const blockName = tgt.blockId !== t.blockId ? (tgt.blockId ? tree.byId.get(tgt.blockId)?.name ?? "" : "Eingangskorb") : "";
        where = ` → ${[laneName, blockName].filter(Boolean).join(" · ")}`;
      }
    }
    tip = (
      <div className="rm-dragtip" style={{ left: px(base.start) + tx, top: top - 26, transform: ty ? `translate3d(0, ${ty}px, 0)` : undefined }}>
        {formatDay(addDays(roadmap.startDate, result.start))} – {formatDay(addDays(roadmap.startDate, result.end))} · {len} {len === 1 ? "Tag" : "Tage"}{where}
      </div>
    );
  }
  const style = {
    "--h": hue,
    left: px(base.start),
    width: Math.max(px(shown.end - shown.start + 1), 26),
    top,
    transform: tx || ty ? `translate3d(${tx}px, ${ty}px, 0)` : undefined,
  } as React.CSSProperties;

  return (
    <>
      <div
        ref={setNodeRef}
        className={`rm-bar ticket ${st} ${selectedItemId === t.id ? "sel" : ""} ${active ? "dragging" : ""} ${isModerator ? "" : "ro"}`}
        style={style}
        data-item={t.id}
        title={`${view.jiraKey ? `${view.jiraKey} · ` : ""}${view.title}\n${formatDay(addDays(roadmap.startDate, t.start))} – ${formatDay(addDays(roadmap.startDate, t.end))} · ${t.storyPoints} SP`}
        {...attributes}
        role="button"
        tabIndex={0}
        aria-label={`${view.jiraKey ? `${view.jiraKey} ` : ""}${view.title}`}
        {...listeners}
        onClick={() => onSelectItem(t.id)}
        onKeyDown={(e) => onBarKeyDown(e, t)}
      >
        <span className={`rm-st ${st}`} />
        {view.jiraKey && <span className="key hidepres">{view.jiraKey}</span>}
        <span className="lbl">{view.title}</span>
        {t.storyPoints > 0 && <span className="rm-sp hidepres">{t.storyPoints}</span>}
        {isModerator && (
          <>
            <div className="rm-hdl l" />
            <div className="rm-hdl r" />
          </>
        )}
      </div>
      {tip}
    </>
  );
}

export { INBOX_ID };
