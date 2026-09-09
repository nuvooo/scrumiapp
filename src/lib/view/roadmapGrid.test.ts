import { describe, it, expect } from "vitest";
import {
  monthKey, parseMonthKey, addMonths, monthDiff,
  monthColumns, quarterGroups, barGeometry, monthIndexFromOffset,
} from "./roadmapGrid";

describe("monthKey / parseMonthKey", () => {
  it("wandelt Datum in Key und zurück (UTC-Monatserster)", () => {
    expect(monthKey(new Date(Date.UTC(2026, 0, 15)))).toBe("2026-01");
    expect(parseMonthKey("2026-01")).toEqual(new Date(Date.UTC(2026, 0, 1)));
    expect(parseMonthKey("2026-12")).toEqual(new Date(Date.UTC(2026, 11, 1)));
  });
});

describe("addMonths / monthDiff", () => {
  it("rechnet über Jahresgrenzen", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(addMonths("2026-02", -3)).toBe("2025-11");
    expect(monthDiff("2026-01", "2026-01")).toBe(0);
    expect(monthDiff("2026-11", "2027-02")).toBe(3);
    expect(monthDiff("2027-02", "2026-11")).toBe(-3);
  });
});

describe("monthColumns", () => {
  it("liefert eine Spalte pro Monat mit deutschem Label", () => {
    const cols = monthColumns("2026-11", "2027-01");
    expect(cols).toEqual([
      { key: "2026-11", label: "Nov" },
      { key: "2026-12", label: "Dez" },
      { key: "2027-01", label: "Jan" },
    ]);
  });

  it("liefert leeres Array bei verdrehtem Zeitraum", () => {
    expect(monthColumns("2026-05", "2026-04")).toEqual([]);
  });
});

describe("quarterGroups", () => {
  it("gruppiert Monate nach Quartal mit Jahr", () => {
    expect(quarterGroups("2026-02", "2026-07")).toEqual([
      { label: "Q1 2026", span: 2 },
      { label: "Q2 2026", span: 3 },
      { label: "Q3 2026", span: 1 },
    ]);
  });
});

describe("barGeometry", () => {
  // Raster: 2026-01 .. 2026-06 (6 Monate)
  it("platziert einen Balken innerhalb des Rasters", () => {
    expect(barGeometry("2026-01", 6, "2026-02", "2026-04")).toEqual({
      start: 1, span: 3, clippedLeft: false, clippedRight: false,
    });
  });

  it("schneidet Balken am Rand ab und markiert die Seite", () => {
    expect(barGeometry("2026-01", 6, "2025-11", "2026-02")).toEqual({
      start: 0, span: 2, clippedLeft: true, clippedRight: false,
    });
    expect(barGeometry("2026-01", 6, "2026-05", "2026-09")).toEqual({
      start: 4, span: 2, clippedLeft: false, clippedRight: true,
    });
  });

  it("liefert null für Balken komplett außerhalb", () => {
    expect(barGeometry("2026-01", 6, "2025-01", "2025-03")).toBeNull();
    expect(barGeometry("2026-01", 6, "2026-08", "2026-09")).toBeNull();
  });
});

describe("monthIndexFromOffset", () => {
  it("mappt Pixel-Offset auf Monatsindex und klemmt an den Rändern", () => {
    expect(monthIndexFromOffset(0, 56, 6)).toBe(0);
    expect(monthIndexFromOffset(120, 56, 6)).toBe(2);
    expect(monthIndexFromOffset(-30, 56, 6)).toBe(0);
    expect(monthIndexFromOffset(9999, 56, 6)).toBe(5);
    expect(monthIndexFromOffset(100, 0, 6)).toBe(0);
  });
});
