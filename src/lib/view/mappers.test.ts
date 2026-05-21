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
  it("maps date, remaining/completed points and remaining bugs", () => {
    const date = new Date("2026-05-19");
    const point = toDomainBurndownPoint({ id: "b1", sprintId: "s1", date, remainingPoints: 30, completedPoints: 10, remainingBugs: 4, remainingTickets: 7 });
    expect(point).toEqual({ date, remainingPoints: 30, completedPoints: 10, remainingBugs: 4, remainingTickets: 7 });
  });
});

describe("toDomainCapacityEntry", () => {
  it("maps teamMemberId, name and planned/actual person days", () => {
    const entry = toDomainCapacityEntry({ id: "c1", sprintId: "s1", teamMemberId: "m1", name: "Alice", plannedPersonDays: 8, actualPersonDays: 6 });
    expect(entry).toEqual({ teamMemberId: "m1", name: "Alice", plannedPersonDays: 8, actualPersonDays: 6 });
  });
});
