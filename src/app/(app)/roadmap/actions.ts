"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { JiraCloudClient, jiraConfigFromEnv, type JiraSearchResult } from "@/lib/jira/jiraClient";
import { parseMonthKey } from "@/lib/view/roadmapGrid";
import {
  createRoadmap, renameRoadmap, updateRoadmapRange, deleteRoadmap,
  createLane, renameLane, moveLane, deleteLane,
  createItem, updateItem, deleteItem, updateItemStatuses,
  createLabel, updateLabel, deleteLabel, setItemLabels,
  createMilestone, updateMilestone, deleteMilestone,
} from "@/lib/repositories/roadmapRepository";

export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

function fail<T>(error: string): ActionResult<T> {
  return { ok: false, error };
}

function jiraClient(): JiraCloudClient | null {
  const config = jiraConfigFromEnv();
  if (!config.baseUrl || !config.email || !config.apiToken) return null;
  return new JiraCloudClient(config);
}

/** "YYYY-MM"-Keys in UTC-Monatserste umwandeln; null bei Unsinn (auch start > end). */
function monthRange(startKey: string, endKey: string): { start: Date; end: Date } | null {
  const start = parseMonthKey(startKey);
  const end = parseMonthKey(endKey);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return null;
  return { start, end };
}

function refresh(roadmapId?: string) {
  revalidatePath("/roadmap");
  if (roadmapId) revalidatePath(`/roadmap/${roadmapId}`);
}

// ---------- Roadmaps ----------

export async function createRoadmapAction(
  teamId: string,
  name: string,
  startKey: string,
  endKey: string,
): Promise<ActionResult<{ id: string }>> {
  const trimmed = name.trim();
  if (!trimmed) return fail("Name fehlt.");
  const range = monthRange(startKey, endKey);
  if (!range) return fail("Ungültiger Zeitraum.");
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return fail("Team nicht gefunden.");

  const roadmap = await createRoadmap(teamId, trimmed, range.start, range.end);
  refresh(roadmap.id);
  return { ok: true, data: { id: roadmap.id } };
}

export async function renameRoadmapAction(roadmapId: string, name: string): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return fail("Name fehlt.");
  await renameRoadmap(roadmapId, trimmed);
  refresh(roadmapId);
  return { ok: true };
}

export async function updateRoadmapRangeAction(
  roadmapId: string,
  startKey: string,
  endKey: string,
): Promise<ActionResult> {
  const range = monthRange(startKey, endKey);
  if (!range) return fail("Ungültiger Zeitraum.");
  await updateRoadmapRange(roadmapId, range.start, range.end);
  refresh(roadmapId);
  return { ok: true };
}

export async function deleteRoadmapAction(roadmapId: string): Promise<ActionResult> {
  await deleteRoadmap(roadmapId);
  refresh();
  return { ok: true };
}

// ---------- Bahnen ----------

export async function createLaneAction(roadmapId: string, name: string): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return fail("Name fehlt.");
  await createLane(roadmapId, trimmed);
  refresh(roadmapId);
  return { ok: true };
}

export async function renameLaneAction(laneId: string, name: string): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return fail("Name fehlt.");
  const lane = await prisma.roadmapLane.findUnique({ where: { id: laneId } });
  if (!lane) return fail("Bahn nicht gefunden.");
  await renameLane(laneId, trimmed);
  refresh(lane.roadmapId);
  return { ok: true };
}

export async function moveLaneAction(laneId: string, direction: -1 | 1): Promise<ActionResult> {
  const lane = await prisma.roadmapLane.findUnique({ where: { id: laneId } });
  if (!lane) return fail("Bahn nicht gefunden.");
  await moveLane(laneId, direction);
  refresh(lane.roadmapId);
  return { ok: true };
}

export async function deleteLaneAction(laneId: string): Promise<ActionResult> {
  const lane = await prisma.roadmapLane.findUnique({ where: { id: laneId } });
  if (!lane) return fail("Bahn nicht gefunden.");
  const laneCount = await prisma.roadmapLane.count({ where: { roadmapId: lane.roadmapId } });
  if (laneCount <= 1) return fail("Die letzte Bahn kann nicht gelöscht werden.");
  await deleteLane(laneId);
  refresh(lane.roadmapId);
  return { ok: true };
}

// ---------- Items ----------

export interface JiraItemInput {
  jiraKey: string;
  title: string;
  issueType: string;
  statusCategory: string | null;
  statusLabel: string | null;
  storyPoints: number;
  assignee: string | null;
}

export async function addJiraItemAction(
  roadmapId: string,
  laneId: string,
  item: JiraItemInput,
  startKey: string,
  endKey: string,
): Promise<ActionResult<{ id: string }>> {
  const range = monthRange(startKey, endKey);
  if (!range) return fail("Ungültiger Zeitraum.");
  const lane = await prisma.roadmapLane.findUnique({ where: { id: laneId } });
  if (!lane || lane.roadmapId !== roadmapId) return fail("Bahn nicht gefunden.");
  const existing = await prisma.roadmapItem.findFirst({ where: { roadmapId, jiraKey: item.jiraKey } });
  if (existing) return fail(`${item.jiraKey} ist bereits auf der Roadmap.`);

  const created = await createItem(roadmapId, laneId, {
    jiraKey: item.jiraKey,
    issueType: item.issueType,
    title: item.title,
    startMonth: range.start,
    endMonth: range.end,
    statusCategory: item.statusCategory,
    statusLabel: item.statusLabel,
    storyPoints: item.storyPoints,
    assignee: item.assignee,
  });
  refresh(roadmapId);
  return { ok: true, data: { id: created.id } };
}

export async function addGoalAction(
  roadmapId: string,
  laneId: string,
  title: string,
  description: string,
  startKey: string,
  endKey: string,
  storyPoints: number,
): Promise<ActionResult<{ id: string }>> {
  const trimmed = title.trim();
  if (!trimmed) return fail("Titel fehlt.");
  const range = monthRange(startKey, endKey);
  if (!range) return fail("Ungültiger Zeitraum.");
  const sp = Number.isFinite(storyPoints) && storyPoints >= 0 ? storyPoints : 0;
  const lane = await prisma.roadmapLane.findUnique({ where: { id: laneId } });
  if (!lane || lane.roadmapId !== roadmapId) return fail("Bahn nicht gefunden.");

  const created = await createItem(roadmapId, laneId, {
    title: trimmed,
    description: description.trim() || null,
    startMonth: range.start,
    endMonth: range.end,
    statusCategory: "new",
    statusLabel: "Offen",
    storyPoints: sp,
  });
  refresh(roadmapId);
  return { ok: true, data: { id: created.id } };
}

export async function moveItemAction(
  itemId: string,
  laneId: string,
  startKey: string,
  endKey: string,
): Promise<ActionResult> {
  const range = monthRange(startKey, endKey);
  if (!range) return fail("Ungültiger Zeitraum.");
  const item = await prisma.roadmapItem.findUnique({ where: { id: itemId } });
  if (!item) return fail("Eintrag nicht gefunden.");
  const lane = await prisma.roadmapLane.findUnique({ where: { id: laneId } });
  if (!lane || lane.roadmapId !== item.roadmapId) return fail("Bahn nicht gefunden.");

  await updateItem(itemId, { laneId, startMonth: range.start, endMonth: range.end });
  refresh(item.roadmapId);
  return { ok: true };
}

const GOAL_STATUS_LABELS: Record<string, string> = {
  new: "Offen",
  indeterminate: "In Arbeit",
  done: "Fertig",
};

export async function updateGoalAction(
  itemId: string,
  title: string,
  description: string,
  statusCategory: "new" | "indeterminate" | "done",
  storyPoints: number,
): Promise<ActionResult> {
  const trimmed = title.trim();
  if (!trimmed) return fail("Titel fehlt.");
  const sp = Number.isFinite(storyPoints) && storyPoints >= 0 ? storyPoints : 0;
  const item = await prisma.roadmapItem.findUnique({ where: { id: itemId } });
  if (!item) return fail("Eintrag nicht gefunden.");
  if (item.jiraKey !== null) return fail("Nur eigene Ziele sind hier bearbeitbar.");

  await updateItem(itemId, {
    title: trimmed,
    description: description.trim() || null,
    statusCategory,
    statusLabel: GOAL_STATUS_LABELS[statusCategory],
    storyPoints: sp,
  });
  refresh(item.roadmapId);
  return { ok: true };
}

export async function deleteItemAction(itemId: string): Promise<ActionResult> {
  const item = await prisma.roadmapItem.findUnique({ where: { id: itemId } });
  if (!item) return fail("Eintrag nicht gefunden.");
  await deleteItem(itemId);
  refresh(item.roadmapId);
  return { ok: true };
}

// ---------- Jira ----------

export async function searchJiraAction(query: string): Promise<ActionResult<JiraSearchResult[]>> {
  const client = jiraClient();
  if (!client) return fail("Jira ist nicht konfiguriert.");
  const text = query.trim();
  if (text.length < 2) return { ok: true, data: [] };
  try {
    return { ok: true, data: await client.searchIssues(text) };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Jira-Suche fehlgeschlagen.");
  }
}

export interface RefreshedStatus {
  jiraKey: string;
  statusCategory: string;
  statusLabel: string;
  storyPoints: number;
  assignee: string | null;
}

/** Frischt die Status aller Jira-Items der Roadmap auf; Fehler → ok:false (Status bleibt stehen). */
export async function refreshStatusesAction(
  roadmapId: string,
): Promise<ActionResult<RefreshedStatus[]>> {
  const client = jiraClient();
  if (!client) return fail("Jira ist nicht konfiguriert.");
  const items = await prisma.roadmapItem.findMany({
    where: { roadmapId, jiraKey: { not: null } },
    select: { jiraKey: true },
  });
  const keys = [...new Set(items.map((i) => i.jiraKey as string))];
  if (keys.length === 0) return { ok: true, data: [] };

  try {
    const statuses = await client.getIssuesByKeys(keys);
    await updateItemStatuses(
      roadmapId,
      new Map(
        statuses.map((s) => [
          s.jiraKey,
          {
            statusCategory: s.statusCategory,
            statusLabel: s.statusLabel,
            storyPoints: s.storyPoints,
            assignee: s.assignee,
          },
        ]),
      ),
    );
    return {
      ok: true,
      data: statuses.map((s) => ({
        jiraKey: s.jiraKey,
        statusCategory: s.statusCategory,
        statusLabel: s.statusLabel,
        storyPoints: s.storyPoints,
        assignee: s.assignee,
      })),
    };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Status-Abfrage fehlgeschlagen.");
  }
}

// ---------- Labels ----------

async function laneRoadmapOfLabel(labelId: string): Promise<string | null> {
  const label = await prisma.roadmapLabel.findUnique({ where: { id: labelId } });
  return label?.roadmapId ?? null;
}

export async function createLabelAction(
  roadmapId: string,
  name: string,
  color: string,
): Promise<ActionResult<{ id: string }>> {
  const trimmed = name.trim();
  if (!trimmed) return fail("Name fehlt.");
  const roadmap = await prisma.roadmap.findUnique({ where: { id: roadmapId } });
  if (!roadmap) return fail("Roadmap nicht gefunden.");
  const created = await createLabel(roadmapId, trimmed, color);
  refresh(roadmapId);
  return { ok: true, data: { id: created.id } };
}

export async function updateLabelAction(
  labelId: string,
  name: string,
  color: string,
): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return fail("Name fehlt.");
  const roadmapId = await laneRoadmapOfLabel(labelId);
  if (!roadmapId) return fail("Label nicht gefunden.");
  await updateLabel(labelId, { name: trimmed, color });
  refresh(roadmapId);
  return { ok: true };
}

export async function deleteLabelAction(labelId: string): Promise<ActionResult> {
  const roadmapId = await laneRoadmapOfLabel(labelId);
  if (!roadmapId) return fail("Label nicht gefunden.");
  await deleteLabel(labelId);
  refresh(roadmapId);
  return { ok: true };
}

export async function setItemLabelsAction(itemId: string, labelIds: string[]): Promise<ActionResult> {
  const item = await prisma.roadmapItem.findUnique({ where: { id: itemId } });
  if (!item) return fail("Eintrag nicht gefunden.");
  const valid = await prisma.roadmapLabel.findMany({
    where: { id: { in: labelIds }, roadmapId: item.roadmapId },
    select: { id: true },
  });
  await setItemLabels(itemId, valid.map((l) => l.id));
  refresh(item.roadmapId);
  return { ok: true };
}

// ---------- Meilensteine ----------

export async function createMilestoneAction(
  roadmapId: string,
  title: string,
  monthKey: string,
  color: string,
): Promise<ActionResult<{ id: string }>> {
  const trimmed = title.trim();
  if (!trimmed) return fail("Titel fehlt.");
  const month = parseMonthKey(monthKey);
  if (Number.isNaN(month.getTime())) return fail("Ungültiger Monat.");
  const roadmap = await prisma.roadmap.findUnique({ where: { id: roadmapId } });
  if (!roadmap) return fail("Roadmap nicht gefunden.");
  const created = await createMilestone(roadmapId, trimmed, month, color);
  refresh(roadmapId);
  return { ok: true, data: { id: created.id } };
}

export async function updateMilestoneAction(
  milestoneId: string,
  title: string,
  monthKey: string,
  color: string,
): Promise<ActionResult> {
  const trimmed = title.trim();
  if (!trimmed) return fail("Titel fehlt.");
  const month = parseMonthKey(monthKey);
  if (Number.isNaN(month.getTime())) return fail("Ungültiger Monat.");
  const milestone = await prisma.roadmapMilestone.findUnique({ where: { id: milestoneId } });
  if (!milestone) return fail("Meilenstein nicht gefunden.");
  await updateMilestone(milestoneId, { title: trimmed, month, color });
  refresh(milestone.roadmapId);
  return { ok: true };
}

export async function deleteMilestoneAction(milestoneId: string): Promise<ActionResult> {
  const milestone = await prisma.roadmapMilestone.findUnique({ where: { id: milestoneId } });
  if (!milestone) return fail("Meilenstein nicht gefunden.");
  await deleteMilestone(milestoneId);
  refresh(milestone.roadmapId);
  return { ok: true };
}
