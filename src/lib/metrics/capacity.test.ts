import { describe, it, expect } from "vitest";
import { calcCapacityEfficiency } from "./capacity";
import type { DomainSprint, DomainCapacityEntry } from "@/lib/domain/types";

function sprint(completed: number): DomainSprint {
  return {
    id: "s1", name: "Sprint 1", state: "CLOSED",
    startDate: null, endDate: null, completeDate: null,
    committedPoints: 0, completedPoints: completed,
  };
}

const entries: DomainCapacityEntry[] = [
  { name: "Alice", personDays: 8 },
  { name: "Bob", personDays: 8 },
];

describe("calcCapacityEfficiency", () => {
  it("sums person days", () => {
    const result = calcCapacityEfficiency(sprint(32), entries);
    expect(result.totalPersonDays).toBe(16);
  });

  it("computes story points per person day", () => {
    const result = calcCapacityEfficiency(sprint(32), entries);
    expect(result.efficiency).toBe(2);
  });

  it("returns 0 efficiency when there is no capacity (no divide-by-zero)", () => {
    const result = calcCapacityEfficiency(sprint(32), []);
    expect(result.totalPersonDays).toBe(0);
    expect(result.efficiency).toBe(0);
  });
});
