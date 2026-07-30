import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { calcVoteStats } from "@/lib/metrics/refinementVotes";

export const dynamic = "force-dynamic";

/**
 * Leichter Polling-Endpoint für die Refinement-Clients (~2 s Takt).
 * Vote-Werte gehen erst nach dem Aufdecken (REVEALED) raus — vorher nur,
 * wer schon abgestimmt hat.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get("token") ?? "";

  const refinement = await prisma.refinement.findUnique({
    where: { id },
    include: {
      participants: { orderBy: { name: "asc" } },
      tickets: { orderBy: { position: "asc" }, include: { votes: true } },
    },
  });
  if (!refinement) return Response.json({ error: "not found" }, { status: 404 });

  const you = refinement.participants.find((p) => p.token === token) ?? null;

  // Jeder Poll ist ein Heartbeat: wer länger nicht gepollt hat, gilt als
  // abwesend und sitzt nicht am Tisch.
  const now = Date.now();
  if (you) {
    await prisma.refinementParticipant.update({
      where: { id: you.id },
      data: { lastSeenAt: new Date(now) },
    });
  }
  const isOnline = (p: { token: string; lastSeenAt: Date | null }) =>
    p.token === token || (p.lastSeenAt !== null && now - p.lastSeenAt.getTime() < 12_000);

  const active = refinement.activeTicketId
    ? refinement.tickets.find((t) => t.id === refinement.activeTicketId) ?? null
    : null;
  // Auch nach dem Übernehmen (ESTIMATED) bleiben die Karten offen liegen.
  const revealed = active?.state === "REVEALED" || active?.state === "ESTIMATED";
  const nameById = new Map(refinement.participants.map((p) => [p.id, p.name]));
  const jiraBase = (process.env.JIRA_BASE_URL ?? "").replace(/\/$/, "");
  const jiraUrl = (jiraKey: string) => (jiraBase ? `${jiraBase}/browse/${jiraKey}` : null);

  return Response.json({
    id: refinement.id,
    name: refinement.name,
    state: refinement.state,
    you: you ? { name: you.name, isAdmin: you.isAdmin } : null,
    participants: refinement.participants.map((p) => ({
      name: p.name,
      isAdmin: p.isAdmin,
      online: isOnline(p),
      voted: active ? active.votes.some((v) => v.participantId === p.id) : false,
    })),
    tickets: refinement.tickets.map((t) => ({
      id: t.id,
      jiraKey: t.jiraKey,
      summary: t.summary,
      issueType: t.issueType,
      description: t.description,
      url: jiraUrl(t.jiraKey),
      previousPoints: t.previousPoints,
      state: t.state,
      finalPoints: t.finalPoints,
    })),
    activeTicket: active
      ? {
          id: active.id,
          jiraKey: active.jiraKey,
          summary: active.summary,
          issueType: active.issueType,
          description: active.description,
          url: jiraUrl(active.jiraKey),
          previousPoints: active.previousPoints,
          state: active.state,
          myVote: you ? active.votes.find((v) => v.participantId === you.id)?.points ?? undefined : undefined,
          myVoteGiven: you ? active.votes.some((v) => v.participantId === you.id) : false,
          votes: revealed
            ? active.votes.map((v) => ({ name: nameById.get(v.participantId) ?? "?", points: v.points }))
            : null,
          stats: revealed ? calcVoteStats(active.votes.map((v) => v.points)) : null,
        }
      : null,
  });
}
