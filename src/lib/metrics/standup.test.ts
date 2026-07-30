import { describe, it, expect } from "vitest";
import { buildStandupGroups, previousWorkingDay, workingDaysInStatus, STALE_AFTER_WORKING_DAYS } from "./standup";
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
    statusSince: null,
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

describe("workingDaysInStatus", () => {
  it("zählt den Wechseltag nicht mit (Wechsel heute = 0)", () => {
    const d = new Date("2026-07-29T10:00:00.000Z"); // Mittwoch
    expect(workingDaysInStatus(d, d)).toBe(0);
  });

  it("überspringt Wochenenden (Freitag -> Montag = 1 Arbeitstag)", () => {
    expect(
      workingDaysInStatus(new Date("2026-07-24T15:00:00.000Z"), new Date("2026-07-27T09:00:00.000Z")),
    ).toBe(1);
  });

  it("Wechsel am Wochenende zählt ab Montag als 0", () => {
    expect(
      workingDaysInStatus(new Date("2026-07-25T12:00:00.000Z"), new Date("2026-07-27T09:00:00.000Z")),
    ).toBe(0);
  });

  it("liefert 6 für Mittwoch -> Donnerstag der Folgewoche (über der Schwelle)", () => {
    const days = workingDaysInStatus(new Date("2026-07-22T08:00:00.000Z"), new Date("2026-07-30T08:00:00.000Z"));
    expect(days).toBe(6);
    expect(days > STALE_AFTER_WORKING_DAYS).toBe(true);
  });

  it("liefert 5 für Mittwoch -> Mittwoch der Folgewoche (noch nicht über der Schwelle)", () => {
    const days = workingDaysInStatus(new Date("2026-07-22T08:00:00.000Z"), new Date("2026-07-29T08:00:00.000Z"));
    expect(days).toBe(5);
    expect(days > STALE_AFTER_WORKING_DAYS).toBe(false);
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

  it("verschiebt Tickets von Nicht-Mitgliedern zu „Ohne Bearbeiter“", () => {
    const groups = buildStandupGroups(
      [
        issue({ jiraKey: "A-1", assignee: "Ben" }),
        issue({ jiraKey: "A-2", assignee: "Externer Dienstleister" }),
        issue({ jiraKey: "A-3", assignee: null }),
      ],
      since,
      ["Ben", "Zoe"],
    );
    expect(groups.map((g) => g.name)).toEqual(["Ben", null]);
    expect(groups[1].openIssues.map((i) => i.jiraKey)).toEqual(["A-2", "A-3"]);
  });

  it("Mitglieder-Abgleich ignoriert Groß-/Kleinschreibung und Leerzeichen", () => {
    const groups = buildStandupGroups(
      [issue({ jiraKey: "A-1", assignee: "Ben Maier" })],
      since,
      ["  ben maier "],
    );
    expect(groups.map((g) => g.name)).toEqual(["Ben Maier"]);
  });

  it("filtert nicht, wenn keine Mitglieder hinterlegt sind", () => {
    const groups = buildStandupGroups([issue({ jiraKey: "A-1", assignee: "Ben" })], since, []);
    expect(groups.map((g) => g.name)).toEqual(["Ben"]);
  });
});
