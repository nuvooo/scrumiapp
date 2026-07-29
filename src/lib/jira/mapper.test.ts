import { describe, it, expect } from "vitest";
import { mapStatusCategory, mapIssue, computeSprintPoints, mapSprintState, countOpenBugs, countOpenTickets } from "./mapper";
import type { JiraIssueRaw } from "./types";

const FIELD = "customfield_10016";

function rawIssue(
  key: string,
  points: number | null,
  catKey: "new" | "indeterminate" | "done",
  resolved: string | null,
  issueTypeName = "Story",
): JiraIssueRaw {
  return {
    key,
    fields: {
      summary: `Issue ${key}`,
      resolutiondate: resolved,
      status: { name: catKey, statusCategory: { key: catKey } },
      issuetype: { name: issueTypeName },
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
    expect(issue.summary).toBe("Issue AB-1");
    expect(issue.storyPoints).toBe(5);
    expect(issue.status).toBe("done");
    expect(issue.statusCategory).toBe("DONE");
    expect(issue.resolvedAt).toEqual(new Date("2026-05-20T10:00:00.000Z"));
    expect(issue.addedAfterSprintStart).toBe(false);
  });

  it("treats a missing story points value as 0", () => {
    const issue = mapIssue(rawIssue("AB-2", null, "new", null), FIELD);
    expect(issue.storyPoints).toBe(0);
    expect(issue.resolvedAt).toBeNull();
  });

  it("captures the Jira issue type name", () => {
    const issue = mapIssue(rawIssue("AB-9", 0, "new", null, "Bug"), FIELD);
    expect(issue.issueType).toBe("Bug");
  });

  it("falls back to empty string when issue type is missing", () => {
    const raw = rawIssue("AB-10", 0, "new", null);
    delete raw.fields.issuetype;
    expect(mapIssue(raw, FIELD).issueType).toBe("");
  });
});

describe("computeSprintPoints", () => {
  const window = { start: new Date("2026-05-18"), end: new Date("2026-05-29") };

  it("counts completed only for issues resolved within the sprint window", () => {
    const issues = [
      mapIssue(rawIssue("AB-1", 5, "done", "2026-05-20T10:00:00.000Z"), FIELD), // im Zeitraum
      mapIssue(rawIssue("AB-2", 13, "done", "2026-01-01T10:00:00.000Z"), FIELD), // Altlast -> zählt nicht
      mapIssue(rawIssue("AB-3", 8, "indeterminate", null), FIELD), // offen auf Board
      mapIssue(rawIssue("AB-4", 3, "new", null), FIELD),           // offen auf Board
    ];
    expect(computeSprintPoints(issues, window)).toEqual({ committedPoints: 16, completedPoints: 5 });
  });

  it("ignores open issues that are not visible on the board", () => {
    const issues = [
      mapIssue(rawIssue("AB-1", 8, "new", null), FIELD, false), // z. B. Abnahme STAGE
      mapIssue(rawIssue("AB-2", 3, "new", null), FIELD),
    ];
    expect(computeSprintPoints(issues, window)).toEqual({ committedPoints: 3, completedPoints: 0 });
  });

  it("counts nothing as completed when the sprint has no start date", () => {
    const issues = [mapIssue(rawIssue("AB-1", 5, "done", "2026-05-20T10:00:00.000Z"), FIELD)];
    expect(computeSprintPoints(issues, { start: null, end: null })).toEqual({
      committedPoints: 0,
      completedPoints: 0,
    });
  });

  it("has no upper bound when the sprint has no end date yet", () => {
    const issues = [mapIssue(rawIssue("AB-1", 5, "done", "2026-06-10T10:00:00.000Z"), FIELD)];
    expect(computeSprintPoints(issues, { start: new Date("2026-05-18"), end: null })).toEqual({
      committedPoints: 5,
      completedPoints: 5,
    });
  });

  it("returns zeros for an empty sprint", () => {
    expect(computeSprintPoints([], window)).toEqual({ committedPoints: 0, completedPoints: 0 });
  });
});

describe("countOpenBugs", () => {
  const bugTypes = new Set(["bug", "fehler"]);
  const issue = (type: string, cat: "new" | "indeterminate" | "done") =>
    mapIssue(rawIssue(`X-${type}-${cat}`, 0, cat, null, type), FIELD);

  it("counts only non-DONE issues whose type is a configured bug type", () => {
    const issues = [
      issue("Bug", "new"),          // open bug -> counts
      issue("Fehler", "indeterminate"), // open bug -> counts
      issue("Bug", "done"),         // resolved bug -> excluded
      issue("Story", "new"),        // not a bug -> excluded
    ];
    expect(countOpenBugs(issues, bugTypes)).toBe(2);
  });

  it("ignores bugs that are not visible on the board", () => {
    const offBoard = mapIssue(rawIssue("X-off", 0, "new", null, "Bug"), FIELD, false);
    expect(countOpenBugs([offBoard], bugTypes)).toBe(0);
  });

  it("matches bug types case-insensitively", () => {
    expect(countOpenBugs([issue("BUG", "new")], bugTypes)).toBe(1);
  });

  it("returns 0 for an empty list", () => {
    expect(countOpenBugs([], bugTypes)).toBe(0);
  });
});

describe("countOpenTickets", () => {
  const bugTypes = new Set(["bug", "fehler"]);

  it("counts non-done, non-bug issues that are visible on the board", () => {
    const issues = [
      mapIssue(rawIssue("A-1", 5, "done", null, "Story"), FIELD),
      mapIssue(rawIssue("A-2", 3, "indeterminate", null, "Story"), FIELD),
      mapIssue(rawIssue("A-3", 0, "new", null, "Task"), FIELD),
      mapIssue(rawIssue("A-4", 0, "new", null, "Bug"), FIELD), // Bug -> zählt nicht als Ticket
      mapIssue(rawIssue("A-5", 0, "new", null, "Story"), FIELD, false), // nicht auf dem Board
    ];
    expect(countOpenTickets(issues, bugTypes)).toBe(2);
  });

  it("returns 0 when everything is done", () => {
    expect(countOpenTickets([mapIssue(rawIssue("A-1", 5, "done", null), FIELD)], bugTypes)).toBe(0);
  });
});
