import { describe, it, expect } from "vitest";
import { calcCarryOver } from "./carryOver";
import type { DomainSprint } from "@/lib/domain/types";

function sprint(committed: number, completed: number): DomainSprint {
  return {
    id: "s1", name: "Sprint 1", state: "CLOSED",
    startDate: null, endDate: null, completeDate: null,
    committedPoints: committed, completedPoints: completed,
  };
}

describe("calcCarryOver", () => {
  it("returns committed minus completed", () => {
    expect(calcCarryOver(sprint(40, 34))).toBe(6);
  });

  it("returns 0 when everything was completed", () => {
    expect(calcCarryOver(sprint(30, 30))).toBe(0);
  });

  it("never returns negative (more completed than committed)", () => {
    expect(calcCarryOver(sprint(20, 25))).toBe(0);
  });
});
