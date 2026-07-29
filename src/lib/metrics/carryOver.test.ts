import { describe, it, expect } from "vitest";
import { calcCarryOver } from "./carryOver";

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
