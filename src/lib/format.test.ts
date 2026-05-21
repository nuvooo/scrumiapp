import { describe, it, expect } from "vitest";
import { formatPoints, formatDateShort, trendSymbol, roundTo1, formatDelta } from "./format";

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

describe("formatDelta", () => {
  it("prefixes a plus for positive values", () => {
    expect(formatDelta(3)).toBe("+3");
  });

  it("uses a real minus sign for negative values", () => {
    expect(formatDelta(-2)).toBe("−2");
  });

  it("shows ±0 for zero", () => {
    expect(formatDelta(0)).toBe("±0");
  });
});
