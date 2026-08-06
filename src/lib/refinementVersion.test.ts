import { describe, it, expect } from "vitest";
import { bumpRefinement, refinementVersion } from "./refinementVersion";

describe("refinementVersion", () => {
  it("startet bei 0 und zählt pro Änderung hoch", () => {
    expect(refinementVersion("v-r1")).toBe(0);
    bumpRefinement("v-r1");
    expect(refinementVersion("v-r1")).toBe(1);
    bumpRefinement("v-r1");
    expect(refinementVersion("v-r1")).toBe(2);
  });

  it("zählt pro Refinement getrennt", () => {
    bumpRefinement("v-r2");
    expect(refinementVersion("v-r2")).toBe(1);
    expect(refinementVersion("v-r3")).toBe(0);
  });
});
