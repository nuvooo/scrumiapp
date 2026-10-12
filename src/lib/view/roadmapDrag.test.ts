import { describe, it, expect } from "vitest";
import { clampSpan, deltaDays, issueDurationDays, shiftedSpan, ticketTarget, treeDropPosition } from "./roadmapDrag";
import { dayDiff } from "./roadmapDays";

describe("deltaDays", () => {
  it("rundet Pixel auf ganze Tage", () => {
    expect(deltaDays(0, 7.4)).toBe(0);
    expect(deltaDays(3.6, 7.4)).toBe(0);
    expect(deltaDays(3.8, 7.4)).toBe(1);
    expect(deltaDays(-11, 7.4)).toBe(-1);
    expect(deltaDays(74, 7.4)).toBe(10);
  });

  it("rastert mit Umschalt-Taste auf ganze Wochen", () => {
    expect(deltaDays(3 * 7.4, 7.4, true)).toBe(0);
    expect(deltaDays(4 * 7.4, 7.4, true)).toBe(7);
    expect(deltaDays(-10 * 7.4, 7.4, true)).toBe(-7);
  });

  it("liefert 0 bei ungültiger Tagesbreite", () => {
    expect(deltaDays(100, 0)).toBe(0);
    expect(deltaDays(Number.NaN, 7.4)).toBe(0);
  });
});

describe("shiftedSpan", () => {
  const span = { start: 10, end: 20 };
  it("verschiebt die ganze Spanne", () => {
    expect(shiftedSpan(span, "move", 5)).toEqual({ start: 15, end: 25 });
    expect(shiftedSpan(span, "move", -12)).toEqual({ start: -2, end: 8 });
  });
  it("zieht am rechten Rand und lässt mindestens einen Tag", () => {
    expect(shiftedSpan(span, "resizeR", 3)).toEqual({ start: 10, end: 23 });
    expect(shiftedSpan(span, "resizeR", -50)).toEqual({ start: 10, end: 10 });
  });
  it("zieht am linken Rand und lässt mindestens einen Tag", () => {
    expect(shiftedSpan(span, "resizeL", -3)).toEqual({ start: 7, end: 20 });
    expect(shiftedSpan(span, "resizeL", 50)).toEqual({ start: 20, end: 20 });
  });
});

describe("clampSpan", () => {
  it("hält eine verschobene Spanne im Roadmap-Zeitraum", () => {
    expect(clampSpan({ start: -3, end: 7 }, "move", 100)).toEqual({ start: 0, end: 10 });
    expect(clampSpan({ start: 95, end: 105 }, "move", 100)).toEqual({ start: 89, end: 99 });
    expect(clampSpan({ start: 5, end: 9 }, "move", 100)).toEqual({ start: 5, end: 9 });
  });
  it("klemmt beim Ziehen nur den bewegten Rand", () => {
    expect(clampSpan({ start: 90, end: 130 }, "resizeR", 100)).toEqual({ start: 90, end: 99 });
    expect(clampSpan({ start: -5, end: 9 }, "resizeL", 100)).toEqual({ start: 0, end: 9 });
  });
});

describe("ticketTarget", () => {
  const own = { laneId: "fe", blockId: "b1" };
  it("Spurzelle setzt Spur und Block", () => {
    expect(ticketTarget(own, { kind: "cell", laneId: "be", blockId: "b2" })).toEqual({ laneId: "be", blockId: "b2" });
    expect(ticketTarget(own, { kind: "cell", laneId: "be", blockId: null })).toEqual({ laneId: "be", blockId: null });
  });
  it("Blockzeile setzt nur den Block", () => {
    expect(ticketTarget(own, { kind: "row", blockId: "b3" })).toEqual({ laneId: "fe", blockId: "b3" });
    expect(ticketTarget(own, { kind: "row", blockId: null })).toEqual({ laneId: "fe", blockId: null });
  });
  it("ohne Ziel oder auf der Meilensteinzeile bleibt alles", () => {
    expect(ticketTarget(own, null)).toEqual(own);
    expect(ticketTarget(own, { kind: "miles" })).toEqual(own);
  });
});

describe("treeDropPosition", () => {
  it("teilt die Zeile in davor / hinein / danach", () => {
    expect(treeDropPosition(0.1)).toBe("before");
    expect(treeDropPosition(0.5)).toBe("into");
    expect(treeDropPosition(0.9)).toBe("after");
  });
});

describe("issueDurationDays", () => {
  it("nimmt die Sprintlänge, sonst zwei Wochen", () => {
    expect(issueDurationDays({ sprintStart: "2026-10-05", sprintEnd: "2026-10-16" }, dayDiff)).toBe(12);
    expect(issueDurationDays({ sprintStart: null, sprintEnd: null }, dayDiff)).toBe(14);
    expect(issueDurationDays({}, dayDiff)).toBe(14);
    expect(issueDurationDays({ sprintStart: "2026-10-16", sprintEnd: "2026-10-05" }, dayDiff)).toBe(14);
  });
});
