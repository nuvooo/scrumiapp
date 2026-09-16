/**
 * Blockbaum der Roadmap: Tiefe, Farbvererbung, Zeitspannen aus den Tickets
 * und der Zeilenaufbau der Timeline (Meilensteine, Eingangskorb, Blöcke, Spuren).
 */

export const DEFAULT_HUE = 212;
/** Pseudo-Block für Tickets ohne Block-Zuordnung. */
export const INBOX_ID = "__inbox";
export const INBOX_HUE = 220;

export type BarStatus = "done" | "wip" | "open";

export interface BlockInput {
  id: string;
  parentId: string | null;
  name: string;
  hue: number | null;
  position: number;
}

export interface TreeItem {
  id: string;
  blockId: string | null;
  laneId: string;
  /** Tag-Indizes im Raster (inklusive) */
  start: number;
  end: number;
  statusCategory: string | null;
  storyPoints: number;
  position: number;
}

export interface TreeBlock extends BlockInput {
  depth: number;
  /** Eigener Farbton oder vom nächsten Vorfahren geerbt */
  effectiveHue: number;
  /** Block, der die Farbe setzt (Gruppengrenze für die Trennlinie) */
  colorGroup: string;
  /** Vererbte Farbtöne von außen nach innen (Kopfbänder) */
  bands: number[];
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
    byId.set(b.id, {
      ...b, depth: 0, effectiveHue: DEFAULT_HUE, colorGroup: "root", bands: [],
      children: [], items: [], parent: null,
    });
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
      n.colorGroup = n.hue !== null ? n.id : parent?.colorGroup ?? "root";
      n.bands = n.hue !== null ? [...(parent?.bands ?? []), n.hue] : [...(parent?.bands ?? [])];
      n.items.sort(byPosition);
      walk(n.children, n, depth + 1);
    }
  };
  walk(roots, null, 0);
  orphans.sort(byPosition);
  return { roots, byId, orphans };
}

/** Alle Tickets im Teilbaum. */
export function leaves(block: TreeBlock): TreeItem[] {
  return [...block.items, ...block.children.flatMap(leaves)];
}

/** Zeitspanne aus den Tickets (min/max); null ohne Tickets. */
export function span(items: TreeItem[]): { start: number; end: number } | null {
  if (items.length === 0) return null;
  let start = Infinity;
  let end = -Infinity;
  for (const t of items) {
    if (t.start < start) start = t.start;
    if (t.end > end) end = t.end;
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

export type DropPosition = "before" | "after" | "into";

/** Umhängen erlaubt? Nicht auf sich selbst und nicht in den eigenen Teilbaum. */
export function canMoveBlock(node: TreeBlock, target: TreeBlock | null): boolean {
  if (target === null) return true;
  return node !== target && !isAncestor(node, target);
}

/** Fortschritt eines Blocks: erledigte Tickets / alle Tickets. */
export function blockProgress(block: TreeBlock): { done: number; total: number } {
  const all = leaves(block);
  return { done: all.filter((t) => statusOf(t.statusCategory) === "done").length, total: all.length };
}

/** Greedy-Stapelung überlappender Tickets in Spuren („2 parallel"). */
export function packTracks(items: TreeItem[]): TreeItem[][] {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end || byPosition(a, b));
  const tracks: TreeItem[][] = [];
  for (const t of sorted) {
    const track = tracks.find((tr) => tr[tr.length - 1].end < t.start);
    if (track) track.push(t);
    else tracks.push([t]);
  }
  return tracks;
}

export interface RowMiles {
  type: "miles";
}
export interface RowBlock {
  type: "block";
  block: TreeBlock;
  open: boolean;
  /** Erste Zeile einer Farbgruppe (kräftige Trennlinie) */
  groupFirst: boolean;
  inbox: boolean;
}
export interface RowLane {
  type: "lane";
  laneId: string;
  laneName: string;
  laneIndex: number;
  block: TreeBlock;
  tracks: TreeItem[][];
  inbox: boolean;
}
export type Row = RowMiles | RowBlock | RowLane;

export interface LaneDef {
  id: string;
  name: string;
}

export interface RowOptions {
  /** Aufgeklappte Block-IDs */
  open: Set<string>;
  /** Präsentationsmodus: nur oberste zwei Ebenen aufgeklappt */
  present: boolean;
}

/** Eingangskorb als Pseudo-Block, damit Spurzeilen einheitlich gebaut werden. */
export function inboxBlock(orphans: TreeItem[]): TreeBlock {
  return {
    id: INBOX_ID, parentId: null, name: "Eingangskorb", hue: INBOX_HUE, position: -1,
    depth: 0, effectiveHue: INBOX_HUE, colorGroup: INBOX_ID, bands: [INBOX_HUE],
    children: [], items: orphans, parent: null,
  };
}

function laneRows(block: TreeBlock, lanes: LaneDef[], inbox: boolean): RowLane[] {
  const rows: RowLane[] = [];
  lanes.forEach((lane, laneIndex) => {
    const list = block.items.filter((t) => t.laneId === lane.id);
    if (list.length === 0) return;
    rows.push({ type: "lane", laneId: lane.id, laneName: lane.name, laneIndex, block, tracks: packTracks(list), inbox });
  });
  return rows;
}

/** Zeilen der Timeline in Anzeigereihenfolge. */
export function buildRows(tree: RoadmapTree, lanes: LaneDef[], opts: RowOptions): Row[] {
  const rows: Row[] = [];
  rows.push({ type: "miles" });

  if (tree.orphans.length > 0) {
    const inbox = inboxBlock(tree.orphans);
    const open = opts.open.has(INBOX_ID);
    rows.push({ type: "block", block: inbox, open, groupFirst: true, inbox: true });
    if (open) rows.push(...laneRows(inbox, lanes, true));
  }

  const rec = (list: TreeBlock[]) => {
    for (const n of list) {
      const open = opts.open.has(n.id) && !(opts.present && n.depth >= 1);
      rows.push({ type: "block", block: n, open, groupFirst: false, inbox: false });
      if (!open) continue;
      rec(n.children);
      rows.push(...laneRows(n, lanes, false));
    }
  };
  rec(tree.roots);

  let seen: string | null = null;
  for (const r of rows) {
    if (r.type !== "block" || r.inbox) continue;
    if (r.block.colorGroup !== seen) {
      r.groupFirst = true;
      seen = r.block.colorGroup;
    }
  }
  return rows;
}
