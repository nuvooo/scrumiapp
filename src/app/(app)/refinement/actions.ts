"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { JiraCloudClient, jiraConfigFromEnv, type JiraSearchResult } from "@/lib/jira/jiraClient";

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

/** Teilnehmer über sein Geräte-Token auflösen; adminOnly schützt Moderations-Aktionen. */
async function requireParticipant(refinementId: string, token: string, adminOnly = false) {
  const participant = await prisma.refinementParticipant.findUnique({ where: { token } });
  if (!participant || participant.refinementId !== refinementId) return null;
  if (adminOnly && !participant.isAdmin) return null;
  return participant;
}

export async function createRefinement(
  teamId: string,
  name: string,
  adminName: string,
): Promise<ActionResult<{ refinementId: string; token: string }>> {
  const trimmedName = name.trim();
  const trimmedAdmin = adminName.trim();
  if (!teamId || !trimmedName || !trimmedAdmin) return fail("Name und eigener Name sind Pflicht.");

  const refinement = await prisma.refinement.create({
    data: {
      teamId,
      name: trimmedName,
      participants: { create: { name: trimmedAdmin, isAdmin: true } },
    },
    include: { participants: true },
  });
  revalidatePath("/refinement");
  return { ok: true, data: { refinementId: refinement.id, token: refinement.participants[0].token } };
}

export async function joinRefinement(
  refinementId: string,
  name: string,
): Promise<ActionResult<{ token: string }>> {
  const trimmed = name.trim();
  if (!trimmed) return fail("Bitte einen Namen angeben.");
  const refinement = await prisma.refinement.findUnique({ where: { id: refinementId } });
  if (!refinement) return fail("Refinement nicht gefunden.");
  if (refinement.state === "DONE") return fail("Dieses Refinement ist abgeschlossen.");

  try {
    const participant = await prisma.refinementParticipant.create({
      data: { refinementId, name: trimmed },
    });
    return { ok: true, data: { token: participant.token } };
  } catch {
    return fail(`Der Name „${trimmed}" ist in dieser Session schon vergeben.`);
  }
}

export async function searchJira(query: string): Promise<ActionResult<JiraSearchResult[]>> {
  if (!query.trim()) return { ok: true, data: [] };
  const client = jiraClient();
  if (!client) return fail("Jira ist nicht konfiguriert.");
  try {
    return { ok: true, data: await client.searchIssues(query) };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Jira-Suche fehlgeschlagen.");
  }
}

export async function addTicket(
  refinementId: string,
  token: string,
  ticket: { jiraKey: string; summary: string; issueType: string; storyPoints: number | null },
): Promise<ActionResult> {
  if (!(await requireParticipant(refinementId, token, true))) return fail("Nur der Admin darf das.");
  const count = await prisma.refinementTicket.count({ where: { refinementId } });
  try {
    await prisma.refinementTicket.create({
      data: {
        refinementId,
        jiraKey: ticket.jiraKey,
        summary: ticket.summary,
        issueType: ticket.issueType,
        previousPoints: ticket.storyPoints,
        position: count,
      },
    });
  } catch {
    return fail(`${ticket.jiraKey} ist schon in der Liste.`);
  }
  return { ok: true };
}

export async function removeTicket(refinementId: string, token: string, ticketId: string): Promise<ActionResult> {
  if (!(await requireParticipant(refinementId, token, true))) return fail("Nur der Admin darf das.");
  await prisma.refinementTicket.deleteMany({ where: { id: ticketId, refinementId } });
  return { ok: true };
}

export async function moveTicket(
  refinementId: string,
  token: string,
  ticketId: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  if (!(await requireParticipant(refinementId, token, true))) return fail("Nur der Admin darf das.");
  const tickets = await prisma.refinementTicket.findMany({
    where: { refinementId },
    orderBy: { position: "asc" },
  });
  const index = tickets.findIndex((t) => t.id === ticketId);
  const other = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || other < 0 || other >= tickets.length) return { ok: true };
  await prisma.$transaction([
    prisma.refinementTicket.update({ where: { id: tickets[index].id }, data: { position: other } }),
    prisma.refinementTicket.update({ where: { id: tickets[other].id }, data: { position: index } }),
  ]);
  return { ok: true };
}

export async function startRefinement(refinementId: string, token: string): Promise<ActionResult> {
  if (!(await requireParticipant(refinementId, token, true))) return fail("Nur der Admin darf das.");
  const count = await prisma.refinementTicket.count({ where: { refinementId } });
  if (count === 0) return fail("Erst Tickets hinzufügen.");
  await prisma.refinement.update({ where: { id: refinementId }, data: { state: "RUNNING" } });
  revalidatePath("/refinement");
  return { ok: true };
}

/** Ticket zur Besprechung wählen: alte Votes verwerfen, Runde beginnt verdeckt. */
export async function selectTicket(refinementId: string, token: string, ticketId: string): Promise<ActionResult> {
  if (!(await requireParticipant(refinementId, token, true))) return fail("Nur der Admin darf das.");
  const ticket = await prisma.refinementTicket.findFirst({ where: { id: ticketId, refinementId } });
  if (!ticket) return fail("Ticket nicht gefunden.");
  await prisma.$transaction([
    prisma.refinementVote.deleteMany({ where: { ticketId } }),
    prisma.refinementTicket.updateMany({
      where: { refinementId, state: { in: ["VOTING", "REVEALED"] } },
      data: { state: "PENDING" },
    }),
    prisma.refinementTicket.update({ where: { id: ticketId }, data: { state: "VOTING" } }),
    prisma.refinement.update({ where: { id: refinementId }, data: { activeTicketId: ticketId } }),
  ]);
  return { ok: true };
}

export async function vote(
  refinementId: string,
  token: string,
  ticketId: string,
  points: number | null,
): Promise<ActionResult> {
  const participant = await requireParticipant(refinementId, token);
  if (!participant) return fail("Nicht Teil dieser Session.");
  const ticket = await prisma.refinementTicket.findFirst({ where: { id: ticketId, refinementId } });
  if (!ticket || ticket.state !== "VOTING") return fail("Gerade keine Abstimmung offen.");
  await prisma.refinementVote.upsert({
    where: { ticketId_participantId: { ticketId, participantId: participant.id } },
    create: { ticketId, participantId: participant.id, points },
    update: { points },
  });
  return { ok: true };
}

export async function revealVotes(refinementId: string, token: string, ticketId: string): Promise<ActionResult> {
  if (!(await requireParticipant(refinementId, token, true))) return fail("Nur der Admin darf das.");
  await prisma.refinementTicket.updateMany({
    where: { id: ticketId, refinementId, state: "VOTING" },
    data: { state: "REVEALED" },
  });
  return { ok: true };
}

/** Schätzung fixieren: erst Jira (führende Quelle), dann lokale Zeilen nachziehen. */
export async function acceptEstimate(
  refinementId: string,
  token: string,
  ticketId: string,
  points: number,
): Promise<ActionResult> {
  if (!(await requireParticipant(refinementId, token, true))) return fail("Nur der Admin darf das.");
  if (!Number.isFinite(points) || points < 0) return fail("Ungültige Schätzung.");
  const ticket = await prisma.refinementTicket.findFirst({ where: { id: ticketId, refinementId } });
  if (!ticket) return fail("Ticket nicht gefunden.");

  const client = jiraClient();
  if (!client) return fail("Jira ist nicht konfiguriert.");
  try {
    await client.setStoryPoints(ticket.jiraKey, points);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Jira-Update fehlgeschlagen.");
  }

  await prisma.$transaction([
    prisma.refinementTicket.update({
      where: { id: ticketId },
      data: { state: "ESTIMATED", finalPoints: points },
    }),
    prisma.refinement.update({ where: { id: refinementId }, data: { activeTicketId: null } }),
    // Das Ticket kann in gesyncten Sprints liegen — Ansichten sofort aktuell halten.
    prisma.issue.updateMany({ where: { jiraKey: ticket.jiraKey }, data: { storyPoints: points } }),
  ]);
  return { ok: true };
}

export async function finishRefinement(refinementId: string, token: string): Promise<ActionResult> {
  if (!(await requireParticipant(refinementId, token, true))) return fail("Nur der Admin darf das.");
  await prisma.refinement.update({
    where: { id: refinementId },
    data: { state: "DONE", activeTicketId: null },
  });
  revalidatePath("/refinement");
  return { ok: true };
}
