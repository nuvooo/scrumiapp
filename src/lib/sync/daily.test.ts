import { describe, it, expect } from "vitest";
import {
  parseDailySchedule,
  serializeDailySchedule,
  seriesTime,
  normalizeDailyTime,
  hasDaily,
  isSnapshotMinute,
  snapshotDay,
} from "./daily";

const TZ = "Europe/Berlin";
const monToFri = { dailySchedule: '{"1":"09:30","2":"09:30","3":"09:30","4":"09:30","5":"09:30"}' };

describe("Daily-Zeitplan", () => {
  it("parses valid days and times and drops invalid entries", () => {
    expect(parseDailySchedule('{"1":"9:05","3":"10:00","8":"09:00","2":"25:00"}')).toEqual({ 1: "09:05", 3: "10:00" });
    expect(parseDailySchedule("kaputt")).toEqual({});
    expect(parseDailySchedule("")).toEqual({});
  });

  it("serializes with ascending days", () => {
    expect(serializeDailySchedule({ 3: "10:00", 1: "09:30" })).toBe('{"1":"09:30","3":"10:00"}');
  });

  it("detects a series (same time on all days)", () => {
    expect(seriesTime({ 1: "09:30", 2: "09:30" })).toBe("09:30");
    expect(seriesTime({ 1: "09:30", 2: "10:00" })).toBeNull();
    expect(seriesTime({})).toBeNull();
  });

  it("normalizes valid times and rejects invalid ones", () => {
    expect(normalizeDailyTime("9:05")).toBe("09:05");
    expect(normalizeDailyTime("24:00")).toBeNull();
    expect(normalizeDailyTime("abc")).toBeNull();
  });

  it("needs at least one day with a time", () => {
    expect(hasDaily(monToFri)).toBe(true);
    expect(hasDaily({ dailySchedule: "{}" })).toBe(false);
  });
});

describe("isSnapshotMinute", () => {
  it("fires one minute before the daily on a daily day (Berlin time)", () => {
    // Di 29.09.2026 09:29 in Berlin (Sommerzeit, UTC+2) = 07:29 UTC
    expect(isSnapshotMinute(monToFri, new Date("2026-09-29T07:29:00Z"), TZ)).toBe(true);
    expect(isSnapshotMinute(monToFri, new Date("2026-09-29T07:30:00Z"), TZ)).toBe(false);
    expect(isSnapshotMinute(monToFri, new Date("2026-09-29T07:28:00Z"), TZ)).toBe(false);
  });

  it("uses each day's own time", () => {
    const config = { dailySchedule: '{"1":"09:30","3":"11:00"}' };
    // Mi 30.09. 10:59 Berlin
    expect(isSnapshotMinute(config, new Date("2026-09-30T08:59:00Z"), TZ)).toBe(true);
    // Mi 30.09. 09:29 Berlin — die Montags-Uhrzeit gilt nicht am Mittwoch
    expect(isSnapshotMinute(config, new Date("2026-09-30T07:29:00Z"), TZ)).toBe(false);
  });

  it("does not fire on days without a daily", () => {
    // Sa 03.10.2026 09:29 Berlin
    expect(isSnapshotMinute(monToFri, new Date("2026-10-03T07:29:00Z"), TZ)).toBe(false);
  });

  it("uses the daily's day for a daily at midnight", () => {
    // Daily Mo 00:00 → Snapshot So 23:59 (Berlin) = So 21:59 UTC
    const config = { dailySchedule: '{"1":"00:00"}' };
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
