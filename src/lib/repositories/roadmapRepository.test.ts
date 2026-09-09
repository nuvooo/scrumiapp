import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { createTeam } from "./teamRepository";
import {
  listRoadmaps, getRoadmap, createRoadmap, renameRoadmap, updateRoadmapRange, deleteRoadmap,
  createLane, renameLane, moveLane, deleteLane,
  createItem, updateItem, deleteItem, updateItemStatuses,
  createLabel, updateLabel, deleteLabel, setItemLabels,
  createMilestone, updateMilestone, deleteMilestone,
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
      ["AB-1", { statusCategory: "done", statusLabel: "Fertig", storyPoints: 0, assignee: null }],
    ]));
    expect((await prisma.roadmapItem.findUnique({ where: { id: a.id } }))?.statusCategory).toBe("done");
    expect((await prisma.roadmapItem.findUnique({ where: { id: goal.id } }))?.statusCategory).toBeNull();

    await deleteItem(a.id);
    expect(await prisma.roadmapItem.count({ where: { roadmapId: roadmap.id } })).toBe(1);
  });
});

describe("roadmapRepository — Labels", () => {
  it("legt Labels an, weist sie Items zu und lädt sie mit", async () => {
    const teamId = await makeTeam();
    const roadmap = await createRoadmap(teamId, "R", jan, jun);
    const lane = (await getRoadmap(roadmap.id))!.lanes[0];
    const item = await createItem(roadmap.id, lane.id, { title: "Z", startMonth: jan, endMonth: jan });
    const l1 = await createLabel(roadmap.id, "Frontend", "#4c9fc4");
    const l2 = await createLabel(roadmap.id, "Risiko", "#c4574c");

    await setItemLabels(item.id, [l1.id, l2.id]);

    const loaded = await getRoadmap(roadmap.id);
    expect(loaded?.labels.map((l) => [l.name, l.position])).toEqual([
      ["Frontend", 0],
      ["Risiko", 1],
    ]);
    const loadedItem = loaded?.lanes[0].items[0];
    expect(loadedItem?.labels.map((l) => l.name).sort()).toEqual(["Frontend", "Risiko"]);
  });

  it("ändert und löscht ein Label ohne das Item zu löschen", async () => {
    const teamId = await makeTeam();
    const roadmap = await createRoadmap(teamId, "R", jan, jun);
    const lane = (await getRoadmap(roadmap.id))!.lanes[0];
    const item = await createItem(roadmap.id, lane.id, { title: "Z", startMonth: jan, endMonth: jan });
    const label = await createLabel(roadmap.id, "Alt", "#4c9fc4");
    await setItemLabels(item.id, [label.id]);

    await updateLabel(label.id, { name: "Neu", color: "#c4574c" });
    await deleteLabel(label.id);

    const loaded = await getRoadmap(roadmap.id);
    expect(loaded?.labels).toEqual([]);
    expect(loaded?.lanes[0].items.length).toBe(1);
    expect(loaded?.lanes[0].items[0].labels).toEqual([]);
  });

  it("setItemLabels ersetzt die Zuordnung", async () => {
    const teamId = await makeTeam();
    const roadmap = await createRoadmap(teamId, "R", jan, jun);
    const lane = (await getRoadmap(roadmap.id))!.lanes[0];
    const item = await createItem(roadmap.id, lane.id, { title: "Z", startMonth: jan, endMonth: jan });
    const l1 = await createLabel(roadmap.id, "A", "#4c9fc4");
    const l2 = await createLabel(roadmap.id, "B", "#c4574c");
    await setItemLabels(item.id, [l1.id]);

    await setItemLabels(item.id, [l2.id]);

    const loaded = await getRoadmap(roadmap.id);
    expect(loaded?.lanes[0].items[0].labels.map((l) => l.name)).toEqual(["B"]);
  });
});

describe("roadmapRepository — Meilensteine", () => {
  it("legt Meilensteine an, ändert und löscht sie", async () => {
    const teamId = await makeTeam();
    const roadmap = await createRoadmap(teamId, "R", jan, jun);
    const m = await createMilestone(roadmap.id, "Release 1.0", jan, "#7C9CFF");

    let loaded = await getRoadmap(roadmap.id);
    expect(loaded?.milestones.map((x) => x.title)).toEqual(["Release 1.0"]);

    await updateMilestone(m.id, { title: "Release 1.1", month: jun });
    loaded = await getRoadmap(roadmap.id);
    expect(loaded?.milestones[0].title).toBe("Release 1.1");
    expect(loaded?.milestones[0].month).toEqual(jun);

    await deleteMilestone(m.id);
    loaded = await getRoadmap(roadmap.id);
    expect(loaded?.milestones).toEqual([]);
  });
});

describe("roadmapRepository — Story Points & Assignee", () => {
  it("speichert SP/Assignee am Item und aktualisiert sie im Status-Batch", async () => {
    const teamId = await makeTeam();
    const roadmap = await createRoadmap(teamId, "R", jan, jun);
    const lane = (await getRoadmap(roadmap.id))!.lanes[0];
    const item = await createItem(roadmap.id, lane.id, {
      jiraKey: "AB-1", title: "T", startMonth: jan, endMonth: jan, storyPoints: 3, assignee: "Bob",
    });
    expect(item.storyPoints).toBe(3);
    expect(item.assignee).toBe("Bob");

    await updateItemStatuses(roadmap.id, new Map([
      ["AB-1", { statusCategory: "done", statusLabel: "Fertig", storyPoints: 8, assignee: "Alice" }],
    ]));

    const updated = await prisma.roadmapItem.findUnique({ where: { id: item.id } });
    expect(updated?.storyPoints).toBe(8);
    expect(updated?.assignee).toBe("Alice");
    expect(updated?.statusCategory).toBe("done");
  });
});
