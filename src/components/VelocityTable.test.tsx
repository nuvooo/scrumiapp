import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

afterEach(cleanup);
import { VelocityTable } from "./VelocityTable";
import type { VelocityPoint } from "@/lib/metrics/velocity";

const points: VelocityPoint[] = [
  { sprintName: "S1", velocity: 20, committed: 25, carriedOver: 5, plannedPersonDays: 20, actualPersonDays: 18, velocityDelta: 0, velocityTrend: "FLAT" },
  { sprintName: "S2", velocity: 30, committed: 30, carriedOver: 0, plannedPersonDays: 20, actualPersonDays: 20, velocityDelta: 10, velocityTrend: "UP" },
];

describe("VelocityTable", () => {
  it("renders a row per sprint with signed difference and completion quote", () => {
    render(<VelocityTable points={points} />);
    expect(screen.getByText("S1")).toBeInTheDocument();
    expect(screen.getByText("S2")).toBeInTheDocument();
    // S1: 20 abgeschlossen von 25 committed -> −5 SP, 80 %
    expect(screen.getByText("−5 SP")).toBeInTheDocument();
    expect(screen.getByText("80 %")).toBeInTheDocument();
    // S2: punktgenau -> ±0 SP, 100 %
    expect(screen.getByText("±0 SP")).toBeInTheDocument();
    expect(screen.getByText("100 %")).toBeInTheDocument();
  });

  it("lists the newest sprint first", () => {
    render(<VelocityTable points={points} />);
    const s1 = screen.getByText("S1");
    const s2 = screen.getByText("S2");
    expect(s2.compareDocumentPosition(s1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
