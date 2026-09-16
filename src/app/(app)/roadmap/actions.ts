"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { JiraCloudClient, jiraConfigFromEnv, type JiraSearchResult } from "@/lib/jira/jiraClient";
import { isDayKey, parseDayKey } from "@/lib/view/roadmapDays";
import {
  createRoadmap, renameRoadmap, updateRoadmapRange, deleteRoadmap,
  createLane, renameLane, moveLane, deleteLane,
  createBlock, updateBlock, moveBlock, deleteBlock, type BlockDropPosition,
  createItem, updateItem, deleteItem, updateItemStatuses, shiftItems,
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

/** "YYYY-MM-DD"-Keys in UTC-Tage umwandeln; null bei Unsinn (auch start > end). */
function dayRange(startKey: string, endKey: string): { start: Date; end: Date } | null {
  if (!isDayKey(startKey) || !isDayKey(endKey)) return null;
  const start = parseDayKey(startKey);
  const end = parseDayKey(endKey);
  if (start > end) return null;
  return { start, end };
}

function parseDay(key: string): Date | null {
  return isDayKey(key) ? parseDayKey(key) : null;
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
  const range = dayRange(startKey, endKey);
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
  const range = dayRange(startKey, endKey);
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

// ---------- Streams ----------

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
  if (!lane) return fail("Stream nicht gefunden.");
  await renameLane(laneId, trimmed);
  refresh(lane.roadmapId);
  return { ok: true };
}

export async function moveLaneAction(laneId: string, direction: -1 | 1): Promise<ActionResult> {
  const lane = await prisma.roadmapLane.findUnique({ where: { id: laneId } });
  if (!lane) return fail("Stream nicht gefunden.");
  await moveLane(laneId, direction);
  refresh(lane.roadmapId);
  return { ok: true };
}

export async function deleteLaneAction(laneId: string): Promise<ActionResult> {
  const lane = await prisma.roadmapLane.findUnique({ where: { id: laneId } });
  if (!lane) return fail("Stream nicht gefunden.");
  const laneCount = await prisma.roadmapLane.count({ where: { roadmapId: lane.roadmapId } });
  if (laneCount <= 1) return fail("Der letzte Stream kann nicht gelöscht werden.");
  await deleteLane(laneId);
  refresh(lane.roadmapId);
  return { ok: true };
}

// ---------- Blöcke ----------

function validHue(hue: number | null): boolean {
  return hue === null || (Number.isInteger(hue) && hue >= 0 && hue < 360);
}

export async function createBlockAction(
  roadmapId: string,
  name: string,
  parentId: string | null,
  hue: number | null,
): Promise<ActionResult<{ id: string }>> {
  const trimmed = name.trim();
  if (!trimmed) return fail("Name fehlt.");
  if (!validHue(hue)) return fail("Ungültige Farbe.");
  const roadmap = await prisma.roadmap.findUnique({ where: { id: roadmapId } });
  if (!roadmap) return fail("Roadmap nicht gefunden.");
  if (parentId) {
    const parent = await prisma.roadmapBlock.findUnique({ where: { id: parentId } });
    if (!parent || parent.roadmapId !== roadmapId) return fail("Übergeordneter Block nicht gefunden.");
  }
  const created = await createBlock(roadmapId, trimmed, parentId, hue);
  refresh(roadmapId);
  return { ok: true, data: { id: created.id } };
}

export async function updateBlockAction(
  blockId: string,
  name: string,
  hue: number | null,
): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return fail("Name fehlt.");
  if (!validHue(hue)) return fail("Ungültige Farbe.");
  const block = await prisma.roadmapBlock.findUnique({ where: { id: blockId } });
  if (!block) return fail("Block nicht gefunden.");
  await updateBlock(blockId, { name: trimmed, hue });
  refresh(block.roadmapId);
  return { ok: true };
}

/** Block umhängen: targetId null = oberste Ebene (ans Ende). */
export async function moveBlockAction(
  blockId: string,
  targetId: string | null,
  position: BlockDropPosition,
): Promise<ActionResult> {
  const block = await prisma.roadmapBlock.findUnique({ where: { id: blockId } });
  if (!block) return fail("Block nicht gefunden.");
  const ok = await moveBlock(blockId, targetId, position);
  if (!ok) return fail("Ein Block kann nicht in seinen eigenen Teilbaum wandern.");
  refresh(block.roadmapId);
  return { ok: true };
}

export async function deleteBlockAction(blockId: string): Promise<ActionResult> {
  const block = await prisma.roadmapBlock.findUnique({ where: { id: blockId } });
  if (!block) return fail("Block nicht gefunden.");
  await deleteBlock(blockId);
  refresh(block.roadmapId);
  return { ok: true };
}

/** Block-Balken ziehen: verschiebt alle Tickets im Teilbaum um `deltaDays`. */
export async function shiftBlockAction(blockId: string, deltaDays: number): Promise<ActionResult> {
  if (!Number.isInteger(deltaDays)) return fail("Ungültige Verschiebung.");
  const block = await prisma.roadmapBlock.findUnique({ where: { id: blockId } });
  if (!block) return fail("Block nicht gefunden.");
  // Teilbaum einsammeln (Breitensuche über parentId)
  const ids = [blockId];
  for (let i = 0; i < ids.length; i++) {
    const children = await prisma.roadmapBlock.findMany({ where: { parentId: ids[i] }, select: { id: true } });
    ids.push(...children.map((c) => c.id));
  }
  const items = await prisma.roadmapItem.findMany({ where: { blockId: { in: ids } }, select: { id: true } });
  await shiftItems(items.map((i) => i.id), deltaDays);
  refresh(block.roadmapId);
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

async function checkBlock(roadmapId: string, blockId: string | null): Promise<string | null> {
  if (blockId === null) return null;
  const block = await prisma.roadmapBlock.findUnique({ where: { id: blockId } });
  return block && block.roadmapId === roadmapId ? null : "Block nicht gefunden.";
}

export async function addJiraItemAction(
  roadmapId: string,
  laneId: string,
  blockId: string | null,
  item: JiraItemInput,
  startKey: string,
  endKey: string,
): Promise<ActionResult<{ id: string }>> {
  const range = dayRange(startKey, endKey);
  if (!range) return fail("Ungültiger Zeitraum.");
  const lane = await prisma.roadmapLane.findUnique({ where: { id: laneId } });
  if (!lane || lane.roadmapId !== roadmapId) return fail("Stream nicht gefunden.");
  const blockError = await checkBlock(roadmapId, blockId);
  if (blockError) return fail(blockError);
  const existing = await prisma.roadmapItem.findFirst({ where: { roadmapId, jiraKey: item.jiraKey } });
  if (existing) return fail(`${item.jiraKey} ist bereits auf der Roadmap.`);

  const created = await createItem(roadmapId, laneId, {
    blockId,
    jiraKey: item.jiraKey,
    issueType: item.issueType,
    title: item.title,
    startDate: range.start,
    endDate: range.end,
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
  blockId: string | null,
  title: string,
  description: string,
  startKey: string,
  endKey: string,
  storyPoints: number,
): Promise<ActionResult<{ id: string }>> {
  const trimmed = title.trim();
  if (!trimmed) return fail("Titel fehlt.");
  const range = dayRange(startKey, endKey);
  if (!range) return fail("Ungültiger Zeitraum.");
  const sp = Number.isFinite(storyPoints) && storyPoints >= 0 ? storyPoints : 0;
  const lane = await prisma.roadmapLane.findUnique({ where: { id: laneId } });
  if (!lane || lane.roadmapId !== roadmapId) return fail("Stream nicht gefunden.");
  const blockError = await checkBlock(roadmapId, blockId);
  if (blockError) return fail(blockError);

  const created = await createItem(roadmapId, laneId, {
    blockId,
    title: trimmed,
    description: description.trim() || null,
    startDate: range.start,
    endDate: range.end,
    statusCategory: "new",
    statusLabel: "Offen",
    storyPoints: sp,
  });
  refresh(roadmapId);
  return { ok: true, data: { id: created.id } };
}

export interface ItemPlacement {
  laneId: string;
  blockId: string | null;
  /** "YYYY-MM-DD" */
  startDate: string;
  endDate: string;
}

/** Zeitraum, Stream und Block eines Eintrags setzen (Drag&Drop und Drawer). */
export async function moveItemAction(itemId: string, placement: ItemPlacement): Promise<ActionResult> {
  const range = dayRange(placement.startDate, placement.endDate);
  if (!range) return fail("Ungültiger Zeitraum.");
  const item = await prisma.roadmapItem.findUnique({ where: { id: itemId } });
  if (!item) return fail("Eintrag nicht gefunden.");
  const lane = await prisma.roadmapLane.findUnique({ where: { id: placement.laneId } });
  if (!lane || lane.roadmapId !== item.roadmapId) return fail("Stream nicht gefunden.");
  const blockError = await checkBlock(item.roadmapId, placement.blockId);
  if (blockError) return fail(blockError);

  await updateItem(itemId, {
    laneId: placement.laneId,
    blockId: placement.blockId,
    startDate: range.start,
    endDate: range.end,
  });
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
  blockedBy: string[];
}

/** Frischt Status, SP, Assignee und Abhängigkeiten aller Jira-Items auf; Fehler → ok:false. */
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
    const data: RefreshedStatus[] = statuses.map((s) => ({
      jiraKey: s.jiraKey,
      statusCategory: s.statusCategory,
      statusLabel: s.statusLabel,
      storyPoints: s.storyPoints,
      assignee: s.assignee,
      blockedBy: s.blockedBy,
    }));
    await updateItemStatuses(
      roadmapId,
      new Map(data.map(({ jiraKey, ...rest }) => [jiraKey, rest])),
    );
    return { ok: true, data };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Status-Abfrage fehlgeschlagen.");
  }
}

// ---------- Labels ----------

async function roadmapOfLabel(labelId: string): Promise<string | null> {
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
  const roadmapId = await roadmapOfLabel(labelId);
  if (!roadmapId) return fail("Label nicht gefunden.");
  await updateLabel(labelId, { name: trimmed, color });
  refresh(roadmapId);
  return { ok: true };
}

export async function deleteLabelAction(labelId: string): Promise<ActionResult> {
  const roadmapId = await roadmapOfLabel(labelId);
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
  dateKey: string,
  color: string,
): Promise<ActionResult<{ id: string }>> {
  const trimmed = title.trim();
  if (!trimmed) return fail("Titel fehlt.");
  const date = parseDay(dateKey);
  if (!date) return fail("Ungültiges Datum.");
  const roadmap = await prisma.roadmap.findUnique({ where: { id: roadmapId } });
  if (!roadmap) return fail("Roadmap nicht gefunden.");
  const created = await createMilestone(roadmapId, trimmed, date, color);
  refresh(roadmapId);
  return { ok: true, data: { id: created.id } };
}

export async function updateMilestoneAction(
  milestoneId: string,
  title: string,
  dateKey: string,
  color: string,
): Promise<ActionResult> {
  const trimmed = title.trim();
  if (!trimmed) return fail("Titel fehlt.");
  const date = parseDay(dateKey);
  if (!date) return fail("Ungültiges Datum.");
  const milestone = await prisma.roadmapMilestone.findUnique({ where: { id: milestoneId } });
  if (!milestone) return fail("Meilenstein nicht gefunden.");
  await updateMilestone(milestoneId, { title: trimmed, date, color });
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
