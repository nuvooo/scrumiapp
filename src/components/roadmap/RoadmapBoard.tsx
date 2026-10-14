"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import { ZOOM_DAY_WIDTH, dayDiff, dayFromNumber, dayNumber, formatDay, type Zoom } from "@/lib/view/roadmapDays";
import {
  INBOX_ID, blockProgress, blockSpan, canMoveBlock, hasContent, inboxBlock, isAncestor, leaves, statusOf, typeAt,
  type RoadmapTree, type TreeBlock, type TreeItem,
} from "@/lib/view/roadmapTree";
import {
  DEFAULT_SPRINT_ANCHOR, H, NARROW_W, NEW_BLOCK_DAYS, TINY_W,
  computeView, contentHeight, dependencyArrows, flattenBoxes, gridOffsetDays, hasHit, isOverdue, layoutCanvas,
  matchesQuery, matchesSelf, monthCells, presentScale, weekCells,
  type BlockBox, type Box, type LayoutOptions, type TicketBox, type ViewWindow,
} from "@/lib/view/roadmapLayout";
import { deltaDays, issueDurationDays, shiftedSpan, type DragMode } from "@/lib/view/roadmapDrag";
import { laneHue } from "./itemColors";
import { DRAG_MIME, type SidePanelIssue } from "./RoadmapSidePanel";
import type { MilestoneView, Placement, RoadmapItemView, RoadmapView } from "./types";

/** Höhe von Zeitleiste (26 + 22) und Meilensteinleiste (36) über der Zeichenfläche. */
const THEAD_H = 48;
const MSTRIP_H = 36;

type Node = TreeBlock | TreeItem;
const isBlock = (n: Node): n is TreeBlock => "children" in n;

export interface RoadmapBoardProps {
  roadmap: RoadmapView;
  tree: RoadmapTree;
  items: RoadmapItemView[];
  zoom: Zoom;
  present: boolean;
  showDeps: boolean;
  /** Aufgeklappte Block-IDs */
  open: Set<string>;
  query: string;
  /** Ausgewähltes Ticket oder Block (Umrandung) */
  selectedId: string | null;
  /** Jede Änderung scrollt zum heutigen Tag */
  todayRequest: number;
  isModerator: boolean;
  /** "YYYY-MM-DD" */
  today: string;
  onToggle: (blockId: string) => void;
  onSelectBlock: (blockId: string) => void;
  onSelectItem: (itemId: string) => void;
  onMoveItem: (itemId: string, placement: Placement) => void;
  onShiftBlock: (blockId: string, deltaDays: number) => void;
  /** Block in einen anderen Block umhängen (ans Ende seiner Kinder) */
  onMoveBlock: (blockId: string, targetId: string) => void;
  /** Geplante Spanne eines leeren Blocks ändern */
  onResizeBlock: (blockId: string, startDate: string, endDate: string) => void;
  onDropIssue: (issue: SidePanelIssue, blockId: string | null, startDate: string, endDate: string) => void;
  onEditMilestone: (milestone: MilestoneView) => void;
}

/** Alles, was die rekursiven Box-Komponenten brauchen. */
interface Ctx {
  itemById: Map<string, RoadmapItemView>;
  laneIndex: Map<string, number>;
  laneName: Map<string, string>;
  present: boolean;
  isModerator: boolean;
  query: string;
  selectedId: string | null;
  todayNum: number;
  onToggle: (blockId: string) => void;
  onHeadDown: (e: RPointerEvent<HTMLDivElement>, node: Node) => void;
  onHandleDown: (e: RPointerEvent<HTMLDivElement>, node: Node, side: "l" | "r") => void;
  onTicketKey: (e: React.KeyboardEvent<HTMLDivElement>, item: TreeItem) => void;
}

const chevSvg = (
  <svg width="8" height="8" viewBox="0 0 9 9" aria-hidden="true">
    <path d="M2.5 1 L6.5 4.5 L2.5 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function RoadmapBoard({
  roadmap, tree, items, zoom, present, showDeps, open, query, selectedId, todayRequest, isModerator, today,
  onToggle, onSelectBlock, onSelectItem, onMoveItem, onShiftBlock, onMoveBlock, onResizeBlock, onDropIssue, onEditMilestone,
}: RoadmapBoardProps) {
  const dw = ZOOM_DAY_WIDTH[zoom];
  const todayNum = dayNumber(today);
  const anchor = roadmap.sprintAnchor ? dayNumber(roadmap.sprintAnchor) : DEFAULT_SPRINT_ANCHOR;

  const boardRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const [vh, setVh] = useState(900);
  const [stageH, setStageH] = useState(0);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const laneIndex = useMemo(() => new Map(roadmap.lanes.map((l, i) => [l.id, i])), [roadmap.lanes]);
  const laneName = useMemo(() => new Map(roadmap.lanes.map((l) => [l.id, l.name])), [roadmap.lanes]);

  // Alle Knoten (Blöcke, Eingangskorb, Tickets) nach ID — für Drop-Ziele unter dem Zeiger.
  const nodeById = useMemo(() => {
    const m = new Map<string, Node>();
    const walk = (b: TreeBlock) => {
      m.set(b.id, b);
      b.items.forEach((t) => m.set(t.id, t));
      b.children.forEach(walk);
    };
    tree.roots.forEach(walk);
    if (tree.orphans.length) m.set(INBOX_ID, inboxBlock(tree.orphans));
    tree.orphans.forEach((t) => m.set(t.id, t));
    return m;
  }, [tree]);

  // ---------- Zeitfenster und Layout ----------
  const fallback = useMemo(() => ({ start: todayNum, end: todayNum + NEW_BLOCK_DAYS - 1 }), [todayNum]);
  const view: ViewWindow = useMemo(() => {
    const spans: { start: number; end: number }[] = [];
    const walk = (b: TreeBlock) => {
      if (!hasContent(b)) spans.push(b.span ?? fallback);
      b.items.forEach((t) => spans.push({ start: t.start, end: t.end }));
      b.children.forEach(walk);
    };
    tree.roots.forEach(walk);
    tree.orphans.forEach((t) => spans.push({ start: t.start, end: t.end }));
    return computeView(spans, todayNum, roadmap.milestones.map((m) => dayNumber(m.date)));
  }, [tree, todayNum, fallback, roadmap.milestones]);

  const isOpen = useMemo(
    () => (b: TreeBlock) => hasHit(b, query) || (present ? b.depth <= 1 : open.has(b.id)),
    [query, present, open],
  );
  const baseOpts: LayoutOptions = useMemo(
    () => ({ view, dw, sc: 1, present, isOpen, fallback }),
    [view, dw, present, isOpen, fallback],
  );
  // Präsentation: Höhe strecken, bis die Roadmap das Fenster füllt
  const sc = useMemo(() => {
    if (!present) return 1;
    const avail = vh - 92 - THEAD_H - MSTRIP_H - 2 * H.top - 24;
    return presentScale(contentHeight(tree, baseOpts), avail);
  }, [present, vh, tree, baseOpts]);
  const layout = useMemo(() => layoutCanvas(tree, { ...baseOpts, sc }), [tree, baseOpts, sc]);
  const abs = useMemo(() => flattenBoxes(layout.boxes), [layout]);
  const arrows = useMemo(
    () => (showDeps && !present ? dependencyArrows(items, abs) : []),
    [showDeps, present, items, abs],
  );
  const months = useMemo(() => monthCells(view), [view]);
  const weeks = useMemo(() => weekCells(view, zoom, anchor), [view, zoom, anchor]);

  const X = (day: number) => (day - view.a) * dw;
  const W = (view.b - view.a) * dw;
  const canvasTop = THEAD_H + 1 + MSTRIP_H;

  // ---------- Fenstergröße, Stage-Höhe ----------
  useEffect(() => {
    const update = () => setVh(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (el) setStageH(el.scrollHeight);
  }, [layout]);

  // ---------- Scrollen ----------
  const prevView = useRef<{ a: number; dw: number } | null>(null);
  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const prev = prevView.current;
    if (!prev) {
      // Beim Öffnen: Anfang der Roadmap und heute möglichst beide im Bild
      el.scrollLeft = Math.max(0, Math.min(X(todayNum) - 160, layout.minL - 28));
    } else if (prev.a !== view.a && prev.dw === dw) {
      // Wächst das Fenster nach links, rückt der Inhalt nach rechts — Scrollposition mitführen
      el.scrollLeft += (prev.a - view.a) * dw;
    }
    prevView.current = { a: view.a, dw };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.a, dw]);
  const scrollToToday = (smooth: boolean) => {
    const el = boardRef.current;
    if (!el) return;
    el.scrollTo({ left: Math.max(0, X(todayNum) - 160), behavior: smooth ? "smooth" : "auto" });
  };
  useEffect(() => {
    if (todayRequest) scrollToToday(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayRequest]);
  const zoomMounted = useRef(false);
  useEffect(() => {
    if (zoomMounted.current) scrollToToday(false);
    zoomMounted.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, present]);

  // ---------- Live-Anzeige beim Ziehen ----------
  const showTip = (text: string, left: number, top: number) => {
    const t = tipRef.current;
    if (!t) return;
    t.hidden = false;
    t.textContent = text;
    t.style.left = `${left}px`;
    t.style.top = `${top}px`;
  };
  const hideTip = () => {
    if (tipRef.current) tipRef.current.hidden = true;
  };
  const stageTop = (el: HTMLElement) => {
    const s = stageRef.current?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return s ? { left: r.left - s.left, top: r.top - s.top } : { left: 0, top: 0 };
  };

  // ---------- Drag: verschieben + umhängen ----------
  const onHeadDown = (e: RPointerEvent<HTMLDivElement>, n: Node) => {
    // In der Präsentation bewegt Ziehen nur die Karte (Pan auf dem Board).
    if (present || e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest(".chev") || target.closest(".hdl")) return;
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget;
    const box = handle.closest<HTMLElement>(".box");
    if (!box) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const left0 = parseFloat(box.style.left);
    const base = isBlock(n) ? blockSpan(n, fallback) : { start: n.start, end: n.end };
    let moved = false;
    let delta = 0;
    let tgt: TreeBlock | null = null;
    let tgtEl: HTMLElement | null = null;
    handle.setPointerCapture(e.pointerId);

    const clear = () => {
      tgtEl?.classList.remove("drop");
      tgtEl = null;
    };
    const ownParentId = isBlock(n) ? (n.parent?.id ?? null) : (n.blockId ?? INBOX_ID);
    const move = (ev: PointerEvent) => {
      if (!isModerator) return; // Betrachter: nur auswählen
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      if (!moved) {
        moved = true;
        box.classList.add("dragging");
      }
      delta = deltaDays(dx, dw, ev.shiftKey);
      box.style.left = `${left0 + delta * dw}px`;
      box.style.transform = `translateY(${dy}px)`;
      // Live-Anzeige: neuer Zeitraum
      const pos = stageTop(box);
      showTip(
        `${formatDay(dayFromNumber(base.start + delta))} – ${formatDay(dayFromNumber(base.end + delta))}${delta ? ` · ${delta > 0 ? "+" : ""}${delta} Tage` : ""}`,
        pos.left,
        pos.top - 26,
      );
      // Ziel unter dem Zeiger: Block oder Elternblock eines Tickets
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      let cand = under?.closest<HTMLElement>(".box") ?? null;
      let node = cand ? nodeById.get(cand.dataset.id ?? "") ?? null : null;
      if (cand && node && !isBlock(node)) {
        cand = cand.parentElement?.closest<HTMLElement>(".box") ?? null;
        node = cand ? nodeById.get(cand.dataset.id ?? "") ?? null : null;
      }
      let ok = !!node && isBlock(node) && node.id !== ownParentId;
      if (ok && node && isBlock(node)) {
        if (isBlock(n)) ok = node.id !== INBOX_ID && canMoveBlock(n, node);
        else ok = true;
        if (ok && isBlock(n) && (node === n || isAncestor(n, node))) ok = false;
      }
      if (!ok || cand !== tgtEl) clear();
      if (ok && cand && node && isBlock(node)) {
        tgtEl = cand;
        tgt = node;
        cand.classList.add("drop");
      } else tgt = null;
    };
    const up = () => {
      try {
        handle.releasePointerCapture(e.pointerId);
      } catch {
        /* bereits freigegeben */
      }
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      box.classList.remove("dragging");
      box.style.transform = "";
      hideTip();
      clear();
      if (!moved) {
        if (isBlock(n)) onSelectBlock(n.id);
        else onSelectItem(n.id);
        return;
      }
      box.style.left = `${left0}px`;
      if (isBlock(n)) {
        if (delta) onShiftBlock(n.id, delta);
        if (tgt) onMoveBlock(n.id, tgt.id);
      } else {
        const next = shiftedSpan({ start: n.start, end: n.end }, "move", delta);
        const blockId = tgt ? (tgt.id === INBOX_ID ? null : tgt.id) : n.blockId;
        if (delta || tgt) {
          onMoveItem(n.id, { laneId: n.laneId, blockId, startDate: dayFromNumber(next.start), endDate: dayFromNumber(next.end) });
        }
      }
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  };

  // ---------- Breite ändern (Tickets, leere Blöcke) ----------
  const onHandleDown = (e: RPointerEvent<HTMLDivElement>, n: Node, side: "l" | "r") => {
    if (e.button !== 0 || !isModerator) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    const box = el.closest<HTMLElement>(".box");
    if (!box) return;
    const startX = e.clientX;
    const left0 = parseFloat(box.style.left);
    const w0 = parseFloat(box.style.width);
    const base = isBlock(n) ? (n.span ?? fallback) : { start: n.start, end: n.end };
    const mode: DragMode = side === "r" ? "resizeR" : "resizeL";
    let d = 0;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      d = deltaDays(ev.clientX - startX, dw, ev.shiftKey);
      const next = shiftedSpan(base, mode, d);
      box.style.left = `${left0 + (next.start - base.start) * dw}px`;
      box.style.width = `${Math.max(dw, (next.end - next.start + 1) * dw)}px`;
      const pos = stageTop(box);
      showTip(`${formatDay(dayFromNumber(next.start))} – ${formatDay(dayFromNumber(next.end))} · ${next.end - next.start + 1} Tage`, pos.left, pos.top - 26);
    };
    const up = () => {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* bereits freigegeben */
      }
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      hideTip();
      box.style.left = `${left0}px`;
      box.style.width = `${w0}px`;
      if (!d) return;
      const next = shiftedSpan(base, mode, d);
      if (isBlock(n)) onResizeBlock(n.id, dayFromNumber(next.start), dayFromNumber(next.end));
      else onMoveItem(n.id, { laneId: n.laneId, blockId: n.blockId, startDate: dayFromNumber(next.start), endDate: dayFromNumber(next.end) });
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };

  // ---------- Tastatur auf Tickets ----------
  const onTicketKey = (e: React.KeyboardEvent<HTMLDivElement>, item: TreeItem) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSelectItem(item.id);
      return;
    }
    if (!isModerator || present || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    e.preventDefault();
    const d = (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 7 : 1);
    onMoveItem(item.id, {
      laneId: item.laneId, blockId: item.blockId,
      startDate: dayFromNumber(item.start + d), endDate: dayFromNumber(item.end + d),
    });
  };

  // ---------- Karte bewegen: klicken, halten, ziehen ----------
  const spaceDown = useRef(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName ?? "";
      if (e.code === "Space" && !/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(tag)) {
        if (!spaceDown.current) {
          spaceDown.current = true;
          boardRef.current?.classList.add("pannable");
        }
        e.preventDefault();
      }
    };
    const release = () => {
      spaceDown.current = false;
      boardRef.current?.classList.remove("pannable");
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") release();
    };
    document.addEventListener("keydown", down);
    document.addEventListener("keyup", up);
    window.addEventListener("blur", release);
    return () => {
      document.removeEventListener("keydown", down);
      document.removeEventListener("keyup", up);
      window.removeEventListener("blur", release);
    };
  }, []);

  const onBoardDown = (e: RPointerEvent<HTMLDivElement>) => {
    const board = boardRef.current;
    if (!board || e.pointerType !== "mouse") return; // Touch scrollt nativ
    const middle = e.button === 1;
    if (!middle && e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (!middle && !spaceDown.current && !present && target.closest(".bh,.hdl,.chev,button,.box.ticket")) return;
    if (present && target.closest("button")) return;
    e.preventDefault();
    const x0 = e.clientX;
    const y0 = e.clientY;
    const sl = board.scrollLeft;
    const wy = window.scrollY;
    board.classList.add("panning");
    board.setPointerCapture(e.pointerId);
    // horizontal: die Zeitachse; vertikal: die Seite (das Board selbst scrollt nicht senkrecht)
    const move = (ev: PointerEvent) => {
      board.scrollLeft = sl - (ev.clientX - x0);
      window.scrollTo(window.scrollX, wy - (ev.clientY - y0));
    };
    const up = () => {
      try {
        board.releasePointerCapture(e.pointerId);
      } catch {
        /* bereits freigegeben */
      }
      board.removeEventListener("pointermove", move);
      board.removeEventListener("pointerup", up);
      board.removeEventListener("pointercancel", up);
      board.classList.remove("panning");
    };
    board.addEventListener("pointermove", move);
    board.addEventListener("pointerup", up);
    board.addEventListener("pointercancel", up);
  };

  // ---------- Drop aus der Jira-Seitenleiste (HTML5-DnD) ----------
  const onDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DRAG_MIME)) e.preventDefault();
  };
  const onDrop = (e: React.DragEvent) => {
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    e.preventDefault();
    const issue = JSON.parse(raw) as SidePanelIssue;
    const under = document.elementFromPoint(e.clientX, e.clientY);
    let cand = under?.closest<HTMLElement>(".box") ?? null;
    let node = cand ? nodeById.get(cand.dataset.id ?? "") ?? null : null;
    if (cand && node && !isBlock(node)) {
      cand = cand.parentElement?.closest<HTMLElement>(".box") ?? null;
      node = cand ? nodeById.get(cand.dataset.id ?? "") ?? null : null;
    }
    const blockId = node && isBlock(node) && node.id !== INBOX_ID ? node.id : null;
    const rect = canvasRef.current?.getBoundingClientRect();
    const x = rect ? e.clientX - rect.left : 0;
    const start = view.a + Math.floor(x / dw);
    const days = issueDurationDays(issue, dayDiff);
    onDropIssue(issue, blockId, dayFromNumber(start), dayFromNumber(start + days - 1));
  };

  const ctx: Ctx = {
    itemById, laneIndex, laneName, present, isModerator, query, selectedId, todayNum,
    onToggle, onHeadDown, onHandleDown, onTicketKey,
  };
  const tx = X(todayNum) + dw / 2;
  const overlayH = Math.max(stageH, canvasTop + layout.height);

  return (
    <div
      ref={boardRef}
      className="rm-board"
      onPointerDown={onBoardDown}
      onAuxClick={(e) => {
        if (e.button === 1) e.preventDefault();
      }}
      style={{ "--dw": dw, "--gridoff": `${-gridOffsetDays(view.a, anchor) * dw}px` } as CSSProperties}
    >
      <div ref={stageRef} className="rm-stage" style={{ width: W }}>
        <div className="rm-thead">
          <div className="rm-hmonths">
            {months.map((m) => (
              <div key={m.start} className={`rm-hmonth ${m.q ? "q" : ""}`} style={{ left: X(m.start), width: m.days * dw }}>
                {m.label}
              </div>
            ))}
          </div>
          <div className="rm-hweeks">
            {weeks.map((w) => (
              <div key={w.start} className="rm-hweek" style={{ left: X(w.start), width: w.days * dw }}>
                {w.label}
              </div>
            ))}
          </div>
        </div>
        <div className="rm-mstrip">
          {roadmap.milestones.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`rm-ms ${isModerator && !present ? "editable" : ""}`}
              style={{ left: X(dayNumber(m.date)), "--mc": m.color } as CSSProperties}
              title={`${m.title} · ${formatDay(m.date)}`}
              onClick={isModerator && !present ? () => onEditMilestone(m) : undefined}
            >
              <i />
              <span>{m.title}</span>
            </button>
          ))}
        </div>
        <div ref={canvasRef} className="rm-canvas" style={{ minHeight: layout.height }} onDragOver={onDragOver} onDrop={onDrop}>
          {layout.boxes.map((b) => (
            <BlockBoxView key={b.block.id} box={b} parentL={0} ctx={ctx} />
          ))}
        </div>
        <div ref={tipRef} className="rm-dragtip" hidden />
        <svg className="rm-ovl" width={W} height={overlayH}>
          {roadmap.milestones.map((m) => {
            const x = X(dayNumber(m.date));
            return <line key={m.id} className="rm-msline" x1={x} y1={56} x2={x} y2={overlayH} style={{ stroke: m.color }} />;
          })}
          <line className="rm-todayline" x1={tx} y1={48} x2={tx} y2={overlayH} />
          <text className="rm-todaytag" x={tx + 4} y={62}>heute</text>
          {arrows.map((a) => (
            <g key={a.key} transform={`translate(0 ${canvasTop})`}>
              <path className="rm-dep" d={a.line} />
              <path className="rm-dephead" d={a.head} />
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

// ---------- Boxen ----------

function queryClass(n: Node, q: string): string {
  if (!q.trim()) return "";
  if (!matchesQuery(n, q)) return "dim";
  return matchesSelf(n, q) ? "hit" : "";
}

function widthClass(w: number): string {
  return `${w < NARROW_W ? "narrow" : ""} ${w < TINY_W ? "tiny" : ""}`;
}

function BlockBoxView({ box, parentL, ctx }: { box: BlockBox; parentL: number; ctx: Ctx }) {
  const n = box.block;
  const all = leaves(n);
  const { done } = blockProgress(n);
  const w = box.R - box.L;
  const inbox = n.id === INBOX_ID;
  const cls = [
    "box container", `lvl${Math.min(n.depth, 2)}`, box.open ? "open" : "collapsed",
    ctx.selectedId === n.id ? "sel" : "", queryClass(n, ctx.query), widthClass(w), ctx.isModerator ? "" : "ro",
  ].join(" ");
  const title = `${inbox ? "Eingangskorb" : `${typeAt(n.depth).one}: ${n.name}`}\n${formatDay(dayFromNumber(box.span.start))} – ${formatDay(dayFromNumber(box.span.end))}${
    all.length ? `\n${done} von ${all.length} Tickets erledigt` : "\nnoch leer"
  }`;
  const resizable = ctx.isModerator && !ctx.present && !inbox && !hasContent(n);
  return (
    <div
      className={cls}
      style={{ "--h": n.effectiveHue, left: box.L - parentL, width: w, height: box.h, top: box.top } as CSSProperties}
      data-id={n.id}
      title={title}
    >
      {!box.open && all.length > 0 && <div className="prog" style={{ width: `${((done / all.length) * 100).toFixed(1)}%` }} />}
      <div className="bh" style={{ height: box.head }} onPointerDown={(e) => ctx.onHeadDown(e, n)}>
        <button
          type="button"
          className="chev"
          aria-expanded={box.open}
          aria-label={`${box.open ? "Einklappen" : "Aufklappen"}: ${n.name}`}
          onClick={(e) => {
            e.stopPropagation();
            ctx.onToggle(n.id);
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {chevSvg}
        </button>
        <span className="bnwrap">
          <span className="bn">{n.name}</span>
        </span>
        <span className="bc">{all.length ? `${done}/${all.length}` : "leer"}</span>
      </div>
      {resizable && (
        <>
          <div className="hdl l" onPointerDown={(e) => ctx.onHandleDown(e, n, "l")} />
          <div className="hdl r" onPointerDown={(e) => ctx.onHandleDown(e, n, "r")} />
        </>
      )}
      {box.empty && (
        <div className="empty" style={{ top: box.head + 7 }}>
          {inbox ? "leer" : "leer – hier Bereich oder Ticket einfügen"}
        </div>
      )}
      {box.children.map((c) =>
        c.kind === "block" ? (
          <BlockBoxView key={c.block.id} box={c} parentL={box.L} ctx={ctx} />
        ) : (
          <TicketBoxView key={c.item.id} box={c} parentL={box.L} hue={n.effectiveHue} ctx={ctx} />
        ),
      )}
    </div>
  );
}

function TicketBoxView({ box, parentL, hue, ctx }: { box: TicketBox; parentL: number; hue: number; ctx: Ctx }) {
  const t = box.item;
  const view = ctx.itemById.get(t.id);
  if (!view) return null;
  const st = statusOf(t.statusCategory);
  const over = isOverdue(t, ctx.todayNum);
  const w = box.R - box.L;
  const li = ctx.laneIndex.get(t.laneId) ?? 0;
  const lname = ctx.laneName.get(t.laneId) ?? "";
  const cls = [
    "box ticket", st, over ? "over" : "", ctx.selectedId === t.id ? "sel" : "", queryClass(t, ctx.query), widthClass(w),
    ctx.isModerator ? "" : "ro",
  ].join(" ");
  const title = `${view.jiraKey ? `${view.jiraKey} · ` : ""}${view.title}\n${formatDay(view.startDate)} – ${formatDay(view.endDate)} · ${t.storyPoints} SP · ${lname}${
    over ? "\n⚠ Endtermin überschritten" : ""
  }`;
  return (
    <div
      className={cls}
      style={{ "--h": hue, left: box.L - parentL, width: w, height: box.h, top: box.top } as CSSProperties}
      data-id={t.id}
      title={title}
      role="button"
      tabIndex={0}
      aria-label={`${view.jiraKey ? `${view.jiraKey} ` : ""}${view.title}`}
      onKeyDown={(e) => ctx.onTicketKey(e, t)}
    >
      <div className="bh" onPointerDown={(e) => ctx.onHeadDown(e, t)}>
        <span className={`st ${st}`} />
        {view.jiraKey && !ctx.present && <span className="bk">{view.jiraKey}</span>}
        <span className="bn">{view.title}</span>
        {!ctx.present && <span className="bsp">{t.storyPoints} SP</span>}
        <span className="lane" style={{ background: `hsl(${laneHue(li)} 54% 42%)` }}>
          {lname.slice(0, 2).toUpperCase()}
        </span>
      </div>
      {ctx.isModerator && !ctx.present && (
        <>
          <div className="hdl l" onPointerDown={(e) => ctx.onHandleDown(e, t, "l")} />
          <div className="hdl r" onPointerDown={(e) => ctx.onHandleDown(e, t, "r")} />
        </>
      )}
    </div>
  );
}

export { INBOX_ID };
export type { Box };
