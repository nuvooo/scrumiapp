/**
 * Blockbaum der Roadmap: Tiefe, Farbvererbung, Zeitspannen aus Tickets bzw.
 * geplanter Spanne leerer Blöcke. Tag-Indizes sind absolute Tagesnummern
 * (siehe `dayNumber` in roadmapDays), damit das wachsende Zeitfenster keine
 * Umrechnung braucht.
 */

export const DEFAULT_HUE = 212;
/** Pseudo-Block für Tickets ohne Block-Zuordnung. */
export const INBOX_ID = "__inbox";
export const INBOX_HUE = 220;

export type BarStatus = "done" | "wip" | "open";

export interface DaySpan {
  /** Tag-Indizes (inklusive) */
  start: number;
  end: number;
}

export interface BlockInput {
  id: string;
  parentId: string | null;
  name: string;
  hue: number | null;
  position: number;
  /** Geplante Spanne, gilt nur ohne Inhalt */
  span: DaySpan | null;
}

export interface TreeItem {
  id: string;
  blockId: string | null;
  laneId: string;
  start: number;
  end: number;
  statusCategory: string | null;
  storyPoints: number;
  position: number;
  jiraKey: string | null;
  title: string;
}

export interface TreeBlock extends BlockInput {
  depth: number;
  /** Eigener Farbton oder vom nächsten Vorfahren geerbt */
  effectiveHue: number;
  children: TreeBlock[];
  /** Direkt zugeordnete Tickets */
  items: TreeItem[];
  parent: TreeBlock | null;
}

export interface RoadmapTree {
  roots: TreeBlock[];
  byId: Map<string, TreeBlock>;
  /** Tickets ohne Block (Eingangskorb) */
  orphans: TreeItem[];
}

export function statusOf(statusCategory: string | null): BarStatus {
  if (statusCategory === "done") return "done";
  if (statusCategory === "indeterminate") return "wip";
  return "open";
}

const byPosition = <T extends { position: number; id: string }>(a: T, b: T) =>
  a.position - b.position || a.id.localeCompare(b.id);

export function buildTree(blocks: BlockInput[], items: TreeItem[]): RoadmapTree {
  const byId = new Map<string, TreeBlock>();
  for (const b of blocks) {
    byId.set(b.id, { ...b, depth: 0, effectiveHue: DEFAULT_HUE, children: [], items: [], parent: null });
  }
  const roots: TreeBlock[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) {
      node.parent = parent;
      parent.children.push(node);
    } else roots.push(node);
  }
  const orphans: TreeItem[] = [];
  for (const item of items) {
    const block = item.blockId ? byId.get(item.blockId) : undefined;
    if (block) block.items.push(item);
    else orphans.push(item);
  }
  const walk = (list: TreeBlock[], parent: TreeBlock | null, depth: number) => {
    list.sort(byPosition);
    for (const n of list) {
      n.depth = depth;
      n.effectiveHue = n.hue ?? parent?.effectiveHue ?? DEFAULT_HUE;
      n.items.sort(byPosition);
      walk(n.children, n, depth + 1);
    }
  };
  walk(roots, null, 0);
  orphans.sort(byPosition);
  return { roots, byId, orphans };
}

/** Eingangskorb als Pseudo-Block (oberste Ebene, eigene Farbe). */
export function inboxBlock(orphans: TreeItem[]): TreeBlock {
  return {
    id: INBOX_ID, parentId: null, name: "Eingangskorb", hue: INBOX_HUE, position: -1, span: null,
    depth: 0, effectiveHue: INBOX_HUE, children: [], items: orphans, parent: null,
  };
}

/** Alle Tickets im Teilbaum. */
export function leaves(block: TreeBlock): TreeItem[] {
  return [...block.items, ...block.children.flatMap(leaves)];
}

/** Hat der Block Inhalt (Tickets oder Unterblöcke)? Leere Blöcke zeigen ihre geplante Spanne. */
export const hasContent = (block: TreeBlock) => block.items.length > 0 || block.children.length > 0;

/** Zeitspanne aus den Tickets (min/max); null ohne Tickets. */
export function span(items: TreeItem[]): DaySpan | null {
  if (items.length === 0) return null;
  let start = Infinity;
  let end = -Infinity;
  for (const t of items) {
    if (t.start < start) start = t.start;
    if (t.end > end) end = t.end;
  }
  return { start, end };
}

/**
 * Spanne eines Blocks: aus dem Inhalt (rekursiv über Tickets und Unterblöcke),
 * sonst die geplante Spanne, sonst `fallback` (heute + vier Wochen).
 */
export function blockSpan(block: TreeBlock, fallback: DaySpan): DaySpan {
  if (!hasContent(block)) return block.span ?? fallback;
  let start = Infinity;
  let end = -Infinity;
  for (const t of block.items) {
    if (t.start < start) start = t.start;
    if (t.end > end) end = t.end;
  }
  for (const c of block.children) {
    const s = blockSpan(c, fallback);
    if (s.start < start) start = s.start;
    if (s.end > end) end = s.end;
  }
  return { start, end };
}

/** Ist `a` ein Vorfahre von `b`? */
export function isAncestor(a: TreeBlock, b: TreeBlock): boolean {
  let p = b.parent;
  while (p) {
    if (p === a) return true;
    p = p.parent;
  }
  return false;
}

/** Umhängen erlaubt? Nicht auf sich selbst, nicht in den eigenen Teilbaum, nicht auf den eigenen Elternblock. */
export function canMoveBlock(node: TreeBlock, target: TreeBlock | null): boolean {
  if (target === null) return node.parent !== null;
  return node !== target && !isAncestor(node, target) && node.parent !== target;
}

/** Fortschritt eines Blocks: erledigte Tickets / alle Tickets. */
export function blockProgress(block: TreeBlock): { done: number; total: number } {
  const all = leaves(block);
  return { done: all.filter((t) => statusOf(t.statusCategory) === "done").length, total: all.length };
}

/** Pfad der Vorfahren („Projekt › Teilprojekt › Bereich“). */
export function pathOf(block: TreeBlock | null): string {
  const names: string[] = [];
  let cur = block;
  while (cur) {
    names.unshift(cur.name);
    cur = cur.parent;
  }
  return names.join(" › ");
}

/** Objekttyp aus der Ebene: Projekt → Teilprojekt → Bereich (ab Ebene 2). */
export const TYPES = [
  { one: "Projekt", many: "Projekte" },
  { one: "Teilprojekt", many: "Teilprojekte" },
  { one: "Bereich", many: "Bereiche" },
] as const;

export function typeAt(depth: number): (typeof TYPES)[number] {
  return TYPES[Math.min(Math.max(depth, 0), TYPES.length - 1)];
}
