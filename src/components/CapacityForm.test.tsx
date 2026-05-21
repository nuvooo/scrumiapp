import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Server Action mocked so the client test does not invoke it
vi.mock("@/app/(app)/capacity/actions", () => ({ addCapacity: vi.fn() }));

import { CapacityForm } from "./CapacityForm";

describe("CapacityForm", () => {
  it("renders person and person-days inputs plus the hidden sprintId", () => {
    const { container } = render(<CapacityForm sprintId="s123" />);

    expect(screen.getByPlaceholderText("Name")).toBeInTheDocument();
    expect(screen.getByText("Hinzufügen")).toBeInTheDocument();

    const hidden = container.querySelector('input[name="sprintId"]') as HTMLInputElement;
    expect(hidden.value).toBe("s123");
  });
});
