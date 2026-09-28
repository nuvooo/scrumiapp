import { describe, it, expect } from "vitest";
import { parseDailyDays, normalizeDailyTime, hasDaily, isSnapshotMinute, snapshotDay } from "./daily";

const TZ = "Europe/Berlin";
const monToFri = { dailyDays: "1,2,3,4,5", dailyTime: "09:30" };

describe("parseDailyDays / normalizeDailyTime", () => {
  it("parses, dedupes and sorts ISO weekdays", () => {
    expect(parseDailyDays("5, 1,3,3,9,x")).toEqual([1, 3, 5]);
    expect(parseDailyDays("")).toEqual([]);
  });

  it("normalizes valid times and rejects invalid ones", () => {
    expect(normalizeDailyTime("9:05")).toBe("09:05");
    expect(normalizeDailyTime("24:00")).toBeNull();
    expect(normalizeDailyTime("abc")).toBeNull();
  });

  it("needs a time and at least one day", () => {
    expect(hasDaily(monToFri)).toBe(true);
    expect(hasDaily({ dailyDays: "", dailyTime: "09:30" })).toBe(false);
    expect(hasDaily({ dailyDays: "1", dailyTime: null })).toBe(false);
  });
});

describe("isSnapshotMinute", () => {
  it("fires one minute before the daily on a daily day (Berlin time)", () => {
    // Di 29.09.2026 09:29 in Berlin (Sommerzeit, UTC+2) = 07:29 UTC
    expect(isSnapshotMinute(monToFri, new Date("2026-09-29T07:29:00Z"), TZ)).toBe(true);
    expect(isSnapshotMinute(monToFri, new Date("2026-09-29T07:30:00Z"), TZ)).toBe(false);
    expect(isSnapshotMinute(monToFri, new Date("2026-09-29T07:28:00Z"), TZ)).toBe(false);
  });

  it("does not fire on days without a daily", () => {
    // Sa 03.10.2026 09:29 Berlin
    expect(isSnapshotMinute(monToFri, new Date("2026-10-03T07:29:00Z"), TZ)).toBe(false);
  });

  it("uses the daily's day for a daily at midnight", () => {
    // Daily Mo 00:00 → Snapshot So 23:59 (Berlin) = So 21:59 UTC
    const config = { dailyDays: "1", dailyTime: "00:00" };
    expect(isSnapshotMinute(config, new Date("2026-09-27T21:59:00Z"), TZ)).toBe(true);
  });
});

describe("snapshotDay", () => {
  it("stores the snapshot as the previous working day", () => {
    // Di 29.09. → Mo 28.09.
    expect(snapshotDay(new Date("2026-09-29T07:29:00Z"), null, TZ)).toEqual(new Date("2026-09-28T00:00:00Z"));
    // Mo 28.09. → Fr 25.09.
    expect(snapshotDay(new Date("2026-09-28T07:29:00Z"), null, TZ)).toEqual(new Date("2026-09-25T00:00:00Z"));
  });

  it("clamps to the sprint start for the first daily", () => {
    const start = new Date("2026-09-28T08:00:00Z");
    expect(snapshotDay(new Date("2026-09-28T07:29:00Z"), start, TZ)).toEqual(new Date("2026-09-28T00:00:00Z"));
  });
});
