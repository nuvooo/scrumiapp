"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { bumpRefinement } from "@/lib/refinementVersion";
import { setTyping } from "@/lib/retroTyping";
import { AVATAR_EMOJIS } from "@/lib/view/refinementState";
import { RETRO_COLORS, RETRO_TEMPLATES } from "@/lib/view/retroState";

export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

function fail<T>(error: string): ActionResult<T> {
  return { ok: false, error };
}

/** Versionszähler + WebSocket-Push für den Retro-Raum (eigener Key-Namensraum). */
function bumpRetro(retroId: string): void {
  bumpRefinement(`retro:${retroId}`);
}

/** Teilnehmer über sein Geräte-Token auflösen; adminOnly schützt Moderations-Aktionen. */
async function requireParticipant(retroId: string, token: string, adminOnly = false) {
  const participant = await prisma.retroParticipant.findUnique({ where: { token } });
  if (!participant || participant.retroId !== retroId) return null;
  if (adminOnly && !participant.isAdmin) return null;
  return participant;
}

export interface GifResult {
  /** URL fürs Einfügen in die Karte (fixed_height, endet auf .gif). */
  url: string;
  /** Kleines Vorschaubild fürs Auswahlraster. */
  preview: string;
}

/**
 * GIF-Suche über die Giphy-API — als Server-Proxy, damit der API-Key
 * (GIPHY_API_KEY in .env) nie im Browser landet. Ohne Suchbegriff kommen
 * die aktuellen Trending-GIFs.
 */
export async function searchGifs(query: string): Promise<ActionResult<GifResult[]>> {
  const key = (process.env.GIPHY_API_KEY ?? "").trim();
  if (!key) return fail("Kein GIPHY_API_KEY konfiguriert.");
  const q = query.trim();
  const endpoint = q
    ? `https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(q)}&limit=24&rating=g&lang=de`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${key}&limit=24&rating=g`;
  try {
    const res = await fetch(endpoint, { cache: "no-store" });
    if (!res.ok) return fail(`Giphy antwortet nicht (HTTP ${res.status}).`);
    const payload = (await res.json()) as {
      data: { images: { fixed_height: { url: string }; fixed_height_small: { url: string } } }[];
    };
    return {
      ok: true,
      data: payload.data.map((g) => ({
        url: g.images.fixed_height.url,
        preview: g.images.fixed_height_small.url,
      })),
    };
  } catch {
    return fail("Giphy ist nicht erreichbar.");
  }
}

export async function createRetro(
  teamId: string,
  name: string,
  adminName: string,
  templateKey: string,
  votesPerUser: number,
  adminAvatar = "",
): Promise<ActionResult<{ retroId: string; token: string }>> {
  const trimmedName = name.trim();
  const trimmedAdmin = adminName.trim();
  if (!teamId || !trimmedName || !trimmedAdmin) return fail("Name und eigener Name sind Pflicht.");
  const template = RETRO_TEMPLATES.find((t) => t.key === templateKey);
  if (!template) return fail("Unbekanntes Template.");
  if (!Number.isInteger(votesPerUser) || votesPerUser < 1 || votesPerUser > 20) {
    return fail("Stimmen pro Person: 1 bis 20.");
  }
  const avatar = (AVATAR_EMOJIS as readonly string[]).includes(adminAvatar) ? adminAvatar : "";

  const retro = await prisma.retro.create({
    data: {
      teamId,
      name: trimmedName,
      votesPerUser,
      participants: { create: { name: trimmedAdmin, avatar, isAdmin: true } },
      columns: {
        create: template.columns.map((c, i) => ({ name: c.name, color: c.color, position: i })),
      },
    },
    include: { participants: true },
  });
  revalidatePath("/retro");
  return { ok: true, data: { retroId: retro.id, token: retro.participants[0].token } };
}

export async function joinRetro(
  retroId: string,
  name: string,
  asAdmin = false,
): Promise<ActionResult<{ token: string }>> {
  const trimmed = name.trim();
  if (!trimmed) return fail("Bitte einen Namen angeben.");
  const retro = await prisma.retro.findUnique({ where: { id: retroId } });
  if (!retro) return fail("Retro nicht gefunden.");

  try {
    const participant = await prisma.retroParticipant.create({
      data: { retroId, name: trimmed, isAdmin: asAdmin },
    });
    bumpRetro(retroId);
    return { ok: true, data: { token: participant.token } };
  } catch {
    return fail(`Der Name „${trimmed}" ist in diesem Board schon vergeben.`);
  }
}

/** Eigenen Namen, Avatar und Rolle ändern — jederzeit. */
export async function updateRetroProfile(
  retroId: string,
  token: string,
  name: string,
  avatar: string,
  role: "member" | "moderator",
): Promise<ActionResult> {
  const participant = await requireParticipant(retroId, token);
  if (!participant) return fail("Nicht Teil dieses Boards.");
  const trimmed = name.trim();
  if (!trimmed) return fail("Der Name darf nicht leer sein.");
  if (avatar !== "" && !(AVATAR_EMOJIS as readonly string[]).includes(avatar)) {
    return fail("Diesen Avatar gibt es nicht.");
  }
  try {
    await prisma.retroParticipant.update({
      where: { id: participant.id },
      data: { name: trimmed, avatar, isAdmin: role === "moderator" },
    });
  } catch {
    return fail(`Der Name „${trimmed}" ist in diesem Board schon vergeben.`);
  }
  bumpRetro(retroId);
  return { ok: true };
}

export async function deleteRetro(retroId: string, token: string): Promise<ActionResult> {
  if (!(await requireParticipant(retroId, token, true))) return fail("Nur der Moderator darf das.");
  await prisma.retro.delete({ where: { id: retroId } });
  revalidatePath("/retro");
  return { ok: true };
}

/** Voting freigeben oder wieder sperren — nur der Moderator. */
export async function setRetroVotingOpen(retroId: string, token: string, open: boolean): Promise<ActionResult> {
  if (!(await requireParticipant(retroId, token, true))) return fail("Nur der Moderator darf das.");
  await prisma.retro.update({ where: { id: retroId }, data: { votingOpen: open } });
  bumpRetro(retroId);
  return { ok: true };
}

/** Timer starten (Sekunden) oder stoppen (null) — nur der Moderator. */
export async function setRetroTimer(
  retroId: string,
  token: string,
  seconds: number | null,
): Promise<ActionResult> {
  if (!(await requireParticipant(retroId, token, true))) return fail("Nur der Moderator darf das.");
  if (seconds !== null && (!Number.isInteger(seconds) || seconds < 10 || seconds > 3600)) {
    return fail("Timer: 10 Sekunden bis 60 Minuten.");
  }
  await prisma.retro.update({
    where: { id: retroId },
    data: { timerEndsAt: seconds === null ? null : new Date(Date.now() + seconds * 1000) },
  });
  bumpRetro(retroId);
  return { ok: true };
}

export type RetroSortMode = "default" | "votes" | "author" | "shuffle";

/**
 * Sortierung fürs ganze Board festlegen — gilt für alle. Bei "shuffle" wird
 * die Ersteller-Reihenfolge serverseitig gemischt und geteilt; erneutes
 * Setzen von "shuffle" mischt neu.
 */
export async function setRetroSortMode(
  retroId: string,
  token: string,
  mode: RetroSortMode,
): Promise<ActionResult> {
  if (!(await requireParticipant(retroId, token, true))) return fail("Nur der Moderator darf das.");
  if (!["default", "votes", "author", "shuffle"].includes(mode)) return fail("Unbekannte Sortierung.");
  let sortOrder = "[]";
  if (mode === "shuffle") {
    const cards = await prisma.retroCard.findMany({
      where: { column: { retroId } },
      include: { author: { select: { name: true } } },
    });
    const authors = [...new Set(cards.map((c) => c.author.name))];
    for (let i = authors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [authors[i], authors[j]] = [authors[j], authors[i]];
    }
    sortOrder = JSON.stringify(authors);
  }
  await prisma.retro.update({ where: { id: retroId }, data: { sortMode: mode, sortOrder } });
  bumpRetro(retroId);
  return { ok: true };
}

/** Hintergrundmusik für alle ein-/ausschalten — nur der Moderator. */
export async function setRetroMusic(retroId: string, token: string, on: boolean): Promise<ActionResult> {
  if (!(await requireParticipant(retroId, token, true))) return fail("Nur der Moderator darf das.");
  await prisma.retro.update({ where: { id: retroId }, data: { musicOn: on } });
  bumpRetro(retroId);
  return { ok: true };
}

/** Verdeckt-Modus umschalten: an = anonym schreiben, aus = alle lesen mit. */
export async function setRetroHidden(retroId: string, token: string, hidden: boolean): Promise<ActionResult> {
  if (!(await requireParticipant(retroId, token, true))) return fail("Nur der Moderator darf das.");
  await prisma.retro.update({ where: { id: retroId }, data: { hidden } });
  bumpRetro(retroId);
  return { ok: true };
}

export async function addRetroColumn(retroId: string, token: string, name: string, color: string): Promise<ActionResult> {
  if (!(await requireParticipant(retroId, token, true))) return fail("Nur der Moderator darf das.");
  const trimmed = name.trim();
  if (!trimmed) return fail("Der Spaltenname darf nicht leer sein.");
  if (!(RETRO_COLORS as readonly string[]).includes(color)) return fail("Unbekannte Farbe.");
  const count = await prisma.retroColumn.count({ where: { retroId } });
  await prisma.retroColumn.create({ data: { retroId, name: trimmed, color, position: count } });
  bumpRetro(retroId);
  return { ok: true };
}

export async function renameRetroColumn(retroId: string, token: string, columnId: string, name: string): Promise<ActionResult> {
  if (!(await requireParticipant(retroId, token, true))) return fail("Nur der Moderator darf das.");
  const trimmed = name.trim();
  if (!trimmed) return fail("Der Spaltenname darf nicht leer sein.");
  await prisma.retroColumn.updateMany({ where: { id: columnId, retroId }, data: { name: trimmed } });
  bumpRetro(retroId);
  return { ok: true };
}

export async function setRetroColumnColor(retroId: string, token: string, columnId: string, color: string): Promise<ActionResult> {
  if (!(await requireParticipant(retroId, token, true))) return fail("Nur der Moderator darf das.");
  if (!(RETRO_COLORS as readonly string[]).includes(color)) return fail("Unbekannte Farbe.");
  await prisma.retroColumn.updateMany({ where: { id: columnId, retroId }, data: { color } });
  bumpRetro(retroId);
  return { ok: true };
}

/** Spalte ein-/ausklappen — lenkt den Fokus der Retro auf die übrigen Spalten. */
export async function setRetroColumnCollapsed(
  retroId: string,
  token: string,
  columnId: string,
  collapsed: boolean,
): Promise<ActionResult> {
  if (!(await requireParticipant(retroId, token, true))) return fail("Nur der Moderator darf das.");
  await prisma.retroColumn.updateMany({ where: { id: columnId, retroId }, data: { collapsed } });
  bumpRetro(retroId);
  return { ok: true };
}

/** Spalte per Drag & Drop umsortieren: an die Position der Zielspalte schieben. */
export async function reorderRetroColumn(
  retroId: string,
  token: string,
  columnId: string,
  targetColumnId: string,
): Promise<ActionResult> {
  if (!(await requireParticipant(retroId, token, true))) return fail("Nur der Moderator darf das.");
  if (columnId === targetColumnId) return { ok: true };
  const columns = await prisma.retroColumn.findMany({
    where: { retroId },
    orderBy: { position: "asc" },
  });
  const from = columns.findIndex((c) => c.id === columnId);
  const to = columns.findIndex((c) => c.id === targetColumnId);
  if (from < 0 || to < 0) return fail("Spalte nicht gefunden.");
  const order = [...columns];
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved);
  await prisma.$transaction(
    order
      .map((c, i) => ({ c, i }))
      .filter(({ c, i }) => c.position !== i)
      .map(({ c, i }) => prisma.retroColumn.update({ where: { id: c.id }, data: { position: i } })),
  );
  bumpRetro(retroId);
  return { ok: true };
}

export async function deleteRetroColumn(retroId: string, token: string, columnId: string): Promise<ActionResult> {
  if (!(await requireParticipant(retroId, token, true))) return fail("Nur der Moderator darf das.");
  await prisma.retroColumn.deleteMany({ where: { id: columnId, retroId } });
  bumpRetro(retroId);
  return { ok: true };
}

/** „Schreibt gerade"-Signal: columnId = null heißt aufgehört. Fire-and-forget vom Client. */
export async function setRetroTyping(
  retroId: string,
  token: string,
  columnId: string | null,
): Promise<ActionResult> {
  const participant = await requireParticipant(retroId, token);
  if (!participant) return fail("Nicht Teil dieses Boards.");
  setTyping(retroId, participant.id, participant.name, columnId);
  bumpRetro(retroId);
  return { ok: true };
}

export async function addRetroCard(retroId: string, token: string, columnId: string, text: string): Promise<ActionResult> {
  const participant = await requireParticipant(retroId, token);
  if (!participant) return fail("Nicht Teil dieses Boards.");
  const trimmed = text.trim();
  if (!trimmed) return fail("Die Karte darf nicht leer sein.");
  const column = await prisma.retroColumn.findFirst({ where: { id: columnId, retroId } });
  if (!column) return fail("Spalte nicht gefunden.");
  await prisma.retroCard.create({ data: { columnId, authorId: participant.id, text: trimmed } });
  bumpRetro(retroId);
  return { ok: true };
}

/** Karte bearbeiten — nur der Autor oder der Moderator. */
export async function updateRetroCard(retroId: string, token: string, cardId: string, text: string): Promise<ActionResult> {
  const participant = await requireParticipant(retroId, token);
  if (!participant) return fail("Nicht Teil dieses Boards.");
  const trimmed = text.trim();
  if (!trimmed) return fail("Die Karte darf nicht leer sein.");
  const card = await prisma.retroCard.findFirst({
    where: { id: cardId, column: { retroId } },
  });
  if (!card) return fail("Karte nicht gefunden.");
  if (card.authorId !== participant.id && !participant.isAdmin) return fail("Nur eigene Karten lassen sich bearbeiten.");
  await prisma.retroCard.update({ where: { id: cardId }, data: { text: trimmed } });
  bumpRetro(retroId);
  return { ok: true };
}

export async function deleteRetroCard(retroId: string, token: string, cardId: string): Promise<ActionResult> {
  const participant = await requireParticipant(retroId, token);
  if (!participant) return fail("Nicht Teil dieses Boards.");
  const card = await prisma.retroCard.findFirst({ where: { id: cardId, column: { retroId } } });
  if (!card) return fail("Karte nicht gefunden.");
  if (card.authorId !== participant.id && !participant.isAdmin) return fail("Nur eigene Karten lassen sich löschen.");
  await prisma.retroCard.delete({ where: { id: cardId } });
  bumpRetro(retroId);
  return { ok: true };
}

export async function addRetroComment(retroId: string, token: string, cardId: string, text: string): Promise<ActionResult> {
  const participant = await requireParticipant(retroId, token);
  if (!participant) return fail("Nicht Teil dieses Boards.");
  const trimmed = text.trim();
  if (!trimmed) return fail("Der Kommentar darf nicht leer sein.");
  const card = await prisma.retroCard.findFirst({ where: { id: cardId, column: { retroId } } });
  if (!card) return fail("Karte nicht gefunden.");
  await prisma.retroComment.create({ data: { cardId, authorId: participant.id, text: trimmed } });
  bumpRetro(retroId);
  return { ok: true };
}

export async function deleteRetroComment(retroId: string, token: string, commentId: string): Promise<ActionResult> {
  const participant = await requireParticipant(retroId, token);
  if (!participant) return fail("Nicht Teil dieses Boards.");
  const comment = await prisma.retroComment.findFirst({
    where: { id: commentId, card: { column: { retroId } } },
  });
  if (!comment) return fail("Kommentar nicht gefunden.");
  if (comment.authorId !== participant.id && !participant.isAdmin) return fail("Nur eigene Kommentare lassen sich löschen.");
  await prisma.retroComment.delete({ where: { id: commentId } });
  bumpRetro(retroId);
  return { ok: true };
}

/** Eine Stimme auf eine Karte legen — solange das eigene Kontingent reicht. */
export async function voteRetroCard(retroId: string, token: string, cardId: string): Promise<ActionResult> {
  const participant = await requireParticipant(retroId, token);
  if (!participant) return fail("Nicht Teil dieses Boards.");
  const retro = await prisma.retro.findUnique({ where: { id: retroId } });
  if (!retro) return fail("Retro nicht gefunden.");
  if (!retro.votingOpen) return fail("Das Voting ist noch nicht freigegeben.");
  const card = await prisma.retroCard.findFirst({ where: { id: cardId, column: { retroId } } });
  if (!card) return fail("Karte nicht gefunden.");
  const used = await prisma.retroVote.count({
    where: { participantId: participant.id, card: { column: { retroId } } },
  });
  if (used >= retro.votesPerUser) return fail(`Alle ${retro.votesPerUser} Stimmen sind vergeben.`);
  await prisma.retroVote.create({ data: { cardId, participantId: participant.id } });
  bumpRetro(retroId);
  return { ok: true };
}

/** Eine eigene Stimme von einer Karte zurücknehmen. */
export async function unvoteRetroCard(retroId: string, token: string, cardId: string): Promise<ActionResult> {
  const participant = await requireParticipant(retroId, token);
  if (!participant) return fail("Nicht Teil dieses Boards.");
  const vote = await prisma.retroVote.findFirst({
    where: { cardId, participantId: participant.id },
  });
  if (!vote) return fail("Keine eigene Stimme auf dieser Karte.");
  await prisma.retroVote.delete({ where: { id: vote.id } });
  bumpRetro(retroId);
  return { ok: true };
}

/**
 * Zwei Karten zusammenführen (auch spaltenübergreifend): Text wird angehängt,
 * Kommentare und Stimmen wandern mit, die Quellkarte verschwindet.
 * Darf jeder Teilnehmer — der Bestätigungs-Dialog schützt vor Versehen.
 */
export async function mergeRetroCards(retroId: string, token: string, sourceId: string, targetId: string): Promise<ActionResult> {
  if (!(await requireParticipant(retroId, token))) return fail("Nicht Teil dieses Boards.");
  if (sourceId === targetId) return fail("Eine Karte lässt sich nicht mit sich selbst mergen.");
  const [source, target] = await Promise.all([
    prisma.retroCard.findFirst({ where: { id: sourceId, column: { retroId } } }),
    prisma.retroCard.findFirst({ where: { id: targetId, column: { retroId } } }),
  ]);
  if (!source || !target) return fail("Karte nicht gefunden.");
  await prisma.$transaction([
    prisma.retroCard.update({
      where: { id: targetId },
      data: { text: `${target.text}\n⸻\n${source.text}` },
    }),
    prisma.retroComment.updateMany({ where: { cardId: sourceId }, data: { cardId: targetId } }),
    prisma.retroVote.updateMany({ where: { cardId: sourceId }, data: { cardId: targetId } }),
    prisma.retroCard.delete({ where: { id: sourceId } }),
  ]);
  bumpRetro(retroId);
  return { ok: true };
}
