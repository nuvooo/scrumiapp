import { describe, it, expect } from "vitest";
import { calcCapacityEfficiency, scaleToSprintLength } from "./capacity";
import type { DomainSprint, DomainCapacityEntry } from "@/lib/domain/types";

function sprint(completed: number): DomainSprint {
  return {
    id: "s1", name: "Sprint 1", state: "CLOSED",
    startDate: null, endDate: null, completeDate: null,
    committedPoints: 0, completedPoints: completed,
  };
}

const entries: DomainCapacityEntry[] = [
  { teamMemberId: "a", name: "Alice", plannedPersonDays: 8, actualPersonDays: 6 },
  { teamMemberId: "b", name: "Bob", plannedPersonDays: 8, actualPersonDays: 8 },
];

describe("calcCapacityEfficiency", () => {
  it("sums planned and actual person days separately", () => {
    const result = calcCapacityEfficiency(sprint(28), entries);
    expect(result.totalPlanned).toBe(16);
    expect(result.totalActual).toBe(14);
  });

  it("computes efficiency on the actual (Ist) person days", () => {
    const result = calcCapacityEfficiency(sprint(28), entries);
    expect(result.efficiency).toBe(2);
  });

  it("returns 0 efficiency when there is no actual capacity (no divide-by-zero)", () => {
    const result = calcCapacityEfficiency(sprint(28), []);
    expect(result.totalPlanned).toBe(0);
    expect(result.totalActual).toBe(0);
    expect(result.efficiency).toBe(0);
  });
});

describe("scaleToSprintLength", () => {
  it("keeps the value for a 10-working-day reference sprint", () => {
    expect(scaleToSprintLength(8, 10)).toBe(8);
  });

  it("scales proportionally to the sprint length, rounded to half days", () => {
    expect(scaleToSprintLength(8, 15)).toBe(12); // 3-Wochen-Sprint
    expect(scaleToSprintLength(8, 5)).toBe(4); // 1-Wochen-Sprint
    expect(scaleToSprintLength(9, 14)).toBe(12.5); // 12,6 -> 12,5
  });

  it("returns the raw default when the sprint length is unknown", () => {
    expect(scaleToSprintLength(8, 0)).toBe(8);
  });
});
