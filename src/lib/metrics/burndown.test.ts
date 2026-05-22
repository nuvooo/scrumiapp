import { describe, it, expect } from "vitest";
import { calcBurndown, calcBugBurndown, calcTicketBurndown } from "./burndown";
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
      { date: new Date("2026-05-19"), remainingPoints: 30, completedPoints: 10, remainingBugs: 3, remainingTickets: 0 },
      { date: new Date("2026-05-18"), remainingPoints: 40, completedPoints: 0, remainingBugs: 5, remainingTickets: 0 },
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

describe("calcBugBurndown", () => {
  const points = (vals: Array<[string, number]>): DomainBurndownPoint[] =>
    vals.map(([d, bugs]) => ({ date: new Date(d), remainingPoints: 0, completedPoints: 0, remainingBugs: bugs, remainingTickets: 0 }));

  it("builds an ideal line from the first snapshot's bug count to zero", () => {
    const result = calcBugBurndown(sprint(0, "2026-05-18", "2026-05-22"), points([["2026-05-18", 8]]));
    expect(result.ideal.length).toBe(5);
    expect(result.ideal[0].remainingBugs).toBe(8);
    expect(result.ideal[4].remainingBugs).toBe(0);
    expect(result.ideal[2].remainingBugs).toBe(4);
  });

  it("passes actual bug counts through sorted by date", () => {
    const result = calcBugBurndown(
      sprint(0, "2026-05-18", "2026-05-22"),
      points([["2026-05-20", 3], ["2026-05-18", 5]]),
    );
    expect(result.actual.map((p) => p.remainingBugs)).toEqual([5, 3]);
  });

  it("returns empty lines when there are no snapshots", () => {
    const result = calcBugBurndown(sprint(0, "2026-05-18", "2026-05-22"), []);
    expect(result.ideal).toEqual([]);
    expect(result.actual).toEqual([]);
  });

  it("returns empty lines when the sprint has no dates", () => {
    const s = sprint(0, "2026-05-18", "2026-05-22");
    s.startDate = null;
    expect(calcBugBurndown(s, points([["2026-05-18", 8]]))).toEqual({ ideal: [], actual: [] });
  });
});

describe("calcTicketBurndown", () => {
  const ticketSprint = sprint(0, "2026-05-18", "2026-05-22");
  const ticketPoints = (vals: Array<[string, number]>): DomainBurndownPoint[] =>
    vals.map(([d, t]) => ({ date: new Date(d), remainingPoints: 0, completedPoints: 0, remainingBugs: 0, remainingTickets: t }));

  it("builds an ideal line from the first snapshot's ticket count to zero over the working days", () => {
    const result = calcTicketBurndown(ticketSprint, ticketPoints([["2026-05-18", 8]]));
    expect(result.ideal.length).toBe(5);
    expect(result.ideal[0].remainingTickets).toBe(8);
    expect(result.ideal[4].remainingTickets).toBe(0);
    expect(result.ideal[2].remainingTickets).toBe(4);
  });

  it("passes actual ticket counts through sorted by date", () => {
    const result = calcTicketBurndown(ticketSprint, ticketPoints([["2026-05-20", 6], ["2026-05-18", 10]]));
    expect(result.actual.map((p) => p.remainingTickets)).toEqual([10, 6]);
  });

  it("returns empty lines when there are no snapshots", () => {
    expect(calcTicketBurndown(ticketSprint, [])).toEqual({ ideal: [], actual: [] });
  });

  it("returns empty lines when the sprint has no dates", () => {
    const s = sprint(0, "2026-05-18", "2026-05-22");
    s.startDate = null;
    expect(calcTicketBurndown(s, ticketPoints([["2026-05-18", 8]]))).toEqual({ ideal: [], actual: [] });
  });
});
