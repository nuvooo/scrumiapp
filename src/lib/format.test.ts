import { describe, it, expect } from "vitest";
import { formatPoints, formatDateShort, trendSymbol, roundTo1 } from "./format";

describe("formatPoints", () => {
  it("shows up to one decimal, trims trailing zeros", () => {
    expect(formatPoints(34)).toBe("34");
    expect(formatPoints(2.5)).toBe("2,5");
  });
});

describe("formatDateShort", () => {
  it("formats as DD.MM.", () => {
    expect(formatDateShort(new Date("2026-05-19T00:00:00.000Z"))).toBe("19.05.");
  });
});

describe("trendSymbol", () => {
  it("maps trend direction to an arrow", () => {
    expect(trendSymbol("UP")).toBe("▲");
    expect(trendSymbol("DOWN")).toBe("▼");
    expect(trendSymbol("FLAT")).toBe("▬");
  });
});

describe("roundTo1", () => {
  it("rounds to one decimal place", () => {
    expect(roundTo1(2.55)).toBe(2.6);
    expect(roundTo1(40)).toBe(40);
  });
});
