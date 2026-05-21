import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VelocityTable } from "./VelocityTable";
import type { VelocityPoint } from "@/lib/metrics/velocity";

const points: VelocityPoint[] = [
  { sprintName: "S1", velocity: 20, committed: 25, carriedOver: 5, plannedPersonDays: 20, actualPersonDays: 18, velocityDelta: 0, velocityTrend: "FLAT" },
  { sprintName: "S2", velocity: 30, committed: 30, carriedOver: 0, plannedPersonDays: 20, actualPersonDays: 20, velocityDelta: 10, velocityTrend: "UP" },
];

describe("VelocityTable", () => {
  it("renders a row per sprint with the signed delta and trend marker", () => {
    render(<VelocityTable points={points} />);
    expect(screen.getByText("S1")).toBeInTheDocument();
    expect(screen.getByText("S2")).toBeInTheDocument();
    expect(screen.getByText("+10")).toBeInTheDocument();
    expect(screen.getByText("±0")).toBeInTheDocument();
  });
});
