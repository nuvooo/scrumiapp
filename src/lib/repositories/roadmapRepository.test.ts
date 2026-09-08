import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { createTeam } from "./teamRepository";
import {
  listRoadmaps, getRoadmap, createRoadmap, renameRoadmap, updateRoadmapRange, deleteRoadmap,
  createLane, renameLane, moveLane, deleteLane,
  createItem, updateItem, deleteItem, updateItemStatuses,
} from "./roadmapRepository";

const teams: string[] = [];

afterEach(async () => {
  if (teams.length) {
    await prisma.team.deleteMany({ where: { id: { in: teams } } });
    teams.length = 0;
  }
});

async function makeTeam() {
  const team = await createTeam({ name: "Alpha", jiraBoardId: "42" });
  teams.push(team.id);
  return team.id;
}

const jan = new Date(Date.UTC(2026, 0, 1));
const jun = new Date(Date.UTC(2026, 5, 1));

describe("roadmapRepository — Roadmaps", () => {
  it("legt eine Roadmap mit Standard-Bahn 'Allgemein' an", async () => {
    const teamId = await makeTeam();
    const roadmap = await createRoadmap(teamId, "Plattform 2026", jan, jun);

    const loaded = await getRoadmap(roadmap.id);
    expect(loaded?.name).toBe("Plattform 2026");
    expect(loaded?.lanes.map((l) => [l.name, l.position])).toEqual([["Allgemein", 0]]);
  });

  it("listet Roadmaps eines Teams in Anlage-Reihenfolge", async () => {
    const teamId = await makeTeam();
    await createRoadmap(teamId, "A", jan, jun);
    await createRoadmap(teamId, "B", jan, jun);

    expect((await listRoadmaps(teamId)).map((r) => r.name)).toEqual(["A", "B"]);
  });

  it("benennt um, ändert den Zeitraum und löscht mit Inhalt", async () => {
    const teamId = await makeTeam();
    const roadmap = await createRoadmap(teamId, "Alt", jan, jun);
    await renameRoadmap(roadmap.id, "Neu");
    await updateRoadmapRange(roadmap.id, jan, new Date(Date.UTC(2026, 11, 1)));

    const loaded = await getRoadmap(roadmap.id);
    expect(loaded?.name).toBe("Neu");
    expect(loaded?.endMonth).toEqual(new Date(Date.UTC(2026, 11, 1)));

    await deleteRoadmap(roadmap.id);
    expect(await getRoadmap(roadmap.id)).toBeNull();
  });
});

describe("roadmapRepository — Bahnen", () => {
  it("vergibt fortlaufende Positionen und tauscht beim Verschieben", async () => {
    const teamId = await makeTeam();
    const roadmap = await createRoadmap(teamId, "R", jan, jun);
    const b = await createLane(roadmap.id, "B");
    await createLane(roadmap.id, "C");

    // Reihenfolge: Allgemein(0), B(1), C(2) → B hoch: B(0), Allgemein(1), C(2)
    await moveLane(b.id, -1);
    const loaded = await getRoadmap(roadmap.id);
    expect(loaded?.lanes.map((l) => l.name)).toEqual(["B", "Allgemein", "C"]);
  });

  it("moveLane am Rand ist ein No-op", async () => {
    const teamId = await makeTeam();
    const roadmap = await createRoadmap(teamId, "R", jan, jun);
    const first = (await getRoadmap(roadmap.id))!.lanes[0];

    await moveLane(first.id, -1);
    expect((await getRoadmap(roadmap.id))!.lanes[0].id).toBe(first.id);
  });

  it("löscht eine Bahn samt Items (Cascade), umbenennen klappt", async () => {
    const teamId = await makeTeam();
    const roadmap = await createRoadmap(teamId, "R", jan, jun);
    const lane = await createLane(roadmap.id, "Frontend");
    await renameLane(lane.id, "FE");
    await createItem(roadmap.id, lane.id, { title: "Ziel", startMonth: jan, endMonth: jan });

    await deleteLane(lane.id);
    const loaded = await getRoadmap(roadmap.id);
    expect(loaded?.lanes.map((l) => l.name)).toEqual(["Allgemein"]);
    expect(await prisma.roadmapItem.count({ where: { roadmapId: roadmap.id } })).toBe(0);
  });
});

describe("roadmapRepository — Items", () => {
  it("legt Jira-Item und Ziel mit fortlaufender Position an", async () => {
    const teamId = await makeTeam();
    const roadmap = await createRoadmap(teamId, "R", jan, jun);
    const lane = (await getRoadmap(roadmap.id))!.lanes[0];

    await createItem(roadmap.id, lane.id, {
      jiraKey: "AB-1", issueType: "Epic", title: "Login", startMonth: jan, endMonth: jun,
      statusCategory: "indeterminate", statusLabel: "In Arbeit",
    });
    const goal = await createItem(roadmap.id, lane.id, {
      title: "Mobile-App", description: "MVP", startMonth: jan, endMonth: jan,
    });

    expect(goal.jiraKey).toBeNull();
    expect(goal.position).toBe(1);
  });

  it("verschiebt ein Item in eine andere Bahn und ändert den Zeitraum", async () => {
    const teamId = await makeTeam();
    const roadmap = await createRoadmap(teamId, "R", jan, jun);
    const laneA = (await getRoadmap(roadmap.id))!.lanes[0];
    const laneB = await createLane(roadmap.id, "B");
    const item = await createItem(roadmap.id, laneA.id, { title: "Z", startMonth: jan, endMonth: jan });

    await updateItem(item.id, { laneId: laneB.id, startMonth: jun, endMonth: jun });

    const updated = await prisma.roadmapItem.findUnique({ where: { id: item.id } });
    expect(updated?.laneId).toBe(laneB.id);
    expect(updated?.startMonth).toEqual(jun);
  });

  it("löscht ein Item und aktualisiert Status im Batch", async () => {
    const teamId = await makeTeam();
    const roadmap = await createRoadmap(teamId, "R", jan, jun);
    const lane = (await getRoadmap(roadmap.id))!.lanes[0];
    const a = await createItem(roadmap.id, lane.id, { jiraKey: "AB-1", title: "A", startMonth: jan, endMonth: jan });
    const goal = await createItem(roadmap.id, lane.id, { title: "G", startMonth: jan, endMonth: jan });

    await updateItemStatuses(roadmap.id, new Map([
      ["AB-1", { statusCategory: "done", statusLabel: "Fertig" }],
    ]));
    expect((await prisma.roadmapItem.findUnique({ where: { id: a.id } }))?.statusCategory).toBe("done");
    expect((await prisma.roadmapItem.findUnique({ where: { id: goal.id } }))?.statusCategory).toBeNull();

    await deleteItem(a.id);
    expect(await prisma.roadmapItem.count({ where: { roadmapId: roadmap.id } })).toBe(1);
  });
});
