/**
 * In-Memory-Versionszähler pro Refinement: jede Änderung (Vote, Aufdecken,
 * Wurf, Beitritt …) zählt hoch. Der State-Endpoint hält Anfragen mit
 * unveränderter Version kurz offen (Long-Polling) — so fühlen sich Updates
 * nahezu sofort an, ohne WebSocket-Infrastruktur. Wie beim Prisma-Singleton
 * überlebt der Zähler per globalThis den Dev-Hot-Reload.
 */

const globalForVersion = globalThis as unknown as { refinementVersions?: Map<string, number> };
const versions = (globalForVersion.refinementVersions ??= new Map<string, number>());

export function refinementVersion(refinementId: string): number {
  return versions.get(refinementId) ?? 0;
}

export function bumpRefinement(refinementId: string): void {
  versions.set(refinementId, refinementVersion(refinementId) + 1);
  // Der WebSocket-Server (server.mjs) hängt sich hier ein und stößt alle
  // verbundenen Clients des Raums an — ohne ihn passiert einfach nichts.
  (globalThis as { scrumiRefinementNotify?: (id: string) => void }).scrumiRefinementNotify?.(refinementId);
}
