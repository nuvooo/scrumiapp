import { describe, it, expect } from "vitest";
import { workingDaysBetween } from "./workingDays";

describe("workingDaysBetween", () => {
  it("counts inclusive weekdays Mon-Fri", () => {
    const days = workingDaysBetween(new Date("2026-05-18"), new Date("2026-05-22"));
    expect(days.length).toBe(5);
  });

  it("excludes weekends", () => {
    const days = workingDaysBetween(new Date("2026-05-22"), new Date("2026-05-25"));
    expect(days.length).toBe(2);
  });

  it("returns a single day when start equals end on a weekday", () => {
    const days = workingDaysBetween(new Date("2026-05-20"), new Date("2026-05-20"));
    expect(days.length).toBe(1);
  });

  it("returns empty array when end is before start", () => {
    const days = workingDaysBetween(new Date("2026-05-22"), new Date("2026-05-18"));
    expect(days).toEqual([]);
  });
});
