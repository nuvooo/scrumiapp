/**
 * Layout der Roadmap-Boxen nach der Vorlage „Roadmap Kundencockpit“: Zeitfenster,
 * das mit dem Inhalt wächst, rekursive Boxhöhen (Kopfzeile + überschneidungsfrei
 * gepackte Zeilen der Kinder), Zeitleisten-Zellen, Suche und Zielort beim Anlegen.
 * Reine Rechenlogik ohne DOM.
 */

import { isoWeek, type Zoom } from "./roadmapDays";
import {
  blockSpan, inboxBlock, statusOf,
  type DaySpan, type RoadmapTree, type TreeBlock, type TreeItem,
} from "./roadmapTree";

/** Luft vor dem frühesten und hinter dem spätesten Objekt (Tage). */
export const PAD_BEFORE = 100;
export const PAD_AFTER = 150;
/** Maße in Pixeln (bei Skalierung 1). */
export const H = { pad: 11, gap: 9, ticket: 30, top: 18, vgap: 16, empty: 34 } as const;
/** Ein aufgeklappter Block ragt links und rechts um INSET über seinen Inhalt hinaus. */
export const INSET = 12;
export const MIN_BOX_W = 26;
export const EMPTY_MIN_W = 260;
export const NARROW_W = 170;
export const TINY_W = 72;
/** Länge neuer (leerer) Blöcke: heute bis heute + 27 Tage. */
export const NEW_BLOCK_DAYS = 28;
/** Montag, an dem das Sprintraster hängt, wenn kein aktiver Sprint bekannt ist (2026-08-31). */
export const DEFAULT_SPRINT_ANCHOR = 20696;

export interface ViewWindow {
  /** erster Tag (absolute Tagesnummer) */
  a: number;
  /** letzter Tag, exklusiv */
  b: number;
}

export function headHeight(depth: number, present: boolean, sc: number): number {
  return Math.round(((present ? 8 : 0) + (depth === 0 ? 38 : depth === 1 ? 34 : 30)) * sc);
}

/** Zeitfenster: umschließt heute, alle Spannen und Meilensteine, mit Luft davor und dahinter. */
export function computeView(spans: DaySpan[], today: number, milestoneDays: number[]): ViewWindow {
  let a = today;
  let b = today;
  for (const s of spans) {
    if (s.start < a) a = s.start;
    if (s.end > b) b = s.end;
  }
  for (const d of milestoneDays) {
    if (d < a) a = d;
    if (d > b) b = d;
  }
  return { a: a - PAD_BEFORE, b: b + PAD_AFTER };
}

export interface LayoutOptions {
  view: ViewWindow;
  /** Tagbreite in Pixeln */
  dw: number;
  /** Höhenskalierung (Präsentation) */
  sc: number;
  present: boolean;
  isOpen: (block: TreeBlock) => boolean;
  /** Spanne leerer Blöcke ohne geplante Spanne */
  fallback: DaySpan;
}

export interface TicketBox {
  kind: "ticket";
  item: TreeItem;
  /** Pixel auf der Zeichenfläche (links/rechts), unabhängig vom Elternblock */
  L: number;
  R: number;
  h: number;
  /** Abstand zur Oberkante des Elternblocks (Wurzeln: zur Zeichenfläche) */
  top: number;
}

export interface BlockBox {
  kind: "block";
  block: TreeBlock;
  L: number;
  R: number;
  h: number;
  top: number;
  open: boolean;
  /** aufgeklappt, aber ohne Inhalt */
  empty: boolean;
  head: number;
  span: DaySpan;
  children: Box[];
}

export type Box = TicketBox | BlockBox;

const X = (day: number, o: LayoutOptions) => (day - o.view.a) * o.dw;
const sc = (v: number, o: LayoutOptions) => Math.round(v * o.sc);

export function measureTicket(item: TreeItem, o: LayoutOptions): TicketBox {
  const L = X(item.start, o);
  return { kind: "ticket", item, L, R: Math.max(X(item.end + 1, o), L + MIN_BOX_W), h: sc(H.ticket, o), top: 0 };
}

interface Row {
  items: Box[];
  end: number;
  h: number;
}

/** Kinder in Zeilen packen: was sich (in Pixeln) überschneidet, rutscht eine Zeile tiefer. */
export function packRows(kids: Box[]): Row[] {
  const sorted = [...kids].sort((x, y) => x.L - y.L || x.R - y.R);
  const rows: Row[] = [];
  for (const k of sorted) {
    let r = rows.find((row) => row.end + 4 <= k.L);
    if (!r) {
      r = { items: [], end: -1e9, h: 0 };
      rows.push(r);
    }
    r.items.push(k);
    r.end = Math.max(r.end, k.R);
    r.h = Math.max(r.h, k.h);
  }
  return rows;
}

export function measureBlock(block: TreeBlock, o: LayoutOptions): BlockBox {
  const head = headHeight(block.depth, o.present, o.sc);
  const spanOf = blockSpan(block, o.fallback);
  const Lt = X(spanOf.start, o);
  const Rt = Math.max(X(spanOf.end + 1, o), Lt + MIN_BOX_W);
  const open = o.isOpen(block);
  const base = { kind: "block" as const, block, head, span: spanOf, top: 0 };
  if (!open) return { ...base, L: Lt, R: Rt, h: head, open: false, empty: false, children: [] };
  const kids: Box[] = [
    ...block.children.map((c) => measureBlock(c, o)),
    ...block.items.map((t) => measureTicket(t, o)),
  ];
  if (kids.length === 0) {
    return { ...base, L: Lt, R: Math.max(Rt, Lt + EMPTY_MIN_W), h: head + sc(H.empty, o), open: true, empty: true, children: [] };
  }
  const rows = packRows(kids);
  let y = head + sc(H.pad, o);
  for (const r of rows) {
    for (const k of r.items) k.top = y;
    y += r.h + sc(H.gap, o);
  }
  const L = Math.min(...kids.map((k) => k.L)) - INSET;
  const R = Math.max(...kids.map((k) => k.R)) + INSET;
  const h = head + sc(H.pad, o) + rows.reduce((s, r) => s + r.h, 0) + (rows.length - 1) * sc(H.gap, o) + sc(H.pad, o);
  return { ...base, L, R, h, open: true, empty: false, children: rows.flatMap((r) => r.items) };
}

export interface CanvasLayout {
  boxes: BlockBox[];
  /** Mindesthöhe der Zeichenfläche */
  height: number;
  /** linkeste Kante aller Wurzeln (Startposition beim Öffnen) */
  minL: number;
}

/** Wurzeln untereinander (Eingangskorb zuerst, falls belegt). */
export function layoutCanvas(tree: RoadmapTree, o: LayoutOptions): CanvasLayout {
  const roots: TreeBlock[] = tree.orphans.length > 0 ? [inboxBlock(tree.orphans), ...tree.roots] : tree.roots;
  let y = sc(H.top, o);
  let minL = Infinity;
  const boxes = roots.map((r) => {
    const m = measureBlock(r, o);
    m.top = y;
    y += m.h + sc(H.vgap, o);
    if (m.L < minL) minL = m.L;
    return m;
  });
  return { boxes, height: y + sc(H.top, o), minL: Number.isFinite(minL) ? minL : 0 };
}

/** Gesamthöhe des Inhalts bei Skalierung 1 (Basis für die Streckung im Präsentationsmodus). */
export function contentHeight(tree: RoadmapTree, o: LayoutOptions): number {
  const roots: TreeBlock[] = tree.orphans.length > 0 ? [inboxBlock(tree.orphans), ...tree.roots] : tree.roots;
  const base = { ...o, sc: 1 };
  return roots.reduce<number>((t, r) => t + measureBlock(r, base).h + H.vgap, H.top);
}

/** Streckfaktor, bis die Roadmap das Fenster füllt: zwischen 1 und 1,7. */
export function presentScale(content: number, available: number): number {
  if (content <= 0 || available <= 0) return 1;
  return Math.max(1, Math.min(1.7, available / content));
}

export interface AbsBox {
  L: number;
  R: number;
  top: number;
  h: number;
}

/** Absolute Lage aller Boxen auf der Zeichenfläche (für Pfeile und Treffer). */
export function flattenBoxes(boxes: Box[], parentTop = 0, out = new Map<string, AbsBox>()): Map<string, AbsBox> {
  for (const b of boxes) {
    const top = parentTop + b.top;
    out.set(b.kind === "ticket" ? b.item.id : b.block.id, { L: b.L, R: b.R, top, h: b.h });
    if (b.kind === "block") flattenBoxes(b.children, top, out);
  }
  return out;
}

export interface Arrow {
  key: string;
  line: string;
  head: string;
}

/** Abhängigkeitspfeile: vom rechten Rand des Blockierers zum linken Rand des Blockierten. */
export function dependencyArrows(
  items: { id: string; jiraKey: string | null; blockedBy: string[] }[],
  abs: Map<string, AbsBox>,
): Arrow[] {
  const byKey = new Map<string, string>();
  for (const i of items) if (i.jiraKey) byKey.set(i.jiraKey, i.id);
  const arrows: Arrow[] = [];
  for (const i of items) {
    const b = abs.get(i.id);
    if (!b) continue;
    for (const depKey of i.blockedBy) {
      const depId = byKey.get(depKey);
      const a = depId ? abs.get(depId) : undefined;
      if (!a) continue;
      const x1 = a.R;
      const y1 = a.top + a.h / 2;
      const x2 = b.L;
      const y2 = b.top + b.h / 2;
      arrows.push({
        key: `${depId}->${i.id}`,
        line: `M${x1} ${y1} H${x1 + 7} V${y2} H${x2 - 6}`,
        head: `M${x2 - 6} ${y2 - 3.5} L${x2} ${y2} L${x2 - 6} ${y2 + 3.5} Z`,
      });
    }
  }
  return arrows;
}

/** Endtermin überschritten: nicht erledigt und Ende vor heute. */
export function isOverdue(item: TreeItem, today: number): boolean {
  return statusOf(item.statusCategory) !== "done" && item.end < today;
}

// ---------- Suche ----------

const isBlock = (n: TreeBlock | TreeItem): n is TreeBlock => "children" in n;

/** Trifft die Suche das Objekt selbst (Name bzw. Key + Titel)? */
export function matchesSelf(n: TreeBlock | TreeItem, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return isBlock(n) ? n.name.toLowerCase().includes(needle) : `${n.jiraKey ?? ""} ${n.title}`.toLowerCase().includes(needle);
}

/** Trifft die Suche das Objekt oder etwas darin? */
export function matchesQuery(n: TreeBlock | TreeItem, q: string): boolean {
  if (!q.trim()) return true;
  if (matchesSelf(n, q)) return true;
  return isBlock(n) && (n.children.some((c) => matchesQuery(c, q)) || n.items.some((t) => matchesQuery(t, q)));
}

/** Enthält der Block einen Treffer (dann wird er aufgeklappt)? */
export function hasHit(block: TreeBlock, q: string): boolean {
  if (!q.trim()) return false;
  return block.children.some((c) => matchesQuery(c, q)) || block.items.some((t) => matchesQuery(t, q));
}

// ---------- Anlegen: Zielort aus dem Kontext ----------

export type AddKind = "projekt" | "teilprojekt" | "bereich" | "ticket";

const firstBlock = (n: TreeBlock): TreeBlock | undefined => n.children[0];

/**
 * Wohin ein neues Objekt kommt: Projekt auf die oberste Ebene, Teilprojekt in
 * das Projekt des Kontextblocks, Bereich in den Kontextblock (bzw. dessen
 * erstes Teilprojekt, wenn der Kontext ein Projekt ist), Ticket in den
 * tiefsten passenden Block. Ohne Kontext zählt das erste Projekt.
 */
export function addTarget(kind: AddKind, ctx: TreeBlock | null, roots: TreeBlock[]): TreeBlock | null {
  if (kind === "projekt") return null;
  if (kind === "teilprojekt") {
    if (ctx) {
      let p = ctx;
      while (p.parent) p = p.parent;
      return p;
    }
    return roots[0] ?? null;
  }
  if (kind === "bereich") {
    if (ctx) return ctx.depth >= 1 ? ctx : firstBlock(ctx) ?? ctx;
    const p = roots[0];
    return p ? firstBlock(p) ?? p : null;
  }
  if (ctx) return ctx.depth >= 2 ? ctx : firstBlock(ctx) ?? ctx;
  const p = roots[0];
  const tp = p && firstBlock(p);
  return (tp && firstBlock(tp)) ?? tp ?? p ?? null;
}

// ---------- Zeitleiste ----------

export interface HeadCell {
  /** absolute Tagesnummer */
  start: number;
  days: number;
  label: string;
  /** Quartalsanfang */
  q?: boolean;
}

const MON = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const DAY_MS = 86_400_000;
const dayOf = (d: Date) => Math.round(d.getTime() / DAY_MS);
const dateOf = (day: number) => new Date(day * DAY_MS);

/** Monatszellen im Fenster, am Rand beschnitten; Quartalsanfänge mit „Q3 · “. */
export function monthCells(view: ViewWindow): HeadCell[] {
  const out: HeadCell[] = [];
  const first = dateOf(view.a);
  let d = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1));
  while (dayOf(d) < view.b) {
    const s = Math.max(view.a, dayOf(d));
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    const e = Math.min(view.b, dayOf(next));
    const q = d.getUTCMonth() % 3 === 0;
    out.push({
      start: s,
      days: e - s,
      label: `${q ? `Q${Math.floor(d.getUTCMonth() / 3) + 1} · ` : ""}${MON[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`,
      q,
    });
    d = next;
  }
  return out;
}

/** Wochenzellen (Monat: KW-Nummer, Woche: „KW 39“) bzw. 4-Wochen-Zellen „S1–2“ im Quartalszoom, am Sprintanker ausgerichtet. */
export function weekCells(view: ViewWindow, zoom: Zoom, anchor: number): HeadCell[] {
  const out: HeadCell[] = [];
  const firstMon = view.a + ((((anchor - view.a) % 7) + 7) % 7);
  for (let i = firstMon; i < view.b; i += 7) {
    if (zoom === "q") {
      if ((((i - anchor) % 28) + 28) % 28) continue;
      const s1 = Math.round((i - anchor) / 14) + 1;
      out.push({ start: i, days: 28, label: `S${s1}–${s1 + 1}` });
    } else {
      out.push({ start: i, days: 7, label: `${zoom === "w" ? "KW " : ""}${isoWeek(dateOf(i))}` });
    }
  }
  return out;
}

/** Versatz des Sprint-Rasters (Tage), damit es am Anker hängt und beim Wachsen nicht springt. */
export function gridOffsetDays(viewStart: number, anchor: number): number {
  return (((viewStart - anchor) % 14) + 14) % 14;
}

