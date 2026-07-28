import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/app/(app)/settings/teams/actions", () => ({
  editTeam: vi.fn(),
  removeTeam: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { TeamEditor } from "./TeamEditor";

describe("TeamEditor", () => {
  it("prefills the team fields and carries the hidden id", () => {
    const { container } = render(
      <TeamEditor
        team={{ id: "t1", name: "Alpha", jiraBoardId: "42", syncIntervalMinutes: 30 }}
        status={{ text: "noch nicht synchronisiert", tone: "none" }}
      />,
    );
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Alpha");
    expect((screen.getByLabelText("Jira Board-ID") as HTMLInputElement).value).toBe("42");
    expect((screen.getByLabelText("Sync-Intervall (min)") as HTMLInputElement).value).toBe("30");
    const hidden = container.querySelector('input[name="id"]') as HTMLInputElement;
    expect(hidden.value).toBe("t1");
  });

  it("shows the sync status line", () => {
    render(
      <TeamEditor
        team={{ id: "t1", name: "Alpha", jiraBoardId: "42", syncIntervalMinutes: 30 }}
        status={{ text: "Sync-Fehler: 401", tone: "error" }}
      />,
    );
    expect(screen.getByText("Sync-Fehler: 401")).toBeInTheDocument();
  });
});
