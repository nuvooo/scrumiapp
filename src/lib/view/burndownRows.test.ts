import { describe, it, expect } from "vitest";
import { mergeBurndownRows } from "./burndownRows";

const d = (s: string) => new Date(s);

describe("mergeBurndownRows", () => {
  it("merges actual values onto the ideal axis by date", () => {
    const rows = mergeBurndownRows(
      [
        { date: d("2026-08-06"), value: 10 },
        { date: d("2026-08-07"), value: 5 },
      ],
      [{ date: d("2026-08-06"), value: 8 }],
    );
    expect(rows).toEqual([
      { label: "06.08.", ideal: 10, actual: 8 },
      { label: "07.08.", ideal: 5, actual: null },
    ]);
  });

  it("keeps rows chronological when actual dates are missing from the ideal axis", () => {
    const rows = mergeBurndownRows(
      [
        { date: d("2026-08-07"), value: 10 },
        { date: d("2026-08-11"), value: 5 },
      ],
      [{ date: d("2026-08-08"), value: 9 }],
    );
    expect(rows.map((r) => r.label)).toEqual(["07.08.", "08.08.", "11.08."]);
    expect(rows[1]).toEqual({ label: "08.08.", ideal: null, actual: 9 });
  });
});
