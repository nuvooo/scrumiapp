import { randomUUID } from "crypto";

/**
 * Flüchtige Wurf-Events („Ben wirft 🍅 auf Zoe") für die Refinement-Räume.
 * Bewusst nur im Speicher: die Events sind reine Show, leben ~10 Sekunden und
 * erreichen alle Clients über den bestehenden 2-Sekunden-Poll. Wie beim
 * Prisma-Singleton überlebt der Store per globalThis den Dev-Hot-Reload.
 */

export interface RefinementThrow {
  id: string;
  from: string;
  to: string;
  emoji: string;
  /** Serverzeit in ms — Clients filtern damit alte Events beim Beitritt aus. */
  at: number;
}

const TTL_MS = 10_000;
const MAX_PER_REFINEMENT = 30;

const globalForThrows = globalThis as unknown as { refinementThrows?: Map<string, RefinementThrow[]> };
const store = (globalForThrows.refinementThrows ??= new Map<string, RefinementThrow[]>());

export function addThrow(
  refinementId: string,
  from: string,
  to: string,
  emoji: string,
  now = Date.now(),
): RefinementThrow {
  const event: RefinementThrow = { id: randomUUID(), from, to, emoji, at: now };
  const list = store.get(refinementId) ?? [];
  list.push(event);
  store.set(refinementId, list.slice(-MAX_PER_REFINEMENT));
  return event;
}

export function recentThrows(refinementId: string, now = Date.now()): RefinementThrow[] {
  const list = store.get(refinementId) ?? [];
  const fresh = list.filter((t) => now - t.at < TTL_MS);
  if (fresh.length !== list.length) store.set(refinementId, fresh);
  return fresh;
}

export function clearThrows(refinementId: string): void {
  store.delete(refinementId);
}
