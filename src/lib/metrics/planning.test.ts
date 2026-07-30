import { describe, it, expect } from "vitest";
import { calcPlanning, type PlanningIssueLike } from "./planning";

const issue = (points: number, over: Partial<PlanningIssueLike> = {}): PlanningIssueLike => ({
  storyPoints: points,
  statusCategory: "TODO",
  onBoard: true,
  ...over,
});

describe("calcPlanning", () => {
  it("summiert nur offene Board-Tickets und zählt unbewertete", () => {
    const result = calcPlanning(
      [
        issue(5),
        issue(3),
        issue(0), // unbewertet
        issue(8, { onBoard: false }), // nicht auf dem Board
        issue(13, { statusCategory: "DONE" }), // Altlast
      ],
      20,
    );
    expect(result.plannedPoints).toBe(8);
    expect(result.unestimatedCount).toBe(1);
  });

  it("verdict ok, wenn eingeplant <= Forecast", () => {
    expect(calcPlanning([issue(20)], 20).verdict).toBe("ok");
    expect(calcPlanning([issue(20)], 20).overBy).toBe(0);
  });

  it("verdict tight bis 10 % über dem Forecast", () => {
    const r = calcPlanning([issue(22)], 20);
    expect(r.verdict).toBe("tight");
    expect(r.overBy).toBe(2);
  });

  it("verdict over darüber", () => {
    const r = calcPlanning([issue(23)], 20);
    expect(r.verdict).toBe("over");
    expect(r.overBy).toBe(3);
  });

  it("ohne Forecast kein Verdict", () => {
    const r = calcPlanning([issue(5)], null);
    expect(r.verdict).toBeNull();
    expect(r.overBy).toBe(0);
  });

  it("rundet overBy auf eine Nachkommastelle", () => {
    const r = calcPlanning([issue(10.55)], 10);
    expect(r.overBy).toBe(0.6);
  });
});
