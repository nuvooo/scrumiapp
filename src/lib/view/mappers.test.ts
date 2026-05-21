import { describe, it, expect } from "vitest";
import { toDomainSprint, toDomainBurndownPoint, toDomainCapacityEntry } from "./mappers";

describe("toDomainSprint", () => {
  it("copies the fields the metrics layer needs", () => {
    const start = new Date("2026-05-18");
    const sprint = toDomainSprint({
      id: "s1", teamId: "t1", jiraSprintId: "100", name: "Sprint 1",
      state: "ACTIVE", startDate: start, endDate: null, completeDate: null,
      committedPoints: 40, completedPoints: 12,
    });
    expect(sprint).toEqual({
      id: "s1", name: "Sprint 1", state: "ACTIVE",
      startDate: start, endDate: null, completeDate: null,
      committedPoints: 40, completedPoints: 12,
    });
  });
});

describe("toDomainBurndownPoint", () => {
  it("maps date and remaining/completed points", () => {
    const date = new Date("2026-05-19");
    const point = toDomainBurndownPoint({ id: "b1", sprintId: "s1", date, remainingPoints: 30, completedPoints: 10 });
    expect(point).toEqual({ date, remainingPoints: 30, completedPoints: 10 });
  });
});

describe("toDomainCapacityEntry", () => {
  it("maps name and personDays", () => {
    const entry = toDomainCapacityEntry({ id: "c1", sprintId: "s1", teamMemberId: null, name: "Alice", personDays: 8 });
    expect(entry).toEqual({ name: "Alice", personDays: 8 });
  });
});
