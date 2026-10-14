import { describe, it, expect } from "vitest";
import { dayNumber, dayFromNumber } from "./roadmapDays";
import { buildTree, type BlockInput, type TreeItem } from "./roadmapTree";
import {
  DEFAULT_SPRINT_ANCHOR, H, INSET, PAD_AFTER, PAD_BEFORE,
  addTarget, computeView, contentHeight, dependencyArrows, flattenBoxes, gridOffsetDays, hasHit, headHeight,
  isOverdue, layoutCanvas, matchesQuery, matchesSelf, measureBlock, monthCells, packRows, presentScale, weekCells,
  type LayoutOptions,
} from "./roadmapLayout";

const block = (id: string, parentId: string | null, position: number, spanOf: BlockInput["span"] = null): BlockInput =>
  ({ id, parentId, name: id, hue: null, position, span: spanOf });
const item = (id: string, blockId: string | null, start: number, end: number, extra: Partial<TreeItem> = {}): TreeItem =>
  ({ id, blockId, laneId: "fe", start, end, statusCategory: "new", storyPoints: 3, position: 0, jiraKey: id.toUpperCase(), title: `Titel ${id}`, ...extra });

const TODAY = dayNumber("2026-09-22");
const opts = (over: Partial<LayoutOptions> = {}): LayoutOptions => ({
  view: { a: 0, b: 1000 }, dw: 10, sc: 1, present: false, isOpen: () => true, fallback: { start: TODAY, end: TODAY + 27 }, ...over,
});

describe("Tagesnummern und Zeitfenster", () => {
  it("rechnet Keys in absolute Tage und zurück; der Sprintanker ist Montag, der 31.08.2026", () => {
    expect(dayFromNumber(dayNumber("2026-09-22"))).toBe("2026-09-22");
    expect(dayFromNumber(DEFAULT_SPRINT_ANCHOR)).toBe("2026-08-31");
    expect(new Date(DEFAULT_SPRINT_ANCHOR * 86_400_000).getUTCDay()).toBe(1);
  });
  it("umschließt heute, Spannen und Meilensteine mit Luft davor und dahinter", () => {
    expect(computeView([], TODAY, [])).toEqual({ a: TODAY - PAD_BEFORE, b: TODAY + PAD_AFTER });
    const v = computeView([{ start: TODAY - 30, end: TODAY + 10 }], TODAY, [TODAY + 200]);
    expect(v).toEqual({ a: TODAY - 30 - PAD_BEFORE, b: TODAY + 200 + PAD_AFTER });
  });
  it("hängt das Sprintraster am Anker", () => {
    expect(gridOffsetDays(DEFAULT_SPRINT_ANCHOR, DEFAULT_SPRINT_ANCHOR)).toBe(0);
    expect(gridOffsetDays(DEFAULT_SPRINT_ANCHOR - 3, DEFAULT_SPRINT_ANCHOR)).toBe(11);
    expect(gridOffsetDays(DEFAULT_SPRINT_ANCHOR + 15, DEFAULT_SPRINT_ANCHOR)).toBe(1);
  });
});

describe("packRows", () => {
  it("packt Kinder in Zeilen; was sich in Pixeln überschneidet, rutscht tiefer", () => {
    const k = (L: number, R: number, h: number) => ({ kind: "ticket" as const, item: item("x", null, 0, 0), L, R, h, top: 0 });
    const rows = packRows([k(0, 50, 30), k(60, 100, 30), k(40, 90, 40), k(200, 220, 30)]);
    expect(rows.length).toBe(2);
    expect(rows[0].items.map((b) => b.L)).toEqual([0, 60, 200]);
    expect(rows[1].items.map((b) => b.L)).toEqual([40]);
    expect(rows[1].h).toBe(40);
  });
});

describe("measureBlock / layoutCanvas", () => {
  const tree = buildTree(
    [block("p", null, 0), block("tp", "p", 0), block("leer", "p", 1, { start: 100, end: 109 }), block("ohne", null, 1)],
    [item("t1", "tp", 10, 19), item("t2", "tp", 15, 24), item("t3", "tp", 30, 39)],
  );
  it("eingeklappt ist ein Block ein Balken in Kopfhöhe mit der Spanne seines Inhalts", () => {
    const m = measureBlock(tree.byId.get("tp")!, opts({ isOpen: () => false }));
    expect(m.open).toBe(false);
    expect(m.h).toBe(headHeight(1, false, 1));
    expect(m.L).toBe(100);
    expect(m.R).toBe(400);
  });
  it("aufgeklappt wächst er nach unten: Kopf + gepackte Zeilen, Kinder zeitgenau, Rahmen um INSET breiter", () => {
    const m = measureBlock(tree.byId.get("tp")!, opts());
    expect(m.open).toBe(true);
    // t1 und t2 überschneiden sich → zwei Zeilen; t3 passt in die erste Zeile
    const head = headHeight(1, false, 1);
    expect(m.h).toBe(head + H.pad + H.ticket * 2 + H.gap + H.pad);
    expect(m.L).toBe(100 - INSET);
    expect(m.R).toBe(400 + INSET);
    const tops = m.children.map((c) => [c.kind === "ticket" ? c.item.id : "", c.top]);
    expect(tops).toContainEqual(["t1", head + H.pad]);
    expect(tops).toContainEqual(["t3", head + H.pad]);
    expect(tops).toContainEqual(["t2", head + H.pad + H.ticket + H.gap]);
  });
  it("ein leerer offener Block zeigt seine geplante Spanne mit Mindestbreite und Leerzeile", () => {
    const m = measureBlock(tree.byId.get("leer")!, opts());
    expect(m.empty).toBe(true);
    expect(m.L).toBe(1000);
    expect(m.R).toBe(1000 + 260);
    expect(m.h).toBe(headHeight(1, false, 1) + H.empty);
  });
  it("ohne Inhalt und ohne Spanne gilt der Fallback (heute + vier Wochen)", () => {
    const m = measureBlock(tree.byId.get("ohne")!, opts({ isOpen: () => false }));
    expect(m.span).toEqual({ start: TODAY, end: TODAY + 27 });
  });
  it("stapelt die Wurzeln untereinander und liefert Mindesthöhe und linke Kante", () => {
    const lay = layoutCanvas(tree, opts({ isOpen: () => false }));
    expect(lay.boxes.map((b) => b.block.id)).toEqual(["p", "ohne"]);
    expect(lay.boxes[0].top).toBe(H.top);
    expect(lay.boxes[1].top).toBe(H.top + headHeight(0, false, 1) + H.vgap);
    expect(lay.height).toBe(lay.boxes[1].top + headHeight(0, false, 1) + H.vgap + H.top);
    expect(lay.minL).toBe(100);
  });
  it("legt den Eingangskorb als erste Wurzel an, wenn es verwaiste Tickets gibt", () => {
    const t2 = buildTree([block("p", null, 0)], [item("o", null, 5, 6)]);
    const lay = layoutCanvas(t2, opts());
    expect(lay.boxes[0].block.id).toBe("__inbox");
    expect(lay.boxes[0].children[0]).toMatchObject({ kind: "ticket" });
  });
  it("skaliert Höhen im Präsentationsmodus", () => {
    const m = measureBlock(tree.byId.get("tp")!, opts({ present: true, sc: 1.5, isOpen: () => false }));
    expect(m.h).toBe(Math.round((8 + 34) * 1.5));
    expect(presentScale(500, 1000)).toBe(1.7);
    expect(presentScale(500, 600)).toBe(1.2);
    expect(presentScale(500, 300)).toBe(1);
    expect(contentHeight(tree, opts({ isOpen: () => false }))).toBe(H.top + 2 * (headHeight(0, false, 1) + H.vgap));
  });
});

describe("flattenBoxes / dependencyArrows / isOverdue", () => {
  it("liefert absolute Lagen und Pfeile vom Blockierer zum Blockierten", () => {
    const tree = buildTree([block("p", null, 0)], [item("a", "p", 10, 19), item("b", "p", 30, 39, { jiraKey: "B" })]);
    const lay = layoutCanvas(tree, opts());
    const abs = flattenBoxes(lay.boxes);
    const p = abs.get("p")!;
    const a = abs.get("a")!;
    expect(p.top).toBe(H.top);
    expect(a.top).toBe(H.top + headHeight(0, false, 1) + H.pad);
    const arrows = dependencyArrows([{ id: "a", jiraKey: "A", blockedBy: [] }, { id: "b", jiraKey: "B", blockedBy: ["A", "UNBEKANNT"] }], abs);
    expect(arrows.length).toBe(1);
    expect(arrows[0].key).toBe("a->b");
    expect(arrows[0].line.startsWith(`M${a.R} ${a.top + a.h / 2}`)).toBe(true);
  });
  it("markiert überschrittene Endtermine nur bei nicht erledigten Tickets", () => {
    expect(isOverdue(item("x", null, 0, TODAY - 1), TODAY)).toBe(true);
    expect(isOverdue(item("x", null, 0, TODAY), TODAY)).toBe(false);
    expect(isOverdue(item("x", null, 0, TODAY - 1, { statusCategory: "done" }), TODAY)).toBe(false);
  });
});

describe("Suche", () => {
  const tree = buildTree([block("Kundencockpit", null, 0), block("Retouren", "Kundencockpit", 0)], [item("cusi-1", "Retouren", 1, 2, { title: "Retourendetails-Modal" })]);
  const kc = tree.byId.get("Kundencockpit")!;
  const ret = tree.byId.get("Retouren")!;
  it("trifft Namen, Keys und Titel, rekursiv nach unten", () => {
    expect(matchesSelf(kc, "cockpit")).toBe(true);
    expect(matchesSelf(kc, "modal")).toBe(false);
    expect(matchesQuery(kc, "modal")).toBe(true);
    expect(matchesQuery(ret.items[0], "CUSI-1")).toBe(true);
    expect(matchesQuery(ret.items[0], "nix")).toBe(false);
    expect(hasHit(kc, "modal")).toBe(true);
    expect(hasHit(ret, "cockpit")).toBe(false);
    expect(hasHit(kc, "")).toBe(false);
    expect(matchesQuery(ret, "   ")).toBe(true);
  });
});

describe("addTarget", () => {
  const tree = buildTree(
    [block("ht", null, 0), block("kc", "ht", 0), block("ds", "kc", 0), block("vg", "kc", 1), block("ret", "vg", 0), block("plt", "ht", 1)],
    [],
  );
  const g = (id: string) => tree.byId.get(id)!;
  it("Projekt immer oberste Ebene", () => {
    expect(addTarget("projekt", g("ret"), tree.roots)).toBeNull();
  });
  it("Teilprojekt in das Projekt des Kontexts, sonst ins erste Projekt", () => {
    expect(addTarget("teilprojekt", g("ret"), tree.roots)?.id).toBe("ht");
    expect(addTarget("teilprojekt", null, tree.roots)?.id).toBe("ht");
    expect(addTarget("teilprojekt", null, [])).toBeNull();
  });
  it("Bereich in den Kontext ab Teilprojekt-Ebene, bei einem Projekt in dessen erstes Teilprojekt", () => {
    expect(addTarget("bereich", g("vg"), tree.roots)?.id).toBe("vg");
    expect(addTarget("bereich", g("ht"), tree.roots)?.id).toBe("kc");
    expect(addTarget("bereich", g("plt"), tree.roots)?.id).toBe("plt");
    expect(addTarget("bereich", null, tree.roots)?.id).toBe("kc");
  });
  it("Ticket in den tiefsten passenden Block", () => {
    expect(addTarget("ticket", g("ret"), tree.roots)?.id).toBe("ret");
    expect(addTarget("ticket", g("kc"), tree.roots)?.id).toBe("ds");
    expect(addTarget("ticket", g("ht"), tree.roots)?.id).toBe("kc");
    expect(addTarget("ticket", null, tree.roots)?.id).toBe("ds");
  });
});

describe("Zeitleiste", () => {
  it("Monatszellen beschneiden am Rand und markieren Quartale", () => {
    const a = dayNumber("2026-09-20");
    const cells = monthCells({ a, b: dayNumber("2026-11-05") });
    expect(cells.map((c) => c.label)).toEqual(["Sep 26", "Q4 · Okt 26", "Nov 26"]);
    expect(cells[0]).toMatchObject({ start: a, days: 11, q: false });
    expect(cells[1].q).toBe(true);
    expect(cells[2].days).toBe(4);
  });
  it("Wochenzellen hängen an Montagen, Quartalszoom zeigt Sprintpaare", () => {
    const view = { a: dayNumber("2026-08-29"), b: dayNumber("2026-10-27") };
    const weeks = weekCells(view, "m", DEFAULT_SPRINT_ANCHOR);
    expect(weeks[0]).toMatchObject({ start: DEFAULT_SPRINT_ANCHOR, days: 7, label: "36" });
    expect(weekCells(view, "w", DEFAULT_SPRINT_ANCHOR)[0].label).toBe("KW 36");
    const sprints = weekCells(view, "q", DEFAULT_SPRINT_ANCHOR);
    expect(sprints.map((s) => s.label)).toEqual(["S1–2", "S3–4", "S5–6"]);
    expect(sprints[1].start).toBe(DEFAULT_SPRINT_ANCHOR + 28);
  });
});
