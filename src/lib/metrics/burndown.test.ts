import { describe, it, expect } from "vitest";
import { calcBurndown } from "./burndown";
import type { DomainSprint, DomainBurndownPoint } from "@/lib/domain/types";

function sprint(committed: number, start: string, end: string): DomainSprint {
  return {
    id: "s1", name: "Sprint 1", state: "ACTIVE",
    startDate: new Date(start), endDate: new Date(end), completeDate: null,
    committedPoints: committed, completedPoints: 0,
  };
}

describe("calcBurndown", () => {
  it("builds an ideal line from committed points to zero over working days", () => {
    const result = calcBurndown(sprint(40, "2026-05-18", "2026-05-22"), []);
    expect(result.ideal.length).toBe(5);
    expect(result.ideal[0].remainingPoints).toBe(40);
    expect(result.ideal[4].remainingPoints).toBe(0);
    expect(result.ideal[2].remainingPoints).toBe(20);
  });

  it("passes actual points through sorted by date", () => {
    const points: DomainBurndownPoint[] = [
      { date: new Date("2026-05-19"), remainingPoints: 30, completedPoints: 10 },
      { date: new Date("2026-05-18"), remainingPoints: 40, completedPoints: 0 },
    ];
    const result = calcBurndown(sprint(40, "2026-05-18", "2026-05-22"), points);
    expect(result.actual.map((p) => p.remainingPoints)).toEqual([40, 30]);
  });

  it("returns empty lines when sprint has no dates", () => {
    const s = sprint(40, "2026-05-18", "2026-05-22");
    s.startDate = null;
    const result = calcBurndown(s, []);
    expect(result.ideal).toEqual([]);
    expect(result.actual).toEqual([]);
  });

  it("handles a single-day sprint without dividing by zero", () => {
    const result = calcBurndown(sprint(40, "2026-05-20", "2026-05-20"), []);
    expect(result.ideal.length).toBe(1);
    expect(result.ideal[0].remainingPoints).toBe(0);
  });
});
