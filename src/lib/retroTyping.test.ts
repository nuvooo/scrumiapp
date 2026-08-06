import { describe, it, expect, beforeEach } from "vitest";
import { setTyping, activeTyping, clearTyping } from "./retroTyping";

describe("retroTyping", () => {
  beforeEach(() => clearTyping("r1"));

  it("meldet, wer gerade in welcher Spalte schreibt", () => {
    setTyping("r1", "p1", "Ben", "c1", 1000);
    expect(activeTyping("r1", 2000)).toEqual([
      { participantId: "p1", name: "Ben", columnId: "c1", at: 1000 },
    ]);
  });

  it("ein Heartbeat verlängert, Stopp entfernt sofort", () => {
    setTyping("r1", "p1", "Ben", "c1", 1000);
    setTyping("r1", "p1", "Ben", "c1", 5000); // weitergetippt
    expect(activeTyping("r1", 9000)).toHaveLength(1);
    setTyping("r1", "p1", "Ben", null, 9000); // Editor zu
    expect(activeTyping("r1", 9000)).toEqual([]);
  });

  it("nach kurzer Stille verschwindet der Eintrag von selbst", () => {
    setTyping("r1", "p1", "Ben", "c1", 1000);
    expect(activeTyping("r1", 7500)).toEqual([]);
  });
});
