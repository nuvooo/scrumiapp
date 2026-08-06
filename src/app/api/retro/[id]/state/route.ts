import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { refinementVersion } from "@/lib/refinementVersion";
import { activeTyping } from "@/lib/retroTyping";

export const dynamic = "force-dynamic";

/** Long-Polling: maximal so lange auf eine Änderung warten (unter dem 12-s-Heartbeat-Limit). */
const WAIT_MS = 8000;
const CHECK_MS = 250;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * State-Endpoint des Retro-Boards. Gleiche Mechanik wie beim Refinement:
 * WebSocket pusht "changed", der Client holt hier den Stand; ohne Socket
 * hält ?v= die Antwort bis zur nächsten Änderung offen (max. 8 s).
 *
 * Im Verdeckt-Modus bleiben Autor und Kommentare fremder Karten zurück —
 * der Text geht mit raus und wird im Client als geblurte Vorschau gezeigt.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const versionKey = `retro:${id}`;

  // Heartbeat sofort setzen — wer im Long-Poll wartet, ist trotzdem anwesend.
  const byToken = token ? await prisma.retroParticipant.findUnique({ where: { token } }) : null;
  const you = byToken && byToken.retroId === id ? byToken : null;
  if (you) {
    await prisma.retroParticipant.update({
      where: { id: you.id },
      data: { lastSeenAt: new Date() },
    });
  }

  const sinceRaw = req.nextUrl.searchParams.get("v");
  const since = sinceRaw === null ? null : Number(sinceRaw);
  if (since !== null && Number.isFinite(since)) {
    const deadline = Date.now() + WAIT_MS;
    while (refinementVersion(versionKey) === since && Date.now() < deadline) {
      await sleep(CHECK_MS);
    }
  }

  const retro = await prisma.retro.findUnique({
    where: { id },
    include: {
      participants: { orderBy: { name: "asc" } },
      columns: {
        orderBy: { position: "asc" },
        include: {
          cards: {
            orderBy: { createdAt: "asc" },
            include: {
              votes: true,
              author: { select: { name: true } },
              comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });
  if (!retro) return Response.json({ error: "not found" }, { status: 404 });

  const now = Date.now();
  const isOnline = (p: { token: string; lastSeenAt: Date | null }) =>
    p.token === token || (p.lastSeenAt !== null && now - p.lastSeenAt.getTime() < 12_000);

  const votesLeft = you
    ? retro.votesPerUser -
      retro.columns.reduce(
        (sum, c) => sum + c.cards.reduce((s, card) => s + card.votes.filter((v) => v.participantId === you.id).length, 0),
        0,
      )
    : 0;

  return Response.json({
    id: retro.id,
    name: retro.name,
    hidden: retro.hidden,
    votesPerUser: retro.votesPerUser,
    votesLeft,
    votingOpen: retro.votingOpen,
    timerRemainingSec: retro.timerEndsAt
      ? Math.max(0, Math.round((retro.timerEndsAt.getTime() - Date.now()) / 1000))
      : null,
    you: you ? { name: you.name, avatar: you.avatar, isAdmin: you.isAdmin } : null,
    participants: retro.participants.map((p) => ({
      name: p.name,
      avatar: p.avatar,
      isAdmin: p.isAdmin,
      online: isOnline(p),
    })),
    columns: retro.columns.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      collapsed: c.collapsed,
      cards: c.cards.map((card) => {
        const mine = you !== null && card.authorId === you.id;
        const covered = retro.hidden && !mine;
        return {
          id: card.id,
          mine,
          covered,
          // Verdeckt = anonym; erst nach dem Aufdecken steht der Name dran.
          author: covered ? "" : card.author.name,
          // Text auch verdeckt mitschicken — der Client blurred ihn als Vorschau.
          text: card.text,
          votes: card.votes.length,
          myVotes: you ? card.votes.filter((v) => v.participantId === you.id).length : 0,
          comments: covered
            ? []
            : card.comments.map((cm) => ({ id: cm.id, author: cm.author.name, text: cm.text })),
        };
      }),
    })),
    // „Schreibt gerade": im Verdeckt-Modus anonym (ohne Namen).
    typing: activeTyping(retro.id).map((t) => ({
      columnId: t.columnId,
      name: retro.hidden ? "" : t.name,
      mine: you !== null && t.participantId === you.id,
    })),
    version: refinementVersion(versionKey),
  });
}
