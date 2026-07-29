import { describe, it, expect } from "vitest";
import { calcCelebration } from "./celebration";

const TODAY = new Date("2026-07-29T09:00:00");

function burndown(entries: [string, number, number][]) {
  return {
    ideal: entries.map(([date, ideal]) => ({ date: new Date(date), remainingTickets: ideal })),
    actual: entries
      .filter(([, , actual]) => actual >= 0)
      .map(([date, , actual]) => ({ date: new Date(date), remainingTickets: actual })),
  };
}

const base = {
  sprintState: "ACTIVE" as const,
  openTickets: 30,
  totalTickets: 60,
  today: TODAY,
};

describe("calcCelebration", () => {
  it("returns confetti when yesterday's actual is on or below the ideal line", () => {
    const ticketBurndown = burndown([
      ["2026-07-27", 60, 60],
      ["2026-07-28", 55, 50], // Vortag: besser als Ideallinie
    ]);
    expect(calcCelebration({ ...base, ticketBurndown })).toBe("confetti");
  });

  it("returns null when yesterday's actual is above the ideal line", () => {
    const ticketBurndown = burndown([
      ["2026-07-27", 60, 60],
      ["2026-07-28", 55, 58], // Vortag: hinter dem Plan
    ]);
    expect(calcCelebration({ ...base, ticketBurndown })).toBeNull();
  });

  it("uses the latest actual point before today (weekend gap)", () => {
    const ticketBurndown = burndown([
      ["2026-07-23", 60, 60], // Baseline (Donnerstag)
      ["2026-07-24", 55, 54], // Freitag, unter der Ideallinie
    ]);
    expect(calcCelebration({ ...base, ticketBurndown, today: new Date("2026-07-27T08:00:00") })).toBe(
      "confetti",
    );
  });

  it("returns null without any actual point before today", () => {
    const ticketBurndown = burndown([["2026-07-29", 60, 60]]); // nur heute
    expect(calcCelebration({ ...base, ticketBurndown })).toBeNull();
  });

  it("does not celebrate the sprint baseline (first snapshot always sits on the ideal line)", () => {
    const ticketBurndown = burndown([["2026-07-28", 60, 60]]); // einziger Punkt = Sprintstart
    expect(calcCelebration({ ...base, ticketBurndown })).toBeNull();
  });

  it("returns fireworks when all tickets are done", () => {
    const ticketBurndown = burndown([["2026-07-28", 55, 0]]);
    expect(calcCelebration({ ...base, ticketBurndown, openTickets: 0 })).toBe("fireworks");
  });

  it("prefers fireworks over confetti", () => {
    const ticketBurndown = burndown([["2026-07-28", 55, 0]]); // Vortag wäre auch confetti
    expect(calcCelebration({ ...base, ticketBurndown, openTickets: 0 })).toBe("fireworks");
  });

  it("returns null for a sprint that never had tickets", () => {
    const ticketBurndown = burndown([]);
    expect(
      calcCelebration({ ...base, ticketBurndown, openTickets: 0, totalTickets: 0 }),
    ).toBeNull();
  });

  it("returns null for non-active sprints", () => {
    const ticketBurndown = burndown([["2026-07-28", 55, 0]]);
    expect(
      calcCelebration({ ...base, ticketBurndown, sprintState: "CLOSED", openTickets: 0 }),
    ).toBeNull();
  });
});
