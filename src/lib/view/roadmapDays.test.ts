import { describe, it, expect } from "vitest";
import {
  dayKey, parseDayKey, addDays, dayDiff, isoWeek, formatDay, formatDayShort,
  monthHeaders, weekHeaders, weekOffset, dayIndexFromOffset, isDayKey,
} from "./roadmapDays";

describe("dayKey / parseDayKey / addDays / dayDiff", () => {
  it("wandelt Datum in Key und zurück (UTC-Tag)", () => {
    expect(dayKey(new Date(Date.UTC(2026, 8, 16, 13)))).toBe("2026-09-16");
    expect(parseDayKey("2026-09-16")).toEqual(new Date(Date.UTC(2026, 8, 16)));
    expect(isDayKey("2026-09-16")).toBe(true);
    expect(isDayKey("2026-09")).toBe(false);
  });

  it("rechnet über Monats- und Jahresgrenzen", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(dayDiff("2026-08-31", "2026-09-16")).toBe(16);
    expect(dayDiff("2026-09-16", "2026-08-31")).toBe(-16);
  });
});

describe("isoWeek / format", () => {
  it("liefert ISO-Kalenderwochen", () => {
    expect(isoWeek(new Date(Date.UTC(2026, 0, 1)))).toBe(1);
    expect(isoWeek(new Date(Date.UTC(2026, 8, 16)))).toBe(38);
    expect(isoWeek(new Date(Date.UTC(2027, 0, 3)))).toBe(53);
  });

  it("formatiert deutsch", () => {
    expect(formatDay("2026-09-16")).toBe("16.09.2026");
    expect(formatDayShort("2026-09-01")).toBe("01.09.");
  });
});

describe("monthHeaders", () => {
  it("beschneidet den ersten Monat und markiert Quartalsanfänge", () => {
    const m = monthHeaders("2026-08-31", "2026-10-15");
    expect(m).toEqual([
      { key: "2026-08", label: "Aug 26", start: 0, days: 1, quarterStart: false },
      { key: "2026-09", label: "Sep 26", start: 1, days: 30, quarterStart: false },
      { key: "2026-10", label: "Q4 · Okt 26", start: 31, days: 15, quarterStart: true },
    ]);
  });

  it("ist leer bei leerem Zeitraum", () => {
    expect(monthHeaders("2026-10-15", "2026-10-14")).toEqual([]);
  });
});

describe("weekHeaders", () => {
  it("richtet Wochen an Montagen aus (Start = Montag → Offset 0)", () => {
    expect(weekOffset("2026-08-31")).toBe(0);
    const w = weekHeaders("2026-08-31", "2026-09-20", "m");
    expect(w.slice(0, 2)).toEqual([
      { start: 0, days: 7, label: "36" },
      { start: 7, days: 7, label: "37" },
    ]);
    expect(w.length).toBe(3);
  });

  it("beschneidet die erste Woche bei Start mitten in der Woche", () => {
    expect(weekOffset("2026-09-16")).toBe(-2); // Mittwoch
    const w = weekHeaders("2026-09-16", "2026-09-27", "w");
    expect(w[0]).toEqual({ start: 0, days: 5, label: "KW 38" });
    expect(w[1]).toEqual({ start: 5, days: 7, label: "KW 39" });
  });

  it("zeigt im Quartalszoom 4-Wochen-Sprintpaare", () => {
    const w = weekHeaders("2026-08-31", "2026-10-25", "q");
    expect(w.map((x) => x.label)).toEqual(["S1–2", "S3–4"]);
    expect(w[0].days).toBe(28);
  });
});

describe("dayIndexFromOffset", () => {
  it("rundet ab und klemmt an den Rand", () => {
    expect(dayIndexFromOffset(0, 7.4, 100)).toBe(0);
    expect(dayIndexFromOffset(14.8, 7.4, 100)).toBe(2);
    expect(dayIndexFromOffset(-30, 7.4, 100)).toBe(0);
    expect(dayIndexFromOffset(99999, 7.4, 100)).toBe(99);
    expect(dayIndexFromOffset(10, 0, 100)).toBe(0);
  });
});
