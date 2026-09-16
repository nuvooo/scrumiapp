import { prisma } from "@/lib/db";
import type {
  Roadmap, RoadmapLane, RoadmapBlock, RoadmapItem, RoadmapLabel, RoadmapMilestone,
} from "@prisma/client";

export type RoadmapItemWithLabels = RoadmapItem & { labels: RoadmapLabel[] };
export type RoadmapWithContent = Roadmap & {
  lanes: RoadmapLane[];
  blocks: RoadmapBlock[];
  items: RoadmapItemWithLabels[];
  labels: RoadmapLabel[];
  milestones: RoadmapMilestone[];
};

const contentInclude = {
  lanes: { orderBy: { position: "asc" as const } },
  blocks: { orderBy: { position: "asc" as const } },
  items: { orderBy: { position: "asc" as const }, include: { labels: true } },
  labels: { orderBy: { position: "asc" as const } },
  milestones: { orderBy: { date: "asc" as const } },
};

export function listRoadmaps(teamId: string): Promise<RoadmapWithContent[]> {
  return prisma.roadmap.findMany({
    where: { teamId },
    orderBy: { createdAt: "asc" },
    include: contentInclude,
  });
}

export function getRoadmap(id: string): Promise<RoadmapWithContent | null> {
  return prisma.roadmap.findUnique({ where: { id }, include: contentInclude });
}

/** Standard-Streams einer neuen Roadmap. */
export const DEFAULT_LANES = ["Frontend", "Backend / API", "UX / PO"] as const;

/** Legt die Roadmap mit den Standard-Streams an. */
export function createRoadmap(teamId: string, name: string, startDate: Date, endDate: Date): Promise<Roadmap> {
  return prisma.roadmap.create({
    data: {
      teamId, name, startDate, endDate,
      lanes: { create: DEFAULT_LANES.map((laneName, position) => ({ name: laneName, position })) },
    },
  });
}

export function renameRoadmap(id: string, name: string): Promise<Roadmap> {
  return prisma.roadmap.update({ where: { id }, data: { name } });
}

export function updateRoadmapRange(id: string, startDate: Date, endDate: Date): Promise<Roadmap> {
  return prisma.roadmap.update({ where: { id }, data: { startDate, endDate } });
}

export function deleteRoadmap(id: string): Promise<Roadmap> {
  return prisma.roadmap.delete({ where: { id } });
}

// ---------- Streams (Lanes) ----------

export async function createLane(roadmapId: string, name: string): Promise<RoadmapLane> {
  const max = await prisma.roadmapLane.aggregate({ where: { roadmapId }, _max: { position: true } });
  return prisma.roadmapLane.create({ data: { roadmapId, name, position: (max._max.position ?? -1) + 1 } });
}

export function renameLane(id: string, name: string): Promise<RoadmapLane> {
  return prisma.roadmapLane.update({ where: { id }, data: { name } });
}

/** Tauscht den Stream mit seinem Nachbarn (-1 = nach oben, 1 = nach unten); am Rand No-op. */
export async function moveLane(id: string, direction: -1 | 1): Promise<void> {
  const lane = await prisma.roadmapLane.findUnique({ where: { id } });
  if (!lane) return;
  const neighbor = await prisma.roadmapLane.findFirst({
    where: {
      roadmapId: lane.roadmapId,
      position: direction === -1 ? { lt: lane.position } : { gt: lane.position },
    },
    orderBy: { position: direction === -1 ? "desc" : "asc" },
  });
  if (!neighbor) return;
  await prisma.$transaction([
    prisma.roadmapLane.update({ where: { id: lane.id }, data: { position: neighbor.position } }),
    prisma.roadmapLane.update({ where: { id: neighbor.id }, data: { position: lane.position } }),
  ]);
}

export function deleteLane(id: string): Promise<RoadmapLane> {
  return prisma.roadmapLane.delete({ where: { id } });
}

// ---------- Blöcke ----------

export async function createBlock(
  roadmapId: string,
  name: string,
  parentId: string | null,
  hue: number | null,
): Promise<RoadmapBlock> {
  const max = await prisma.roadmapBlock.aggregate({ where: { roadmapId, parentId }, _max: { position: true } });
  return prisma.roadmapBlock.create({
    data: { roadmapId, name, parentId, hue, position: (max._max.position ?? -1) + 1 },
  });
}

export function updateBlock(id: string, patch: { name?: string; hue?: number | null }): Promise<RoadmapBlock> {
  return prisma.roadmapBlock.update({ where: { id }, data: patch });
}

export type BlockDropPosition = "before" | "after" | "into";

/** Alle Vorfahren-IDs eines Blocks (für den Zyklus-Schutz). */
async function ancestorIds(blockId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  let current: string | null = blockId;
  while (current) {
    const b: { parentId: string | null } | null = await prisma.roadmapBlock.findUnique({
      where: { id: current }, select: { parentId: true },
    });
    current = b?.parentId ?? null;
    if (current) ids.add(current);
  }
  return ids;
}

/**
 * Hängt einen Block um: `target` null = auf die oberste Ebene ans Ende;
 * sonst vor/nach dem Ziel (gleicher Parent) oder als letztes Kind („into").
 * Gibt false zurück, wenn das Ziel im eigenen Teilbaum liegt.
 */
export async function moveBlock(
  id: string,
  targetId: string | null,
  position: BlockDropPosition,
): Promise<boolean> {
  const block = await prisma.roadmapBlock.findUnique({ where: { id } });
  if (!block) return false;
  let newParentId: string | null = null;
  let insertIndex: number | null = null;

  if (targetId !== null) {
    if (targetId === id) return false;
    const target = await prisma.roadmapBlock.findUnique({ where: { id: targetId } });
    if (!target || target.roadmapId !== block.roadmapId) return false;
    if ((await ancestorIds(targetId)).has(id)) return false;
    if (position === "into") {
      newParentId = target.id;
    } else {
      newParentId = target.parentId;
      insertIndex = target.position + (position === "after" ? 1 : 0);
    }
  }

  const siblings = await prisma.roadmapBlock.findMany({
    where: { roadmapId: block.roadmapId, parentId: newParentId, id: { not: id } },
    orderBy: { position: "asc" },
    select: { id: true },
  });
  const order = siblings.map((s) => s.id);
  if (insertIndex === null) order.push(id);
  else {
    // Index bezieht sich auf die alte Reihenfolge inkl. des bewegten Blocks —
    // war er davor selbst ein früheres Geschwister, rutscht der Index um eins.
    const shift = block.parentId === newParentId && block.position < insertIndex ? 1 : 0;
    order.splice(Math.min(Math.max(insertIndex - shift, 0), order.length), 0, id);
  }
  await prisma.$transaction(
    order.map((bid, idx) =>
      prisma.roadmapBlock.update({
        where: { id: bid },
        data: bid === id ? { parentId: newParentId, position: idx } : { position: idx },
      }),
    ),
  );
  return true;
}

/** Löscht den Block samt Unterblöcken; Tickets wandern in den Eingangskorb (SetNull). */
export function deleteBlock(id: string): Promise<RoadmapBlock> {
  return prisma.roadmapBlock.delete({ where: { id } });
}

// ---------- Items ----------

export interface NewRoadmapItem {
  blockId?: string | null;
  jiraKey?: string | null;
  issueType?: string | null;
  title: string;
  description?: string | null;
  startDate: Date;
  endDate: Date;
  statusCategory?: string | null;
  statusLabel?: string | null;
  storyPoints?: number;
  assignee?: string | null;
  blockedBy?: string[];
}

export async function createItem(roadmapId: string, laneId: string, data: NewRoadmapItem): Promise<RoadmapItem> {
  const max = await prisma.roadmapItem.aggregate({ where: { laneId }, _max: { position: true } });
  return prisma.roadmapItem.create({
    data: {
      roadmapId,
      laneId,
      blockId: data.blockId ?? null,
      position: (max._max.position ?? -1) + 1,
      jiraKey: data.jiraKey ?? null,
      issueType: data.issueType ?? null,
      title: data.title,
      description: data.description ?? null,
      startDate: data.startDate,
      endDate: data.endDate,
      statusCategory: data.statusCategory ?? null,
      statusLabel: data.statusLabel ?? null,
      storyPoints: data.storyPoints ?? 0,
      assignee: data.assignee ?? null,
      blockedBy: data.blockedBy ?? [],
    },
  });
}

export interface RoadmapItemPatch {
  laneId?: string;
  blockId?: string | null;
  startDate?: Date;
  endDate?: Date;
  title?: string;
  description?: string | null;
  statusCategory?: string | null;
  statusLabel?: string | null;
  storyPoints?: number;
  assignee?: string | null;
}

export function updateItem(id: string, patch: RoadmapItemPatch): Promise<RoadmapItem> {
  return prisma.roadmapItem.update({ where: { id }, data: patch });
}

/** Verschiebt mehrere Tickets um `deltaDays` (Block-Drag: alle Kinder mit). */
export async function shiftItems(ids: string[], deltaDays: number): Promise<void> {
  if (ids.length === 0 || deltaDays === 0) return;
  const items = await prisma.roadmapItem.findMany({ where: { id: { in: ids } } });
  const ms = deltaDays * 86_400_000;
  await prisma.$transaction(
    items.map((i) =>
      prisma.roadmapItem.update({
        where: { id: i.id },
        data: { startDate: new Date(i.startDate.getTime() + ms), endDate: new Date(i.endDate.getTime() + ms) },
      }),
    ),
  );
}

export function deleteItem(id: string): Promise<RoadmapItem> {
  return prisma.roadmapItem.delete({ where: { id } });
}

export interface RefreshedItemData {
  statusCategory: string;
  statusLabel: string;
  storyPoints: number;
  assignee: string | null;
  blockedBy: string[];
}

/** Status-Batch nach dem Jira-Refresh: Status, SP, Assignee und Abhängigkeiten je Key. */
export async function updateItemStatuses(
  roadmapId: string,
  statusByKey: Map<string, RefreshedItemData>,
): Promise<void> {
  if (statusByKey.size === 0) return;
  await prisma.$transaction(
    [...statusByKey.entries()].map(([jiraKey, data]) =>
      prisma.roadmapItem.updateMany({ where: { roadmapId, jiraKey }, data }),
    ),
  );
}

// ---------- Labels ----------

export async function createLabel(roadmapId: string, name: string, color: string): Promise<RoadmapLabel> {
  const max = await prisma.roadmapLabel.aggregate({ where: { roadmapId }, _max: { position: true } });
  return prisma.roadmapLabel.create({
    data: { roadmapId, name, color, position: (max._max.position ?? -1) + 1 },
  });
}

export function updateLabel(id: string, patch: { name?: string; color?: string }): Promise<RoadmapLabel> {
  return prisma.roadmapLabel.update({ where: { id }, data: patch });
}

export function deleteLabel(id: string): Promise<RoadmapLabel> {
  return prisma.roadmapLabel.delete({ where: { id } });
}

/** Ersetzt die Label-Zuordnung eines Items vollständig. */
export function setItemLabels(itemId: string, labelIds: string[]): Promise<RoadmapItem> {
  return prisma.roadmapItem.update({
    where: { id: itemId },
    data: { labels: { set: labelIds.map((id) => ({ id })) } },
  });
}

// ---------- Meilensteine ----------

export function createMilestone(
  roadmapId: string,
  title: string,
  date: Date,
  color: string,
): Promise<RoadmapMilestone> {
  return prisma.roadmapMilestone.create({ data: { roadmapId, title, date, color } });
}

export function updateMilestone(
  id: string,
  patch: { title?: string; date?: Date; color?: string },
): Promise<RoadmapMilestone> {
  return prisma.roadmapMilestone.update({ where: { id }, data: patch });
}

export function deleteMilestone(id: string): Promise<RoadmapMilestone> {
  return prisma.roadmapMilestone.delete({ where: { id } });
}
