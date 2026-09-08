import { prisma } from "@/lib/db";
import type { Roadmap, RoadmapLane, RoadmapItem } from "@prisma/client";

export type RoadmapWithContent = Roadmap & {
  lanes: (RoadmapLane & { items: RoadmapItem[] })[];
};

const contentInclude = {
  lanes: {
    orderBy: { position: "asc" as const },
    include: { items: { orderBy: { position: "asc" as const } } },
  },
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

/** Legt die Roadmap mit einer Standard-Bahn „Allgemein" an. */
export function createRoadmap(teamId: string, name: string, startMonth: Date, endMonth: Date): Promise<Roadmap> {
  return prisma.roadmap.create({
    data: { teamId, name, startMonth, endMonth, lanes: { create: { name: "Allgemein", position: 0 } } },
  });
}

export function renameRoadmap(id: string, name: string): Promise<Roadmap> {
  return prisma.roadmap.update({ where: { id }, data: { name } });
}

export function updateRoadmapRange(id: string, startMonth: Date, endMonth: Date): Promise<Roadmap> {
  return prisma.roadmap.update({ where: { id }, data: { startMonth, endMonth } });
}

export function deleteRoadmap(id: string): Promise<Roadmap> {
  return prisma.roadmap.delete({ where: { id } });
}

export async function createLane(roadmapId: string, name: string): Promise<RoadmapLane> {
  const max = await prisma.roadmapLane.aggregate({ where: { roadmapId }, _max: { position: true } });
  return prisma.roadmapLane.create({ data: { roadmapId, name, position: (max._max.position ?? -1) + 1 } });
}

export function renameLane(id: string, name: string): Promise<RoadmapLane> {
  return prisma.roadmapLane.update({ where: { id }, data: { name } });
}

/** Tauscht die Bahn mit ihrem Nachbarn (-1 = nach oben, 1 = nach unten); am Rand No-op. */
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

export interface NewRoadmapItem {
  jiraKey?: string | null;
  issueType?: string | null;
  title: string;
  description?: string | null;
  startMonth: Date;
  endMonth: Date;
  statusCategory?: string | null;
  statusLabel?: string | null;
}

export async function createItem(roadmapId: string, laneId: string, data: NewRoadmapItem): Promise<RoadmapItem> {
  const max = await prisma.roadmapItem.aggregate({ where: { laneId }, _max: { position: true } });
  return prisma.roadmapItem.create({
    data: {
      roadmapId,
      laneId,
      position: (max._max.position ?? -1) + 1,
      jiraKey: data.jiraKey ?? null,
      issueType: data.issueType ?? null,
      title: data.title,
      description: data.description ?? null,
      startMonth: data.startMonth,
      endMonth: data.endMonth,
      statusCategory: data.statusCategory ?? null,
      statusLabel: data.statusLabel ?? null,
    },
  });
}

export interface RoadmapItemPatch {
  laneId?: string;
  startMonth?: Date;
  endMonth?: Date;
  title?: string;
  description?: string | null;
  statusCategory?: string | null;
  statusLabel?: string | null;
}

export function updateItem(id: string, patch: RoadmapItemPatch): Promise<RoadmapItem> {
  return prisma.roadmapItem.update({ where: { id }, data: patch });
}

export function deleteItem(id: string): Promise<RoadmapItem> {
  return prisma.roadmapItem.delete({ where: { id } });
}

/** Status-Batch nach dem Jira-Refresh: aktualisiert alle Items der Roadmap je Key. */
export async function updateItemStatuses(
  roadmapId: string,
  statusByKey: Map<string, { statusCategory: string; statusLabel: string }>,
): Promise<void> {
  if (statusByKey.size === 0) return;
  await prisma.$transaction(
    [...statusByKey.entries()].map(([jiraKey, status]) =>
      prisma.roadmapItem.updateMany({ where: { roadmapId, jiraKey }, data: status }),
    ),
  );
}
