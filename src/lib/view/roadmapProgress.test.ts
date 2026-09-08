import { describe, it, expect } from "vitest";
import { laneProgress } from "./roadmapProgress";

describe("laneProgress", () => {
  it("summiert Story Points je Statuskategorie", () => {
    const p = laneProgress([
      { storyPoints: 5, statusCategory: "done" },
      { storyPoints: 3, statusCategory: "indeterminate" },
      { storyPoints: 2, statusCategory: "new" },
      { storyPoints: 4, statusCategory: null },
    ]);
    expect(p.done).toBe(5);
    expect(p.inProgress).toBe(3);
    expect(p.open).toBe(6); // new + null
    expect(p.total).toBe(14);
  });

  it("liefert Prozentwerte, die sich zu <= 100 summieren", () => {
    const p = laneProgress([
      { storyPoints: 5, statusCategory: "done" },
      { storyPoints: 5, statusCategory: "new" },
    ]);
    expect(p.donePct).toBe(50);
    expect(p.inProgressPct).toBe(0);
    expect(p.openPct).toBe(50);
  });

  it("behandelt leere Bahn ohne Division durch Null", () => {
    const p = laneProgress([]);
    expect(p).toEqual({
      done: 0, inProgress: 0, open: 0, total: 0,
      donePct: 0, inProgressPct: 0, openPct: 0,
    });
  });

  it("total 0 (alle SP 0) ergibt keine NaN-Prozente", () => {
    const p = laneProgress([{ storyPoints: 0, statusCategory: "done" }]);
    expect(p.total).toBe(0);
    expect(p.donePct).toBe(0);
  });
});
