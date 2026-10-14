import { describe, it, expect } from "vitest";
import {
  blockProgress, blockSpan, buildTree, canMoveBlock, isAncestor, leaves, pathOf, span, statusOf, typeAt,
  type BlockInput, type TreeItem,
} from "./roadmapTree";

const block = (id: string, parentId: string | null, position: number, hue: number | null = null, spanOf: BlockInput["span"] = null): BlockInput =>
  ({ id, parentId, name: id.toUpperCase(), hue, position, span: spanOf });

const item = (id: string, blockId: string | null, start: number, end: number, status: string | null = "new"): TreeItem =>
  ({ id, blockId, laneId: "fe", start, end, statusCategory: status, storyPoints: 3, position: 0, jiraKey: `K-${id}`, title: id });

const FALLBACK = { start: 1000, end: 1027 };

describe("buildTree", () => {
  it("baut Tiefe, Sortierung und Farbvererbung auf", () => {
    const tree = buildTree(
      [block("b", null, 1, 318), block("a", null, 0, 212), block("a1", "a", 0), block("a2", "a", 1, 262), block("a21", "a2", 0)],
      [item("t1", "a1", 10, 12), item("t2", null, 5, 6)],
    );
    expect(tree.roots.map((r) => r.id)).toEqual(["a", "b"]);
    const a = tree.byId.get("a")!;
    expect(a.children.map((c) => c.id)).toEqual(["a1", "a2"]);
    expect(tree.byId.get("a1")!.depth).toBe(1);
    expect(tree.byId.get("a21")!.depth).toBe(2);
    expect(tree.byId.get("a1")!.effectiveHue).toBe(212);
    expect(tree.byId.get("a21")!.effectiveHue).toBe(262);
    expect(tree.byId.get("a1")!.items.map((t) => t.id)).toEqual(["t1"]);
    expect(tree.orphans.map((t) => t.id)).toEqual(["t2"]);
  });
  it("nimmt den Standard-Farbton ohne eigene Farbe an der Wurzel", () => {
    const tree = buildTree([block("r", null, 0)], []);
    expect(tree.roots[0].effectiveHue).toBe(212);
  });
});

describe("leaves / span / blockSpan / progress", () => {
  const tree = buildTree(
    [block("a", null, 0), block("a1", "a", 0), block("e", null, 1, null, { start: 50, end: 60 }), block("f", null, 2)],
    [item("t1", "a", 10, 12, "done"), item("t2", "a1", 8, 20), item("t3", "a1", 15, 30, "indeterminate")],
  );
  it("sammelt Tickets des Teilbaums und berechnet min/max", () => {
    const a = tree.byId.get("a")!;
    expect(leaves(a).map((t) => t.id).sort()).toEqual(["t1", "t2", "t3"]);
    expect(span(leaves(a))).toEqual({ start: 8, end: 30 });
    expect(span([])).toBeNull();
    expect(blockProgress(a)).toEqual({ done: 1, total: 3 });
  });
  it("leitet die Blockspanne aus dem Inhalt ab, leere Blöcke nutzen die geplante Spanne oder den Fallback", () => {
    expect(blockSpan(tree.byId.get("a")!, FALLBACK)).toEqual({ start: 8, end: 30 });
    expect(blockSpan(tree.byId.get("e")!, FALLBACK)).toEqual({ start: 50, end: 60 });
    expect(blockSpan(tree.byId.get("f")!, FALLBACK)).toEqual(FALLBACK);
  });
});

describe("isAncestor / canMoveBlock / pathOf", () => {
  const tree = buildTree([block("a", null, 0), block("a1", "a", 0), block("a11", "a1", 0), block("b", null, 1)], []);
  const a = tree.byId.get("a")!;
  const a1 = tree.byId.get("a1")!;
  const a11 = tree.byId.get("a11")!;
  const b = tree.byId.get("b")!;
  it("verbietet Umhängen in den eigenen Teilbaum und auf den eigenen Elternblock", () => {
    expect(isAncestor(a, a11)).toBe(true);
    expect(isAncestor(a11, a)).toBe(false);
    expect(canMoveBlock(a, a11)).toBe(false);
    expect(canMoveBlock(a, a)).toBe(false);
    expect(canMoveBlock(a11, a)).toBe(true);
    expect(canMoveBlock(a1, a)).toBe(false);
    expect(canMoveBlock(a1, b)).toBe(true);
    expect(canMoveBlock(a11, null)).toBe(true);
    expect(canMoveBlock(a, null)).toBe(false);
  });
  it("bildet den Pfad der Vorfahren", () => {
    expect(pathOf(a11)).toBe("A › A1 › A11");
    expect(pathOf(null)).toBe("");
  });
});

describe("statusOf / typeAt", () => {
  it("bildet Jira-Kategorien und Ebenen ab", () => {
    expect(statusOf("done")).toBe("done");
    expect(statusOf("indeterminate")).toBe("wip");
    expect(statusOf("new")).toBe("open");
    expect(statusOf(null)).toBe("open");
    expect(typeAt(0).one).toBe("Projekt");
    expect(typeAt(1).one).toBe("Teilprojekt");
    expect(typeAt(5).one).toBe("Bereich");
  });
});
