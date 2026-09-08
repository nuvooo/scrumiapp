import { describe, it, expect } from "vitest";
import { stackBars } from "./roadmapStack";

describe("stackBars", () => {
  it("legt nicht überlappende Balken in dieselbe Zeile", () => {
    const result = stackBars([
      { id: "a", start: 0, end: 1, position: 0 },
      { id: "b", start: 2, end: 3, position: 1 },
    ]);
    expect(result.rowById).toEqual({ a: 0, b: 0 });
    expect(result.rowCount).toBe(1);
  });

  it("stapelt überlappende Balken in Unterzeilen (first fit)", () => {
    const result = stackBars([
      { id: "a", start: 0, end: 2, position: 0 },
      { id: "b", start: 1, end: 3, position: 1 },
      { id: "c", start: 3, end: 4, position: 2 },
    ]);
    // c überlappt a nicht (a endet bei 2) → zurück in Zeile 0
    expect(result.rowById).toEqual({ a: 0, b: 1, c: 0 });
    expect(result.rowCount).toBe(2);
  });

  it("respektiert die position-Reihenfolge vor dem Start", () => {
    const result = stackBars([
      { id: "later", start: 0, end: 5, position: 5 },
      { id: "first", start: 0, end: 5, position: 1 },
    ]);
    expect(result.rowById).toEqual({ first: 0, later: 1 });
  });

  it("liefert rowCount 1 für leere Eingabe", () => {
    expect(stackBars([])).toEqual({ rowById: {}, rowCount: 1 });
  });
});
