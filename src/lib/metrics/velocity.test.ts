import { describe, it, expect } from "vitest";
import { calcVelocityTrend, type VelocityInput } from "./velocity";
import type { DomainSprint } from "@/lib/domain/types";

function sprint(name: string, committed: number, completed: number): DomainSprint {
  return {
    id: name, name, state: "CLOSED",
    startDate: null, endDate: null, completeDate: null,
    committedPoints: committed, completedPoints: completed,
  };
}

function input(name: string, committed: number, completed: number, planned: number, actual: number): VelocityInput {
  return { sprint: sprint(name, committed, completed), carriedOver: committed - completed, plannedPersonDays: planned, actualPersonDays: actual };
}

describe("calcVelocityTrend", () => {
  it("maps each sprint to velocity/committed/carriedOver and person days", () => {
    const result = calcVelocityTrend([input("S1", 40, 30, 20, 18)]);
    expect(result.points[0]).toMatchObject({
      sprintName: "S1", velocity: 30, committed: 40, carriedOver: 10,
      plannedPersonDays: 20, actualPersonDays: 18,
    });
  });

  it("computes per-row delta and trend against the previous sprint", () => {
    const result = calcVelocityTrend([
      input("S1", 0, 20, 0, 0),
      input("S2", 0, 35, 0, 0),
      input("S3", 0, 25, 0, 0),
    ]);
    expect(result.points.map((p) => p.velocityDelta)).toEqual([0, 15, -10]);
    expect(result.points.map((p) => p.velocityTrend)).toEqual(["FLAT", "UP", "DOWN"]);
  });

  it("computes average and overall trend (first vs last)", () => {
    const result = calcVelocityTrend([input("S1", 0, 20, 0, 0), input("S2", 0, 30, 0, 0)]);
    expect(result.average).toBe(25);
    expect(result.trend).toBe("UP");
  });

  it("handles empty input", () => {
    const result = calcVelocityTrend([]);
    expect(result.points).toEqual([]);
    expect(result.average).toBe(0);
    expect(result.trend).toBe("FLAT");
  });
});
