import { describe, it, expect } from "vitest";
import {
  buildTree, leaves, span, isAncestor, canMoveBlock, blockProgress, packTracks, buildRows,
  statusOf, INBOX_ID, DEFAULT_HUE, type BlockInput, type TreeItem,
} from "./roadmapTree";

const blocks: BlockInput[] = [
  { id: "ht", parentId: null, name: "Headless", hue: 212, position: 0 },
  { id: "kc", parentId: "ht", name: "Kundencockpit", hue: 262, position: 0 },
  { id: "vg", parentId: "kc", name: "Vorgänge", hue: null, position: 1 },
  { id: "ds", parentId: "kc", name: "Design", hue: null, position: 0 },
  { id: "shop", parentId: "ht", name: "Shop", hue: 318, position: 1 },
];

const item = (id: string, blockId: string | null, laneId: string, start: number, end: number, status: string | null = null): TreeItem =>
  ({ id, blockId, laneId, start, end, statusCategory: status, storyPoints: 3, position: 0 });

const items: TreeItem[] = [
  item("t1", "ds", "ux", 0, 10, "done"),
  item("t2", "vg", "fe", 5, 20, "indeterminate"),
  item("t3", "vg", "fe", 15, 30),
  item("t4", "vg", "be", 8, 12),
  item("t5", null, "fe", 40, 45),
  item("t6", "shop", "fe", 100, 120),
];
const lanes = [{ id: "fe", name: "Frontend" }, { id: "be", name: "Backend" }, { id: "ux", name: "UX" }];

describe("buildTree", () => {
  it("baut Tiefe, Sortierung, Farbvererbung und Farbgruppen auf", () => {
    const tree = buildTree(blocks, items);
    expect(tree.roots.map((b) => b.id)).toEqual(["ht"]);
    const kc = tree.byId.get("kc")!;
    expect(kc.children.map((b) => b.id)).toEqual(["ds", "vg"]);
    expect(kc.depth).toBe(1);
    const vg = tree.byId.get("vg")!;
    expect(vg.depth).toBe(2);
    expect(vg.effectiveHue).toBe(262);
    expect(vg.colorGroup).toBe("kc");
    expect(vg.bands).toEqual([212, 262]);
    expect(tree.byId.get("shop")!.colorGroup).toBe("shop");
    expect(tree.orphans.map((t) => t.id)).toEqual(["t5"]);
  });

  it("nimmt den Standard-Farbton ohne eigene Farbe an der Wurzel", () => {
    const tree = buildTree([{ id: "a", parentId: null, name: "A", hue: null, position: 0 }], []);
    expect(tree.roots[0].effectiveHue).toBe(DEFAULT_HUE);
    expect(tree.roots[0].colorGroup).toBe("root");
  });
});

describe("leaves / span / progress", () => {
  it("sammelt Tickets des Teilbaums und berechnet min/max", () => {
    const tree = buildTree(blocks, items);
    const kc = tree.byId.get("kc")!;
    expect(leaves(kc).map((t) => t.id).sort()).toEqual(["t1", "t2", "t3", "t4"]);
    expect(span(leaves(kc))).toEqual({ start: 0, end: 30 });
    expect(span([])).toBeNull();
    expect(blockProgress(kc)).toEqual({ done: 1, total: 4 });
  });
});

describe("isAncestor / canMoveBlock", () => {
  it("verbietet Umhängen in den eigenen Teilbaum", () => {
    const tree = buildTree(blocks, items);
    const ht = tree.byId.get("ht")!;
    const vg = tree.byId.get("vg")!;
    expect(isAncestor(ht, vg)).toBe(true);
    expect(isAncestor(vg, ht)).toBe(false);
    expect(canMoveBlock(ht, vg)).toBe(false);
    expect(canMoveBlock(vg, ht)).toBe(true);
    expect(canMoveBlock(vg, vg)).toBe(false);
    expect(canMoveBlock(ht, null)).toBe(true);
  });
});

describe("packTracks", () => {
  it("stapelt überlappende Tickets, direkt anschließende teilen sich eine Spur", () => {
    const tracks = packTracks([item("a", null, "fe", 0, 10), item("b", null, "fe", 5, 12), item("c", null, "fe", 11, 15)]);
    expect(tracks.map((tr) => tr.map((t) => t.id))).toEqual([["a", "c"], ["b"]]);
  });
});

describe("buildRows", () => {
  it("liefert Meilensteine, Eingangskorb und nur aufgeklappte Blöcke mit Spuren", () => {
    const tree = buildTree(blocks, items);
    const rows = buildRows(tree, lanes, { open: new Set(["ht", "kc", "vg", INBOX_ID]), present: false });
    const desc = rows.map((r) =>
      r.type === "miles" ? "miles" : r.type === "block" ? `block:${r.block.id}${r.open ? "+" : ""}` : `lane:${r.block.id}/${r.laneId}`,
    );
    expect(desc).toEqual([
      "miles",
      `block:${INBOX_ID}+`, `lane:${INBOX_ID}/fe`,
      "block:ht+",
      "block:kc+",
      "block:ds",
      "block:vg+", "lane:vg/fe", "lane:vg/be",
      "block:shop",
    ]);
    const vgFe = rows.find((r) => r.type === "lane" && r.block.id === "vg" && r.laneId === "fe");
    expect(vgFe && vgFe.type === "lane" ? vgFe.tracks.length : 0).toBe(2);
  });

  it("markiert die erste Zeile jeder Farbgruppe", () => {
    const tree = buildTree(blocks, items);
    const rows = buildRows(tree, lanes, { open: new Set(["ht", "kc"]), present: false });
    const firsts = rows.flatMap((r) => (r.type === "block" && r.groupFirst ? [r.block.id] : []));
    expect(firsts).toEqual([INBOX_ID, "ht", "kc", "shop"]);
  });

  it("klappt im Präsentationsmodus nur die obersten zwei Ebenen auf", () => {
    const tree = buildTree(blocks, items);
    const rows = buildRows(tree, lanes, { open: new Set(["ht", "kc", "vg"]), present: true });
    const kc = rows.find((r) => r.type === "block" && r.block.id === "kc");
    expect(kc && kc.type === "block" ? kc.open : null).toBe(false);
    expect(rows.some((r) => r.type === "block" && r.block.id === "vg")).toBe(false);
    expect(rows.some((r) => r.type === "lane")).toBe(false);
  });

  it("statusOf bildet Jira-Kategorien ab", () => {
    expect(statusOf("done")).toBe("done");
    expect(statusOf("indeterminate")).toBe("wip");
    expect(statusOf("new")).toBe("open");
    expect(statusOf(null)).toBe("open");
  });
});
