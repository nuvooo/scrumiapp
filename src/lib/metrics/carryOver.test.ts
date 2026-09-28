import { describe, it, expect } from "vitest";
import { calcCarryOver, calcCommitmentSplit } from "./carryOver";

const issue = (jiraKey: string, storyPoints: number) => ({ jiraKey, storyPoints });

describe("calcCarryOver", () => {
  it("sums the points of issues that were already in the previous sprint", () => {
    const committedIssues = [issue("AB-1", 5), issue("AB-2", 3), issue("AB-3", 8)];
    const previousKeys = new Set(["AB-1", "AB-3"]);
    expect(calcCarryOver(committedIssues, previousKeys)).toBe(13);
  });

  it("returns 0 when no issue was in the previous sprint", () => {
    expect(calcCarryOver([issue("AB-1", 5)], new Set(["ZZ-9"]))).toBe(0);
  });

  it("returns 0 without a previous sprint", () => {
    expect(calcCarryOver([issue("AB-1", 5)], new Set())).toBe(0);
  });
});

describe("calcCommitmentSplit", () => {
  it("uses the stored remaining points of carried tickets instead of their full estimate", () => {
    const committed = [issue("AB-1", 8), issue("AB-2", 5), issue("AB-3", 25)];
    const split = calcCommitmentSplit(38, committed, [
      { jiraKey: "AB-1", remainingPoints: 3 },
      { jiraKey: "AB-2", remainingPoints: 5 },
    ], 13);
    expect(split).toEqual({ carried: 8, fresh: 25, total: 33, source: "planning" });
  });

  it("counts a carried ticket that is no longer in the sprint only with its remaining points", () => {
    const split = calcCommitmentSplit(30, [issue("AB-3", 30)], [{ jiraKey: "AB-9", remainingPoints: 10 }], 0);
    expect(split).toEqual({ carried: 10, fresh: 30, total: 40, source: "planning" });
  });

  it("falls back to the automatically detected carry-over without planning marks", () => {
    expect(calcCommitmentSplit(40, [issue("AB-1", 40)], [], 10)).toEqual({
      carried: 10,
      fresh: 30,
      total: 40,
      source: "auto",
    });
  });
});
