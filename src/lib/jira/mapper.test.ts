import { describe, it, expect } from "vitest";
import { mapStatusCategory, mapIssue, computeSprintPoints, mapSprintState } from "./mapper";
import type { JiraIssueRaw } from "./types";

const FIELD = "customfield_10016";

function rawIssue(key: string, points: number | null, catKey: "new" | "indeterminate" | "done", resolved: string | null): JiraIssueRaw {
  return {
    key,
    fields: {
      summary: `Issue ${key}`,
      resolutiondate: resolved,
      status: { name: catKey, statusCategory: { key: catKey } },
      [FIELD]: points,
    },
  };
}

describe("mapStatusCategory", () => {
  it("maps Jira category keys to domain categories", () => {
    expect(mapStatusCategory("new")).toBe("TODO");
    expect(mapStatusCategory("indeterminate")).toBe("IN_PROGRESS");
    expect(mapStatusCategory("done")).toBe("DONE");
  });
});

describe("mapSprintState", () => {
  it("uppercases Jira sprint states", () => {
    expect(mapSprintState("active")).toBe("ACTIVE");
    expect(mapSprintState("closed")).toBe("CLOSED");
    expect(mapSprintState("future")).toBe("FUTURE");
  });
});

describe("mapIssue", () => {
  it("maps a raw issue using the configured story points field", () => {
    const issue = mapIssue(rawIssue("AB-1", 5, "done", "2026-05-20T10:00:00.000Z"), FIELD);
    expect(issue.jiraKey).toBe("AB-1");
    expect(issue.storyPoints).toBe(5);
    expect(issue.statusCategory).toBe("DONE");
    expect(issue.resolvedAt).toEqual(new Date("2026-05-20T10:00:00.000Z"));
    expect(issue.addedAfterSprintStart).toBe(false);
  });

  it("treats a missing story points value as 0", () => {
    const issue = mapIssue(rawIssue("AB-2", null, "new", null), FIELD);
    expect(issue.storyPoints).toBe(0);
    expect(issue.resolvedAt).toBeNull();
  });
});

describe("computeSprintPoints", () => {
  it("sums committed (all) and completed (DONE only) story points", () => {
    const issues = [
      mapIssue(rawIssue("AB-1", 5, "done", "2026-05-20T10:00:00.000Z"), FIELD),
      mapIssue(rawIssue("AB-2", 8, "indeterminate", null), FIELD),
      mapIssue(rawIssue("AB-3", 3, "new", null), FIELD),
    ];
    expect(computeSprintPoints(issues)).toEqual({ committedPoints: 16, completedPoints: 5 });
  });

  it("returns zeros for an empty sprint", () => {
    expect(computeSprintPoints([])).toEqual({ committedPoints: 0, completedPoints: 0 });
  });
});
