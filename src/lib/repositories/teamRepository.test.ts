import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { createTeam, listTeams, getTeam } from "./teamRepository";

const created: string[] = [];

afterEach(async () => {
  if (created.length) {
    await prisma.team.deleteMany({ where: { id: { in: created } } });
    created.length = 0;
  }
});

describe("teamRepository", () => {
  it("creates and reads a team", async () => {
    const team = await createTeam({ name: "Alpha", jiraBoardId: "42" });
    created.push(team.id);

    expect(team.name).toBe("Alpha");
    expect(team.jiraBoardId).toBe("42");
    expect(team.syncIntervalMinutes).toBe(60);

    const fetched = await getTeam(team.id);
    expect(fetched?.name).toBe("Alpha");
  });

  it("lists created teams", async () => {
    const team = await createTeam({ name: "Beta", jiraBoardId: "7" });
    created.push(team.id);

    const all = await listTeams();
    expect(all.some((t) => t.id === team.id)).toBe(true);
  });
});
