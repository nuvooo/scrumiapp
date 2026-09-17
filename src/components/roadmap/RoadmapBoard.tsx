"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ZOOM_DAY_WIDTH, addDays, dayDiff, dayIndexFromOffset, dayKey, formatDay, formatDayShort,
  monthHeaders, weekHeaders, weekOffset, type Zoom,
} from "@/lib/view/roadmapDays";
import {
  INBOX_ID, blockProgress, buildRows, buildTree, canMoveBlock, leaves, span, statusOf,
  type DropPosition, type RowLane, type TreeBlock, type TreeItem,
} from "@/lib/view/roadmapTree";
import { laneHue } from "./itemColors";
import { DRAG_MIME, type SidePanelIssue } from "./RoadmapSidePanel";
import type { MilestoneView, Placement, RoadmapItemView, RoadmapView } from "./types";

const IND = (depth: number) => 4 + Math.min(depth, 6) * 12;
const TRACK_H = 30;
/** Standarddauer neu abgelegter Tickets (2 Wochen) */
const DEFAULT_SPAN_DAYS = 13;

interface DragCtx {
  kind: "ticket" | "block";
  id: string;
  mode: "move" | "resizeL" | "resizeR";
  startX: number;
  startY: number;
  orig: { id: string; start: number; end: number }[];
  ownLaneId: string;
  ownBlockId: string | null;
  moved: boolean;
  delta: number;
  dropCell: { laneId: string; blockId: string | null } | null;
}

interface TreeDragCtx {
  blockId: string;
  targetId: string | null;
  pos: DropPosition | "root" | null;
}

interface Arrow {
  key: string;
  line: string;
  head: string;
}

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

  const [preview, setPreview] = useState<Map<string, { start: number; end: number }> | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropCell, setDropCell] = useState<{ laneId: string; blockId: string | null } | null>(null);
  const [treeDrag, setTreeDrag] = useState<TreeDragCtx | null>(null);
  const [overlay, setOverlay] = useState<{ height: number; lw: number; arrows: Arrow[] }>({ height: 0, lw: 312, arrows: [] });
  const dragRef = useRef<DragCtx | null>(null);
  const treeDragRef = useRef<TreeDragCtx | null>(null);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const treeItems: TreeItem[] = useMemo(
    () =>
      items.map((i) => {
        const p = preview?.get(i.id);
        return {
          id: i.id,
          blockId: i.blockId,
          laneId: i.laneId,
          start: p ? p.start : dayDiff(roadmap.startDate, i.startDate),
          end: p ? p.end : dayDiff(roadmap.startDate, i.endDate),
          statusCategory: i.statusCategory,
          storyPoints: i.storyPoints,
          position: i.position,
        };
      }),
    [items, preview, roadmap.startDate],
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

  // ---------- Balken-Drag (Ticket / Block) ----------
  const beginDrag = (e: React.PointerEvent<HTMLDivElement>, ctx: { kind: "ticket"; item: TreeItem } | { kind: "block"; block: TreeBlock }) => {
    if (e.button !== 0) return;
    if (!isModerator) {
      if (ctx.kind === "ticket") onSelectItem(ctx.item.id);
      return;
    }
    const target = e.target as HTMLElement;
    const mode: DragCtx["mode"] =
      ctx.kind === "ticket" && target.classList.contains("rm-hdl")
        ? target.classList.contains("l") ? "resizeL" : "resizeR"
        : "move";
    const list = ctx.kind === "block" ? leaves(ctx.block) : [ctx.item];
    dragRef.current = {
      kind: ctx.kind,
      id: ctx.kind === "block" ? ctx.block.id : ctx.item.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      orig: list.map((t) => ({ id: t.id, start: t.start, end: t.end })),
      ownLaneId: ctx.kind === "ticket" ? ctx.item.laneId : "",
      ownBlockId: ctx.kind === "ticket" ? ctx.item.blockId : null,
      moved: false,
      delta: 0,
      dropCell: null,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const moveDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
    if (!d.moved) {
      d.moved = true;
      setDraggingId(d.id);
    }
    let delta = Math.round(dx / dw);
    if (e.shiftKey) delta = Math.round(delta / 7) * 7;
    d.delta = delta;
    const next = new Map<string, { start: number; end: number }>();
    for (const o of d.orig) {
      if (d.mode === "move") next.set(o.id, { start: o.start + delta, end: o.end + delta });
      else if (d.mode === "resizeR") next.set(o.id, { start: o.start, end: Math.max(o.start, o.end + delta) });
      else next.set(o.id, { start: Math.min(o.end, o.start + delta), end: o.end });
    }
    setPreview(next);

    if (d.kind === "ticket" && d.mode === "move") {
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const cell = under?.closest<HTMLElement>("[data-lane-cell]") ?? null;
      // Spurzelle = Stream + Block; Blockzeile (auch ohne Spuren) = Block, Stream bleibt; Eingangskorb-Zeile = kein Block.
      const blockRow = cell ? null : under?.closest<HTMLElement>(".rm-row.block") ?? null;
      const nextCell = cell
        ? { laneId: cell.dataset.lane ?? "", blockId: cell.dataset.block || null }
        : blockRow
          ? { laneId: "", blockId: blockRow.dataset.blockid ?? null }
          : null;
      const changed = (nextCell?.laneId ?? null) !== (d.dropCell?.laneId ?? null) || (nextCell?.blockId ?? null) !== (d.dropCell?.blockId ?? null) || !!nextCell !== !!d.dropCell;
      if (changed) {
        d.dropCell = nextCell;
        setDropCell(nextCell);
      }
    }
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* Pointer schon freigegeben */
    }
    setDraggingId(null);
    setDropCell(null);
    setPreview(null);
    if (!d.moved) {
      if (d.kind === "ticket") onSelectItem(d.id);
      return;
    }
    if (d.kind === "block") {
      if (d.delta !== 0) onShiftBlock(d.id, d.delta, d.orig.map((o) => o.id));
      return;
    }
    const o = d.orig[0];
    let start = o.start;
    let end = o.end;
    if (d.mode === "move") {
      start += d.delta;
      end += d.delta;
    } else if (d.mode === "resizeR") end = Math.max(start, end + d.delta);
    else start = Math.min(end, start + d.delta);
    const cell = d.mode === "move" ? d.dropCell : null;
    const placement: Placement = {
      laneId: cell?.laneId || d.ownLaneId,
      blockId: cell ? cell.blockId : d.ownBlockId,
      startDate: addDays(roadmap.startDate, start),
      endDate: addDays(roadmap.startDate, end),
    };
    const unchanged =
      placement.laneId === d.ownLaneId && placement.blockId === d.ownBlockId && start === o.start && end === o.end;
    if (!unchanged) onMoveItem(d.id, placement);
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
    onMoveItem(item.id, {
      laneId: item.laneId,
      blockId: item.blockId,
      startDate: addDays(roadmap.startDate, item.start + d),
      endDate: addDays(roadmap.startDate, item.end + d),
    });
  };

  // ---------- Griff-Drag: Block im Baum umhängen ----------
  const beginTreeDrag = (e: React.PointerEvent<HTMLDivElement>, block: TreeBlock) => {
    if (e.button !== 0 || !isModerator) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx: TreeDragCtx = { blockId: block.id, targetId: null, pos: null };
    treeDragRef.current = ctx;
    setTreeDrag({ ...ctx });
  };

  const moveTreeDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const t = treeDragRef.current;
    if (!t) return;
    const node = tree.byId.get(t.blockId);
    const under = document.elementFromPoint(e.clientX, e.clientY);
    let targetId: string | null = null;
    let pos: TreeDragCtx["pos"] = null;
    const row = under?.closest<HTMLElement>(".rm-row[data-blockid]");
    if (row && node) {
      const target = tree.byId.get(row.dataset.blockid ?? "");
      if (target && canMoveBlock(node, target)) {
        const q = row.getBoundingClientRect();
        const rel = (e.clientY - q.top) / q.height;
        targetId = target.id;
        pos = rel < 0.28 ? "before" : rel > 0.72 ? "after" : "into";
      }
    } else if (under?.closest(".rm-msrow") && node?.parent) {
      pos = "root";
    }
    if (targetId !== t.targetId || pos !== t.pos) {
      t.targetId = targetId;
      t.pos = pos;
      setTreeDrag({ ...t });
    }
  };

  const endTreeDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const t = treeDragRef.current;
    if (!t) return;
    treeDragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* Pointer schon freigegeben */
    }
    setTreeDrag(null);
    if (t.pos === "root") onMoveBlock(t.blockId, null, "into");
    else if (t.targetId && t.pos) onMoveBlock(t.blockId, t.targetId, t.pos);
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
    onDropIssue(issue, laneId, blockId, addDays(roadmap.startDate, startIdx), addDays(roadmap.startDate, startIdx + DEFAULT_SPAN_DAYS));
  };

  // ---------- Rendering ----------
  const guides = (depth: number) =>
    Array.from({ length: depth }, (_, i) => <div key={i} className="rm-guide" style={{ left: IND(i) + 23 }} />);
  const bands = (block: TreeBlock) =>
    block.bands.map((h, i) => <div key={i} className="rm-band" style={{ left: i * 4, background: `hsl(${h} 48% 50%)` }} />);
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

  const renderLaneRow = (r: RowLane) => {
    const depth = r.block.depth + 1;
    const hue = r.block.effectiveHue;
    const parallel = r.tracks.length > 1;
    const h = r.tracks.length * TRACK_H + 8;
    const sp = r.tracks.flat().reduce((s, t) => s + t.storyPoints, 0);
    const blockKey = r.inbox ? "" : r.block.id;
    const isDrop = dropCell && dropCell.laneId === r.laneId && (dropCell.blockId ?? "") === blockKey;
    return (
      <div key={`lane:${r.block.id}:${r.laneId}`} className="rm-row lane" style={{ "--rh": hue } as React.CSSProperties}>
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
        <div
          className={`rm-cr grid ${isDrop ? "droptarget" : ""}`}
          style={{ width: W, height: h }}
          data-lane-cell
          data-lane={r.laneId}
          data-block={blockKey}
        >
          {r.tracks.map((track, ti) =>
            track.map((t) => {
              const view = itemById.get(t.id);
              if (!view) return null;
              const st = statusOf(t.statusCategory);
              return (
                <div
                  key={t.id}
                  className={`rm-bar ticket ${st} ${selectedItemId === t.id ? "sel" : ""} ${draggingId === t.id ? "dragging" : ""} ${isModerator ? "" : "ro"}`}
                  style={{ "--h": hue, left: px(t.start), width: Math.max(px(t.end - t.start + 1), 26), top: 4 + ti * TRACK_H } as React.CSSProperties}
                  data-item={t.id}
                  tabIndex={0}
                  title={`${view.jiraKey ? `${view.jiraKey} · ` : ""}${view.title}\n${formatDay(addDays(roadmap.startDate, t.start))} – ${formatDay(addDays(roadmap.startDate, t.end))} · ${t.storyPoints} SP`}
                  onPointerDown={(e) => beginDrag(e, { kind: "ticket", item: t })}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
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
              );
            }),
          )}
        </div>
      </div>
    );
  };

  const boardClass = `rm-board ${treeDrag ? "treedrag" : ""}`;

  return (
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
          if (r.type === "miles") {
            const dropRoot = treeDrag?.pos === "root";
            return (
              <div key="miles" className={`rm-row rm-msrow ${dropRoot ? "dropinto" : ""}`}>
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

          if (r.type === "lane") return renderLaneRow(r);

          const n = r.block;
          const all = leaves(n);
          const sp = span(all);
          const { done, total: cnt } = blockProgress(n);
          const subCount = n.children.length;
          const rowH = r.open ? 24 : 40;
          const ticketDrop = dropCell && dropCell.laneId === "" && (dropCell.blockId ?? INBOX_ID) === n.id;
          const dropClass =
            treeDrag && treeDrag.targetId === n.id && treeDrag.pos && treeDrag.pos !== "root" ? `drop${treeDrag.pos}` : ticketDrop ? "dropinto" : "";
          const srcClass = treeDrag?.blockId === n.id ? "srcdrag" : "";
          const activeClass = !r.inbox && activeBlockId === n.id ? "active" : "";
          return (
            <div
              key={`block:${n.id}`}
              className={`rm-row block lvl${Math.min(n.depth, 4)} ${r.groupFirst ? "grpfirst" : ""} ${dropClass} ${srcClass} ${activeClass}`}
              data-blockid={r.inbox ? undefined : n.id}
              style={{ "--rh": n.effectiveHue } as React.CSSProperties}
            >
              <div
                className="rm-cl"
                style={{ height: rowH }}
                onClick={() => {
                  onToggle(n.id);
                  onFocusBlock(r.inbox ? null : n.id);
                }}
              >
                <div className="rm-tw" style={{ paddingLeft: IND(n.depth) }}>
                  {guides(n.depth)}
                  {isModerator && !r.inbox ? (
                    <div
                      className="rm-grip"
                      title="Ziehen, um den Block umzuhängen"
                      aria-hidden="true"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => beginTreeDrag(e, n)}
                      onPointerMove={moveTreeDrag}
                      onPointerUp={endTreeDrag}
                      onPointerCancel={endTreeDrag}
                    >
                      {gripIcon}
                    </div>
                  ) : (
                    <div className="rm-grip gripspace" />
                  )}
                  <button
                    type="button"
                    className="rm-chev"
                    aria-expanded={r.open}
                    aria-label={`${r.open ? "Einklappen" : "Ausklappen"}: ${n.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggle(n.id);
                    }}
                  >
                    {chevron}
                  </button>
                  <div className="rm-nm">{n.name}</div>
                  <div className="rm-meta">
                    {isModerator && !r.inbox && (
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
                {sp && r.open && (
                  <div
                    className={`rm-bar summary ${draggingId === n.id ? "dragging" : ""} ${isModerator ? "" : "ro"}`}
                    style={{ "--h": n.effectiveHue, left: px(sp.start), width: Math.max(px(sp.end - sp.start + 1), 12), top: 8 } as React.CSSProperties}
                    title={`${n.name} · ${formatDayShort(addDays(roadmap.startDate, sp.start))}–${formatDay(addDays(roadmap.startDate, sp.end))}`}
                    onPointerDown={(e) => beginDrag(e, { kind: "block", block: n })}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                  />
                )}
                {sp && !r.open && (
                  <div
                    className={`rm-bar blockbar ${draggingId === n.id ? "dragging" : ""} ${isModerator ? "" : "ro"}`}
                    style={{ "--h": n.effectiveHue, left: px(sp.start), width: Math.max(px(sp.end - sp.start + 1), 12), top: 9 } as React.CSSProperties}
                    title={`${n.name} · ${formatDay(addDays(roadmap.startDate, sp.start))} – ${formatDay(addDays(roadmap.startDate, sp.end))}`}
                    onPointerDown={(e) => beginDrag(e, { kind: "block", block: n })}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                  >
                    <div className="rm-prog" style={{ width: `${cnt > 0 ? ((done / cnt) * 100).toFixed(1) : 0}%` }} />
                    <span className="lbl">{n.name}</span>
                    <span className="rm-pct">{done}/{cnt}</span>
                    {all.map((t) => (
                      <div key={t.id} className="rm-segtick" style={{ left: px(t.end + 1 - sp.start) }} />
                    ))}
                  </div>
                )}
                {!sp && !r.open && (
                  <span
                    className="rm-nm"
                    style={{ position: "absolute", left: 10, top: 12, color: "var(--ink-3)", fontWeight: 400, fontSize: 11, marginLeft: 0 }}
                  >
                    {r.inbox ? "" : "noch keine Tickets — per Drag hierher oder über „+ Hinzufügen“"}
                  </span>
                )}
              </div>
            </div>
          );
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
  );
}

export { INBOX_ID };
