import { describe, it, expect } from "vitest";
import { calcVoteStats, isUnanimous } from "./refinementVotes";

describe("calcVoteStats", () => {
  it("berechnet Durchschnitt und Median", () => {
    expect(calcVoteStats([3, 5, 8])).toEqual({ average: 5.3, median: 5, count: 3 });
  });

  it("mittelt den Median bei gerader Anzahl", () => {
    expect(calcVoteStats([3, 5, 8, 13])).toEqual({ average: 7.3, median: 6.5, count: 4 });
  });

  it("ignoriert „?“-Votes (null)", () => {
    expect(calcVoteStats([5, null, 8, null])).toEqual({ average: 6.5, median: 6.5, count: 2 });
  });

  it("liefert null ohne numerische Votes", () => {
    expect(calcVoteStats([null, null])).toEqual({ average: null, median: null, count: 0 });
    expect(calcVoteStats([])).toEqual({ average: null, median: null, count: 0 });
  });
});

describe("isUnanimous", () => {
  it("erkennt Einstimmigkeit ab zwei gleichen Karten", () => {
    expect(isUnanimous([5, 5])).toBe(true);
    expect(isUnanimous([8, 8, 8])).toBe(true);
  });

  it("verschiedene Karten sind nicht einstimmig", () => {
    expect(isUnanimous([5, 8])).toBe(false);
  });

  it("„?“-Votes (null) verhindern Einstimmigkeit", () => {
    expect(isUnanimous([5, 5, null])).toBe(false);
    expect(isUnanimous([null, null])).toBe(false);
  });

  it("eine einzelne Stimme ist kein Konsens", () => {
    expect(isUnanimous([5])).toBe(false);
    expect(isUnanimous([])).toBe(false);
  });
});
