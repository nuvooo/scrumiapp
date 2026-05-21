import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/app/(app)/settings/teams/actions", () => ({
  createMember: vi.fn(),
  editMember: vi.fn(),
  deleteMember: vi.fn(),
}));

import { TeamMembers } from "./TeamMembers";

describe("TeamMembers", () => {
  it("lists members and offers an add field", () => {
    render(<TeamMembers teamId="t1" members={[{ id: "m1", name: "Alice" }, { id: "m2", name: "Bob" }]} />);
    expect((screen.getByDisplayValue("Alice"))).toBeInTheDocument();
    expect((screen.getByDisplayValue("Bob"))).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Neues Mitglied")).toBeInTheDocument();
  });

  it("shows an empty hint without members", () => {
    render(<TeamMembers teamId="t1" members={[]} />);
    expect(screen.getByText("Noch keine Mitglieder.")).toBeInTheDocument();
  });
});
