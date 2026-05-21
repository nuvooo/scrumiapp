import { describe, it, expect } from "vitest";
import { calcVelocityTrend } from "./velocity";
import type { DomainSprint } from "@/lib/domain/types";

function sprint(name: string, committed: number, completed: number): DomainSprint {
  return {
    id: name, name, state: "CLOSED",
    startDate: null, endDate: null, completeDate: null,
    committedPoints: committed, completedPoints: completed,
  };
}

describe("calcVelocityTrend", () => {
  it("maps each sprint to velocity/committed/carriedOver", () => {
    const result = calcVelocityTrend([sprint("S1", 40, 30), sprint("S2", 35, 35)]);
    expect(result.points).toEqual([
      { sprintName: "S1", velocity: 30, committed: 40, carriedOver: 10 },
      { sprintName: "S2", velocity: 35, committed: 35, carriedOver: 0 },
    ]);
  });

  it("computes average velocity", () => {
    const result = calcVelocityTrend([sprint("S1", 0, 20), sprint("S2", 0, 30)]);
    expect(result.average).toBe(25);
  });

  it("detects an upward trend (last > first)", () => {
    const result = calcVelocityTrend([sprint("S1", 0, 20), sprint("S2", 0, 30)]);
    expect(result.trend).toBe("UP");
  });

  it("detects a downward trend (last < first)", () => {
    const result = calcVelocityTrend([sprint("S1", 0, 30), sprint("S2", 0, 20)]);
    expect(result.trend).toBe("DOWN");
  });

  it("returns FLAT for equal endpoints", () => {
    const result = calcVelocityTrend([sprint("S1", 0, 20), sprint("S2", 0, 20)]);
    expect(result.trend).toBe("FLAT");
  });

  it("handles empty input", () => {
    const result = calcVelocityTrend([]);
    expect(result.points).toEqual([]);
    expect(result.average).toBe(0);
    expect(result.trend).toBe("FLAT");
  });
});
