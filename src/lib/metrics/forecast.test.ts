import { describe, it, expect } from "vitest";
import { calcForecast } from "./forecast";

describe("calcForecast", () => {
  it("pools efficiency across sprints and scales by planned days", () => {
    const result = calcForecast(
      [
        { velocity: 40, actualPersonDays: 40 }, // 1,0 SP/PT
        { velocity: 30, actualPersonDays: 20 }, // 1,5 SP/PT
      ],
      30,
    );
    // gepoolt: 70 SP / 60 PT = 1,1667 SP/PT
    expect(result?.efficiency).toBeCloseTo(70 / 60);
    expect(result?.possiblePoints).toBeCloseTo((70 / 60) * 30);
    expect(result?.basedOnSprints).toBe(2);
  });

  it("ignores sprints without actual person days", () => {
    const result = calcForecast(
      [
        { velocity: 40, actualPersonDays: 0 },
        { velocity: 20, actualPersonDays: 10 },
      ],
      10,
    );
    expect(result?.efficiency).toBe(2);
    expect(result?.basedOnSprints).toBe(1);
  });

  it("returns null without usable history", () => {
    expect(calcForecast([], 10)).toBeNull();
    expect(calcForecast([{ velocity: 10, actualPersonDays: 0 }], 10)).toBeNull();
  });
});
