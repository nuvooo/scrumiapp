import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { createTeam } from "./teamRepository";
import {
  listRoadmaps, getRoadmap, createRoadmap, renameRoadmap, updateRoadmapRange, deleteRoadmap,
  createLane, renameLane, moveLane, deleteLane,
  createBlock, updateBlock, moveBlock, deleteBlock,
  createItem, updateItem, deleteItem, updateItemStatuses, shiftItems,
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

const d = (m: number, day: number) => new Date(Date.UTC(2026, m - 1, day));
const jan = d(1, 1);
const jun = d(6, 30);

async function makeRoadmap() {
  const teamId = await makeTeam();
  const roadmap = await createRoadmap(teamId, "R", jan, jun);
  const lanes = (await getRoadmap(roadmap.id))!.lanes;
  return { teamId, roadmap, lane: lanes[0], lanes };
}

describe("roadmapRepository — Roadmaps", () => {
  it("legt eine Roadmap mit den Standard-Streams an", async () => {
    const teamId = await makeTeam();
    const roadmap = await createRoadmap(teamId, "Plattform 2026", jan, jun);

    const loaded = await getRoadmap(roadmap.id);
    expect(loaded?.name).toBe("Plattform 2026");
    expect(loaded?.lanes.map((l) => [l.name, l.position])).toEqual([
      ["Frontend", 0], ["Backend / API", 1], ["UX / PO", 2],
    ]);
    expect(loaded?.blocks).toEqual([]);
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
    await updateRoadmapRange(roadmap.id, jan, d(12, 31));

    const loaded = await getRoadmap(roadmap.id);
    expect(loaded?.name).toBe("Neu");
    expect(loaded?.endDate).toEqual(d(12, 31));

    await deleteRoadmap(roadmap.id);
    expect(await getRoadmap(roadmap.id)).toBeNull();
  });
});

describe("roadmapRepository — Streams", () => {
  it("vergibt fortlaufende Positionen und tauscht beim Verschieben", async () => {
    const { roadmap } = await makeRoadmap();
    const qa = await createLane(roadmap.id, "QA");
    expect(qa.position).toBe(3);

    await moveLane(qa.id, -1);
    const loaded = await getRoadmap(roadmap.id);
    expect(loaded?.lanes.map((l) => l.name)).toEqual(["Frontend", "Backend / API", "QA", "UX / PO"]);
  });

  it("moveLane am Rand ist ein No-op", async () => {
    const { roadmap, lane } = await makeRoadmap();
    await moveLane(lane.id, -1);
    expect((await getRoadmap(roadmap.id))!.lanes[0].id).toBe(lane.id);
  });

  it("löscht einen Stream samt Tickets (Cascade), umbenennen klappt", async () => {
    const { roadmap } = await makeRoadmap();
    const lane = await createLane(roadmap.id, "QA");
    await renameLane(lane.id, "Test");
    await createItem(roadmap.id, lane.id, { title: "Ziel", startDate: jan, endDate: jan });

    await deleteLane(lane.id);
    const loaded = await getRoadmap(roadmap.id);
    expect(loaded?.lanes.map((l) => l.name)).not.toContain("Test");
    expect(await prisma.roadmapItem.count({ where: { roadmapId: roadmap.id } })).toBe(0);
  });
});

describe("roadmapRepository — Blöcke", () => {
  it("legt Blöcke mit Parent, Farbe und fortlaufender Position an", async () => {
    const { roadmap } = await makeRoadmap();
    const root = await createBlock(roadmap.id, "Headless", null, 212);
    const child = await createBlock(roadmap.id, "Kundencockpit", root.id, null);
    const child2 = await createBlock(roadmap.id, "Shop", root.id, 318);

    expect(root.position).toBe(0);
    expect(child.position).toBe(0);
    expect(child2.position).toBe(1);
    expect(child.parentId).toBe(root.id);

    await updateBlock(child.id, { name: "KC", hue: 262 });
    const loaded = await getRoadmap(roadmap.id);
    expect(loaded?.blocks.find((b) => b.id === child.id)).toMatchObject({ name: "KC", hue: 262 });
  });

  it("hängt Blöcke um: into / before / after / oberste Ebene, mit Zyklus-Schutz", async () => {
    const { roadmap } = await makeRoadmap();
    const a = await createBlock(roadmap.id, "A", null, null);
    const b = await createBlock(roadmap.id, "B", null, null);
    const c = await createBlock(roadmap.id, "C", null, null);
    const a1 = await createBlock(roadmap.id, "A1", a.id, null);

    // C als Kind von A ans Ende
    expect(await moveBlock(c.id, a.id, "into")).toBe(true);
    let blocks = (await getRoadmap(roadmap.id))!.blocks;
    expect(blocks.filter((x) => x.parentId === a.id).map((x) => [x.name, x.position])).toEqual([["A1", 0], ["C", 1]]);
    expect(blocks.filter((x) => x.parentId === null).map((x) => [x.name, x.position])).toEqual([["A", 0], ["B", 1]]);

    // A1 vor B auf die oberste Ebene
    expect(await moveBlock(a1.id, b.id, "before")).toBe(true);
    blocks = (await getRoadmap(roadmap.id))!.blocks;
    expect(blocks.filter((x) => x.parentId === null).map((x) => [x.name, x.position])).toEqual([["A", 0], ["A1", 1], ["B", 2]]);

    // A nach B (gleicher Parent, war früheres Geschwister)
    expect(await moveBlock(a.id, b.id, "after")).toBe(true);
    blocks = (await getRoadmap(roadmap.id))!.blocks;
    expect(blocks.filter((x) => x.parentId === null).map((x) => x.name)).toEqual(["A1", "B", "A"]);

    // C zurück auf die oberste Ebene (Ziel null = ans Ende)
    expect(await moveBlock(c.id, null, "into")).toBe(true);
    blocks = (await getRoadmap(roadmap.id))!.blocks;
    expect(blocks.filter((x) => x.parentId === null).map((x) => x.name)).toEqual(["A1", "B", "A", "C"]);

    // Zyklus-Schutz: A1 zurück in A, dann A in A1 (eigener Teilbaum) und A in sich selbst
    await moveBlock(a1.id, a.id, "into");
    expect(await moveBlock(a.id, a1.id, "into")).toBe(false);
    expect(await moveBlock(a.id, a.id, "into")).toBe(false);
  });

  it("löscht Block samt Unterblöcken; Tickets landen im Eingangskorb", async () => {
    const { roadmap, lane } = await makeRoadmap();
    const root = await createBlock(roadmap.id, "Root", null, null);
    const child = await createBlock(roadmap.id, "Child", root.id, null);
    const item = await createItem(roadmap.id, lane.id, { blockId: child.id, title: "T", startDate: jan, endDate: jan });

    await deleteBlock(root.id);
    const loaded = await getRoadmap(roadmap.id);
    expect(loaded?.blocks).toEqual([]);
    expect(loaded?.items.find((i) => i.id === item.id)?.blockId).toBeNull();
  });
});

describe("roadmapRepository — Items", () => {
  it("legt Jira-Item und Ziel mit fortlaufender Position an", async () => {
    const { roadmap, lane } = await makeRoadmap();
    const block = await createBlock(roadmap.id, "B", null, null);

    const jira = await createItem(roadmap.id, lane.id, {
      blockId: block.id, jiraKey: "AB-1", issueType: "Story", title: "Login", startDate: jan, endDate: d(1, 15),
      statusCategory: "indeterminate", statusLabel: "In Arbeit", blockedBy: ["AB-0"],
    });
    const goal = await createItem(roadmap.id, lane.id, {
      title: "Mobile-App", description: "MVP", startDate: jan, endDate: jan,
    });

    expect(jira.blockId).toBe(block.id);
    expect(jira.blockedBy).toEqual(["AB-0"]);
    expect(goal.jiraKey).toBeNull();
    expect(goal.blockId).toBeNull();
    expect(goal.position).toBe(1);
  });

  it("verschiebt ein Item in Stream/Block und ändert den Zeitraum; shiftItems verschiebt tageweise", async () => {
    const { roadmap, lanes } = await makeRoadmap();
    const block = await createBlock(roadmap.id, "B", null, null);
    const item = await createItem(roadmap.id, lanes[0].id, { title: "Z", startDate: d(1, 10), endDate: d(1, 20) });

    await updateItem(item.id, { laneId: lanes[1].id, blockId: block.id, startDate: d(2, 1), endDate: d(2, 5) });
    let updated = await prisma.roadmapItem.findUnique({ where: { id: item.id } });
    expect(updated?.laneId).toBe(lanes[1].id);
    expect(updated?.blockId).toBe(block.id);
    expect(updated?.startDate).toEqual(d(2, 1));

    await shiftItems([item.id], 3);
    updated = await prisma.roadmapItem.findUnique({ where: { id: item.id } });
    expect(updated?.startDate).toEqual(d(2, 4));
    expect(updated?.endDate).toEqual(d(2, 8));
  });

  it("löscht ein Item und aktualisiert Status/SP/Assignee/Abhängigkeiten im Batch", async () => {
    const { roadmap, lane } = await makeRoadmap();
    const a = await createItem(roadmap.id, lane.id, { jiraKey: "AB-1", title: "A", startDate: jan, endDate: jan, storyPoints: 3 });
    const goal = await createItem(roadmap.id, lane.id, { title: "G", startDate: jan, endDate: jan });

    await updateItemStatuses(roadmap.id, new Map([
      ["AB-1", { statusCategory: "done", statusLabel: "Fertig", storyPoints: 8, assignee: "Alice", blockedBy: ["AB-0"] }],
    ]));
    const updated = await prisma.roadmapItem.findUnique({ where: { id: a.id } });
    expect(updated).toMatchObject({ statusCategory: "done", storyPoints: 8, assignee: "Alice", blockedBy: ["AB-0"] });
    expect((await prisma.roadmapItem.findUnique({ where: { id: goal.id } }))?.statusCategory).toBeNull();

    await deleteItem(a.id);
    expect(await prisma.roadmapItem.count({ where: { roadmapId: roadmap.id } })).toBe(1);
  });
});

describe("roadmapRepository — Labels", () => {
  it("legt Labels an, weist sie Items zu und lädt sie mit", async () => {
    const { roadmap, lane } = await makeRoadmap();
    const item = await createItem(roadmap.id, lane.id, { title: "Z", startDate: jan, endDate: jan });
    const l1 = await createLabel(roadmap.id, "Frontend", "#4c9fc4");
    const l2 = await createLabel(roadmap.id, "Risiko", "#c4574c");

    await setItemLabels(item.id, [l1.id, l2.id]);

    const loaded = await getRoadmap(roadmap.id);
    expect(loaded?.labels.map((l) => [l.name, l.position])).toEqual([["Frontend", 0], ["Risiko", 1]]);
    expect(loaded?.items[0].labels.map((l) => l.name).sort()).toEqual(["Frontend", "Risiko"]);
  });

  it("ändert und löscht ein Label ohne das Item zu löschen; setItemLabels ersetzt", async () => {
    const { roadmap, lane } = await makeRoadmap();
    const item = await createItem(roadmap.id, lane.id, { title: "Z", startDate: jan, endDate: jan });
    const label = await createLabel(roadmap.id, "Alt", "#4c9fc4");
    const other = await createLabel(roadmap.id, "B", "#c4574c");
    await setItemLabels(item.id, [label.id]);
    await setItemLabels(item.id, [other.id]);
    expect((await getRoadmap(roadmap.id))?.items[0].labels.map((l) => l.name)).toEqual(["B"]);

    await updateLabel(label.id, { name: "Neu", color: "#c4574c" });
    await deleteLabel(label.id);
    await deleteLabel(other.id);

    const loaded = await getRoadmap(roadmap.id);
    expect(loaded?.labels).toEqual([]);
    expect(loaded?.items.length).toBe(1);
    expect(loaded?.items[0].labels).toEqual([]);
  });
});

describe("roadmapRepository — Meilensteine", () => {
  it("legt Meilensteine an, ändert und löscht sie (sortiert nach Datum)", async () => {
    const { roadmap } = await makeRoadmap();
    const m = await createMilestone(roadmap.id, "Release 1.0", d(3, 12), "#7C9CFF");
    await createMilestone(roadmap.id, "Früher", d(2, 1), "#7C9CFF");

    let loaded = await getRoadmap(roadmap.id);
    expect(loaded?.milestones.map((x) => x.title)).toEqual(["Früher", "Release 1.0"]);

    await updateMilestone(m.id, { title: "Release 1.1", date: jun });
    loaded = await getRoadmap(roadmap.id);
    expect(loaded?.milestones[1]).toMatchObject({ title: "Release 1.1", date: jun });

    await deleteMilestone(m.id);
    loaded = await getRoadmap(roadmap.id);
    expect(loaded?.milestones.map((x) => x.title)).toEqual(["Früher"]);
  });
});
