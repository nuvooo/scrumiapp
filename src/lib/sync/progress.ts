export interface SyncProgress {
  running: boolean;
  teamName: string | null;
  /** Bereits verarbeitete Sprints des aktuellen Teams. */
  done: number;
  /** Zu verarbeitende Sprints des aktuellen Teams (nach Skip unveränderter). */
  total: number;
  /** Unverändert übersprungene (bereits abgeschlossene) Sprints. */
  skipped: number;
}

const idle: SyncProgress = { running: false, teamName: null, done: 0, total: 0, skipped: 0 };

// globalThis, damit API-Route und Sync-Code in Dev trotz getrennter Bundles
// denselben Zustand sehen (gleiches Muster wie beim Prisma-Singleton).
const g = globalThis as typeof globalThis & { __scrumiSyncProgress?: SyncProgress };

export function getSyncProgress(): SyncProgress {
  return g.__scrumiSyncProgress ?? idle;
}

export function syncStarted(teamName: string, total: number, skipped: number): void {
  g.__scrumiSyncProgress = { running: true, teamName, done: 0, total, skipped };
}

export function syncAdvanced(): void {
  const p = g.__scrumiSyncProgress;
  if (p?.running) g.__scrumiSyncProgress = { ...p, done: p.done + 1 };
}

export function syncFinished(): void {
  g.__scrumiSyncProgress = { ...idle };
}
