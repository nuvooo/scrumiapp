import { describe, it, expect } from "vitest";
import { buildStandupGroups, previousWorkingDay } from "./standup";
import type { DomainIssue } from "@/lib/domain/types";

function issue(over: Partial<DomainIssue> & { jiraKey: string }): DomainIssue {
  return {
    summary: over.jiraKey,
    issueType: "Story",
    storyPoints: 0,
    status: "In Arbeit",
    statusCategory: "IN_PROGRESS",
    resolvedAt: null,
    addedAfterSprintStart: false,
    onBoard: true,
    assignee: null,
    ...over,
  };
}

describe("previousWorkingDay", () => {
  it("returns the day before for a mid-week date", () => {
    expect(previousWorkingDay(new Date("2026-07-29T09:00:00")).getDate()).toBe(28); // Mi -> Di
  });

  it("skips the weekend on mondays", () => {
    const d = previousWorkingDay(new Date("2026-07-27T09:00:00")); // Mo -> Fr
    expect(d.getDay()).toBe(5);
    expect(d.getDate()).toBe(24);
  });
});

describe("buildStandupGroups", () => {
  const since = new Date("2026-07-28T00:00:00");

  it("groups open board issues by assignee, alphabetically", () => {
    const groups = buildStandupGroups(
      [
        issue({ jiraKey: "A-1", assignee: "Zoe" }),
        issue({ jiraKey: "A-2", assignee: "Ben" }),
        issue({ jiraKey: "A-3", assignee: "Ben" }),
      ],
      since,
    );
    expect(groups.map((g) => g.name)).toEqual(["Ben", "Zoe"]);
    expect(groups[0].openIssues.map((i) => i.jiraKey)).toEqual(["A-2", "A-3"]);
  });

  it("includes issues resolved since the previous working day as doneIssues", () => {
    const groups = buildStandupGroups(
      [
        issue({ jiraKey: "A-1", assignee: "Ben" }),
        issue({
          jiraKey: "A-2", assignee: "Ben", statusCategory: "DONE", onBoard: false,
          resolvedAt: new Date("2026-07-28T15:00:00"),
        }),
        issue({
          jiraKey: "A-3", assignee: "Ben", statusCategory: "DONE", onBoard: false,
          resolvedAt: new Date("2026-07-20T15:00:00"), // zu alt
        }),
      ],
      since,
    );
    expect(groups[0].doneIssues.map((i) => i.jiraKey)).toEqual(["A-2"]);
  });

  it("puts unassigned tickets into a trailing group", () => {
    const groups = buildStandupGroups(
      [issue({ jiraKey: "A-1", assignee: "Ben" }), issue({ jiraKey: "A-2", assignee: null })],
      since,
    );
    expect(groups.map((g) => g.name)).toEqual(["Ben", null]);
  });

  it("omits off-board open issues and people without any relevant ticket", () => {
    const groups = buildStandupGroups(
      [issue({ jiraKey: "A-1", assignee: "Ben", onBoard: false })], // z. B. Abnahme STAGE
      since,
    );
    expect(groups).toEqual([]);
  });
});
