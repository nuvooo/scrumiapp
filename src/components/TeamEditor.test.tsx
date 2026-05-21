import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/app/(app)/settings/teams/actions", () => ({
  editTeam: vi.fn(),
  removeTeam: vi.fn(),
}));

import { TeamEditor } from "./TeamEditor";

describe("TeamEditor", () => {
  it("prefills the team fields and carries the hidden id", () => {
    const { container } = render(
      <TeamEditor team={{ id: "t1", name: "Alpha", jiraBoardId: "42", syncIntervalMinutes: 30 }} />,
    );
    expect((screen.getByLabelText("Teamname") as HTMLInputElement).value).toBe("Alpha");
    expect((screen.getByLabelText("Jira Board-ID") as HTMLInputElement).value).toBe("42");
    const hidden = container.querySelector('input[name="id"]') as HTMLInputElement;
    expect(hidden.value).toBe("t1");
  });
});
