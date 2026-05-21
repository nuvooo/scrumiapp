import { describe, it, expect } from "vitest";
import { resolveTeamId, resolveSprintId } from "./selection";

const teams = [{ id: "t1" }, { id: "t2" }];
const sprints = [
  { id: "s1", state: "CLOSED" as const },
  { id: "s2", state: "ACTIVE" as const },
  { id: "s3", state: "FUTURE" as const },
];

describe("resolveTeamId", () => {
  it("uses the query team when it exists", () => {
    expect(resolveTeamId(teams, "t2")).toBe("t2");
  });
  it("falls back to the first team when query is missing or invalid", () => {
    expect(resolveTeamId(teams, undefined)).toBe("t1");
    expect(resolveTeamId(teams, "nope")).toBe("t1");
  });
  it("returns undefined when there are no teams", () => {
    expect(resolveTeamId([], "t1")).toBeUndefined();
  });
});

describe("resolveSprintId", () => {
  it("uses the query sprint when it exists", () => {
    expect(resolveSprintId(sprints, "s1")).toBe("s1");
  });
  it("prefers the ACTIVE sprint when query is missing", () => {
    expect(resolveSprintId(sprints, undefined)).toBe("s2");
  });
  it("falls back to the last sprint when none is ACTIVE", () => {
    const noActive = [{ id: "s1", state: "CLOSED" as const }, { id: "s2", state: "CLOSED" as const }];
    expect(resolveSprintId(noActive, undefined)).toBe("s2");
  });
  it("returns undefined when there are no sprints", () => {
    expect(resolveSprintId([], undefined)).toBeUndefined();
  });
});
