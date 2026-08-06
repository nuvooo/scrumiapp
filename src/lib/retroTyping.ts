/**
 * Flüchtiger „schreibt gerade"-Status für Retro-Boards: wer den Karten-Editor
 * offen hat, meldet sich alle paar Sekunden. Nur im Speicher (wie die
 * Wurf-Events) — nach kurzer Stille verschwindet der Eintrag von selbst.
 */

export interface RetroTyping {
  participantId: string;
  name: string;
  columnId: string;
  at: number;
}

const TTL_MS = 6000;

const globalForTyping = globalThis as unknown as {
  retroTyping?: Map<string, Map<string, RetroTyping>>;
};
const store = (globalForTyping.retroTyping ??= new Map<string, Map<string, RetroTyping>>());

/** columnId = null heißt: hat aufgehört zu schreiben. */
export function setTyping(
  retroId: string,
  participantId: string,
  name: string,
  columnId: string | null,
  now = Date.now(),
): void {
  const room = store.get(retroId) ?? new Map<string, RetroTyping>();
  if (columnId === null) room.delete(participantId);
  else room.set(participantId, { participantId, name, columnId, at: now });
  store.set(retroId, room);
}

export function activeTyping(retroId: string, now = Date.now()): RetroTyping[] {
  const room = store.get(retroId);
  if (!room) return [];
  for (const [id, entry] of room) {
    if (now - entry.at >= TTL_MS) room.delete(id);
  }
  return [...room.values()];
}

export function clearTyping(retroId: string): void {
  store.delete(retroId);
}
