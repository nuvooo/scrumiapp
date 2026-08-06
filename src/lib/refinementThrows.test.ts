import { describe, it, expect, beforeEach } from "vitest";
import { addThrow, recentThrows, clearThrows } from "./refinementThrows";

describe("refinementThrows", () => {
  beforeEach(() => clearThrows("r1"));

  it("liefert geworfene Emojis für ein Refinement zurück", () => {
    const t = addThrow("r1", "Ben", "Zoe", "🍅", 1000);
    expect(t.id).toBeTruthy();
    expect(recentThrows("r1", 1500)).toEqual([
      { id: t.id, from: "Ben", to: "Zoe", emoji: "🍅", at: 1000 },
    ]);
  });

  it("trennt Refinements voneinander", () => {
    addThrow("r1", "Ben", "Zoe", "🍅", 1000);
    expect(recentThrows("r2", 1000)).toEqual([]);
    clearThrows("r2");
  });

  it("vergisst Würfe nach Ablauf der Lebenszeit", () => {
    addThrow("r1", "Ben", "Zoe", "🍅", 1000);
    addThrow("r1", "Zoe", "Ben", "🥚", 8000);
    expect(recentThrows("r1", 12_500).map((t) => t.emoji)).toEqual(["🥚"]);
  });

  it("behält höchstens die letzten 30 Würfe", () => {
    for (let i = 0; i < 35; i++) addThrow("r1", "Ben", "Zoe", "🍅", 1000 + i);
    expect(recentThrows("r1", 1100)).toHaveLength(30);
    expect(recentThrows("r1", 1100)[0].at).toBe(1005);
  });
});
