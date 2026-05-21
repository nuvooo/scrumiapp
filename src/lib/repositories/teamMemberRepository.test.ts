import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { createTeam } from "./teamRepository";
import { listMembersForTeam, addMember, renameMember, removeMember } from "./teamMemberRepository";

const teams: string[] = [];

afterEach(async () => {
  if (teams.length) {
    await prisma.team.deleteMany({ where: { id: { in: teams } } });
    teams.length = 0;
  }
});

describe("teamMemberRepository", () => {
  it("adds and lists members alphabetically", async () => {
    const team = await createTeam({ name: "Alpha", jiraBoardId: "1" });
    teams.push(team.id);
    await addMember(team.id, "Bob");
    await addMember(team.id, "Alice");

    const members = await listMembersForTeam(team.id);
    expect(members.map((m) => m.name)).toEqual(["Alice", "Bob"]);
  });

  it("renames a member", async () => {
    const team = await createTeam({ name: "Beta", jiraBoardId: "2" });
    teams.push(team.id);
    const m = await addMember(team.id, "Charlie");

    const renamed = await renameMember(m.id, "Charlotte");
    expect(renamed.name).toBe("Charlotte");
  });

  it("removes a member", async () => {
    const team = await createTeam({ name: "Gamma", jiraBoardId: "3" });
    teams.push(team.id);
    const m = await addMember(team.id, "Dave");

    await removeMember(m.id);
    const members = await listMembersForTeam(team.id);
    expect(members.length).toBe(0);
  });
});
