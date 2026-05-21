import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/app/(app)/capacity/actions", () => ({ upsertCapacity: vi.fn() }));

import { CapacityRoster } from "./CapacityRoster";

describe("CapacityRoster", () => {
  it("renders one Soll/Ist row per member with the hidden sprintId", () => {
    const { container } = render(
      <CapacityRoster
        sprintId="s123"
        rows={[{ teamMemberId: "m1", name: "Alice", plannedPersonDays: 8, actualPersonDays: 6 }]}
      />,
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    const planned = container.querySelector('input[name="plannedPersonDays"]') as HTMLInputElement;
    const actual = container.querySelector('input[name="actualPersonDays"]') as HTMLInputElement;
    expect(planned.value).toBe("8");
    expect(actual.value).toBe("6");
    const hidden = container.querySelector('input[name="sprintId"]') as HTMLInputElement;
    expect(hidden.value).toBe("s123");
  });

  it("shows a hint when the team has no members", () => {
    render(<CapacityRoster sprintId="s1" rows={[]} />);
    expect(screen.getByText(/keine Mitglieder/i)).toBeInTheDocument();
  });
});
