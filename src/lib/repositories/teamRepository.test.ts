import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { createTeam, listTeams, getTeam, updateTeamSyncStatus, updateTeam, deleteTeam } from "./teamRepository";

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

  it("updates sync status (lastSyncedAt and lastSyncError)", async () => {
    const team = await createTeam({ name: "Sync", jiraBoardId: "1" });
    created.push(team.id);

    const ok = await updateTeamSyncStatus(team.id, { lastSyncedAt: new Date(), lastSyncError: null });
    expect(ok.lastSyncedAt).not.toBeNull();
    expect(ok.lastSyncError).toBeNull();

    const failed = await updateTeamSyncStatus(team.id, { lastSyncError: "boom" });
    expect(failed.lastSyncError).toBe("boom");
    // lastSyncedAt unchanged because it was not provided
    expect(failed.lastSyncedAt).not.toBeNull();
  });

  it("updates name, board, interval and metricsSince", async () => {
    const team = await createTeam({ name: "Old", jiraBoardId: "1" });
    created.push(team.id);

    const since = new Date(Date.UTC(2026, 0, 1));
    const updated = await updateTeam(team.id, {
      name: "New",
      jiraBoardId: "99",
      syncIntervalMinutes: 30,
      metricsSince: since,
    });
    expect(updated.name).toBe("New");
    expect(updated.jiraBoardId).toBe("99");
    expect(updated.syncIntervalMinutes).toBe(30);
    expect(updated.metricsSince?.getTime()).toBe(since.getTime());

    const cleared = await updateTeam(team.id, {
      name: "New",
      jiraBoardId: "99",
      syncIntervalMinutes: 30,
      metricsSince: null,
    });
    expect(cleared.metricsSince).toBeNull();
  });

  it("deletes a team", async () => {
    const team = await createTeam({ name: "Doomed", jiraBoardId: "5" });
    created.push(team.id);
    await deleteTeam(team.id);
    const fetched = await getTeam(team.id);
    expect(fetched).toBeNull();
  });
});
