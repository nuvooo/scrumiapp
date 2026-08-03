/**
 * Backup-Dateiformat und Validierung — bewusst ohne Prisma-Import,
 * damit auch Client-Komponenten (Import-Vorschau) es nutzen können.
 */

export const BACKUP_FORMAT = "scrumi-backup";
export const BACKUP_VERSION = 1;

/** Tabellen in FK-Reihenfolge — der Import legt sie genau in dieser Reihenfolge an. */
export const BACKUP_TABLES = [
  "teams",
  "teamMembers",
  "sprints",
  "issues",
  "burndownPoints",
  "capacityEntries",
  "refinements",
  "refinementTickets",
  "refinementParticipants",
  "refinementVotes",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

export type BackupRow = Record<string, unknown>;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  data: Record<BackupTable, BackupRow[]>;
}

export type ValidationResult = { ok: true; backup: BackupFile } | { ok: false; error: string };

export function validateBackup(payload: unknown): ValidationResult {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return { ok: false, error: "Keine gültige Backup-Datei (kein JSON-Objekt)." };
  }
  const candidate = payload as Partial<BackupFile>;
  if (candidate.format !== BACKUP_FORMAT) {
    return { ok: false, error: `Unbekanntes Format — erwartet "${BACKUP_FORMAT}".` };
  }
  if (candidate.version !== BACKUP_VERSION) {
    return { ok: false, error: `Nicht unterstützte Version ${candidate.version} — erwartet Version ${BACKUP_VERSION}.` };
  }
  const data = candidate.data;
  if (typeof data !== "object" || data === null) {
    return { ok: false, error: "Backup enthält keine Daten." };
  }
  for (const table of BACKUP_TABLES) {
    if (!Array.isArray((data as Record<string, unknown>)[table])) {
      return { ok: false, error: `Tabelle "${table}" fehlt oder ist kein Array.` };
    }
  }
  return { ok: true, backup: candidate as BackupFile };
}
