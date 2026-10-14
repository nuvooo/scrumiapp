import { describe, it, expect } from "vitest";
import { deltaDays, shiftedSpan, issueDurationDays } from "./roadmapDrag";
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
    expect(deltaDays(74, 7.4, true)).toBe(7);
    expect(deltaDays(22, 7.4, true)).toBe(0);
    expect(deltaDays(-30, 7.4, true)).toBe(-7);
  });
  it("liefert 0 bei ungültiger Tagesbreite", () => {
    expect(deltaDays(50, 0)).toBe(0);
    expect(deltaDays(Number.NaN, 7)).toBe(0);
  });
});

describe("shiftedSpan", () => {
  const span = { start: 10, end: 14 };
  it("verschiebt die ganze Spanne", () => {
    expect(shiftedSpan(span, "move", 3)).toEqual({ start: 13, end: 17 });
  });
  it("zieht am rechten Rand und lässt mindestens einen Tag", () => {
    expect(shiftedSpan(span, "resizeR", 2)).toEqual({ start: 10, end: 16 });
    expect(shiftedSpan(span, "resizeR", -10)).toEqual({ start: 10, end: 10 });
  });
  it("zieht am linken Rand und lässt mindestens einen Tag", () => {
    expect(shiftedSpan(span, "resizeL", -2)).toEqual({ start: 8, end: 14 });
    expect(shiftedSpan(span, "resizeL", 10)).toEqual({ start: 14, end: 14 });
  });
});

describe("issueDurationDays", () => {
  it("nimmt die Sprintlänge, sonst zwei Wochen", () => {
    expect(issueDurationDays({ sprintStart: "2026-09-01", sprintEnd: "2026-09-14" }, dayDiff)).toBe(14);
    expect(issueDurationDays({ sprintStart: "2026-09-01", sprintEnd: "2026-09-21" }, dayDiff)).toBe(21);
    expect(issueDurationDays({}, dayDiff)).toBe(14);
    expect(issueDurationDays({ sprintStart: "2026-09-10", sprintEnd: "2026-09-01" }, dayDiff)).toBe(14);
  });
});
