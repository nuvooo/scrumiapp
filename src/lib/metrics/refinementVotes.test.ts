import { describe, it, expect } from "vitest";
import { calcVoteStats } from "./refinementVotes";

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
