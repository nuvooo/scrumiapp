import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { VelocityTable, type VelocitySprintRow } from "./VelocityTable";

afterEach(cleanup);

const rows: VelocitySprintRow[] = [
  { sprintId: "s1", name: "S1", state: "CLOSED", committed: 25, completed: 20, plannedPersonDays: 20, forecast: 22 },
  { sprintId: "s2", name: "S2", state: "CLOSED", committed: 30, completed: 30, plannedPersonDays: 20, forecast: 28 },
  { sprintId: "s3", name: "S3", state: "FUTURE", committed: 10, completed: 0, plannedPersonDays: 15, forecast: 18 },
];

describe("VelocityTable", () => {
  it("renders difference, quote and per-sprint forecast", () => {
    render(<VelocityTable rows={rows} teamId="t1" />);
    // S1: 20 von 25 -> −5 SP, 80 %; Prognose 22 SP
    expect(screen.getByText("−5 SP")).toBeInTheDocument();
    expect(screen.getByText("80 %")).toBeInTheDocument();
    expect(screen.getByText("≈ 22 SP")).toBeInTheDocument();
    // S2: punktgenau -> ±0 SP, 100 %
    expect(screen.getByText("±0 SP")).toBeInTheDocument();
    expect(screen.getByText("100 %")).toBeInTheDocument();
  });

  it("shows planned sprints with tag and placeholder values", () => {
    render(<VelocityTable rows={rows} teamId="t1" />);
    expect(screen.getByText("S3")).toBeInTheDocument();
    expect(screen.getByText("geplant")).toBeInTheDocument();
    expect(screen.getByText("≈ 18 SP")).toBeInTheDocument();
    // Abgeschlossen/Differenz/Quote für geplante Sprints leer
    expect(screen.getAllByText("–").length).toBeGreaterThanOrEqual(3);
  });

  it("offers refresh and capacity-edit actions per sprint", () => {
    render(<VelocityTable rows={rows} teamId="t1" />);
    expect(screen.getByLabelText("S3 neu berechnen")).toBeInTheDocument();
    const edit = screen.getByLabelText("Kapazität von S3 anpassen") as HTMLAnchorElement;
    expect(edit.getAttribute("href")).toBe("/capacity?team=t1&sprint=s3");
  });

  it("lists the newest sprint first (planned on top)", () => {
    render(<VelocityTable rows={rows} teamId="t1" />);
    const s3 = screen.getByText("S3");
    const s1 = screen.getByText("S1");
    expect(s3.compareDocumentPosition(s1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
