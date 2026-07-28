import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/app/(app)/settings/teams/actions", () => ({
  createMember: vi.fn(),
  deleteMember: vi.fn(),
}));

import { TeamMembers } from "./TeamMembers";

describe("TeamMembers", () => {
  it("lists members as chips and offers an add field", () => {
    render(<TeamMembers teamId="t1" members={[{ id: "m1", name: "Alice" }, { id: "m2", name: "Bob" }]} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("2 Personen")).toBeInTheDocument();
    expect(screen.getByLabelText("Alice entfernen")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Name hinzufügen")).toBeInTheDocument();
  });

  it("shows an empty hint without members", () => {
    render(<TeamMembers teamId="t1" members={[]} />);
    expect(screen.getByText("Noch keine Mitglieder.")).toBeInTheDocument();
    expect(screen.getByText("0 Personen")).toBeInTheDocument();
  });
});
