import { prisma } from "@/lib/db";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BACKUP_TABLES,
  validateBackup,
  type BackupTable,
  type BackupRow,
  type BackupFile,
} from "@/lib/backupFormat";

export { BACKUP_FORMAT, BACKUP_VERSION, BACKUP_TABLES, validateBackup };
export type { BackupTable, BackupRow, BackupFile };

const MODEL_BY_TABLE: Record<BackupTable, string> = {
  teams: "team",
  teamMembers: "teamMember",
  sprints: "sprint",
  issues: "issue",
  burndownPoints: "burndownPoint",
  capacityEntries: "capacityEntry",
  refinements: "refinement",
  refinementTickets: "refinementTicket",
  refinementParticipants: "refinementParticipant",
  refinementVotes: "refinementVote",
};

interface ModelDelegate {
  findMany(args?: { orderBy?: { id: "asc" } }): Promise<BackupRow[]>;
  deleteMany(): Promise<unknown>;
  createMany(args: { data: BackupRow[] }): Promise<unknown>;
}

/** Strukturelle Sicht auf den Prisma-Client — erlaubt Fakes in Tests. */
export type BackupDb = Record<string, ModelDelegate> & {
  $transaction<T>(fn: (tx: BackupDb) => Promise<T>, options?: { timeout?: number }): Promise<T>;
};

export async function exportBackup(db: BackupDb = prisma as unknown as BackupDb): Promise<BackupFile> {
  const data = {} as Record<BackupTable, BackupRow[]>;
  for (const table of BACKUP_TABLES) {
    // Sortiert exportieren, damit zwei Exporte desselben Stands identisch sind.
    data[table] = await db[MODEL_BY_TABLE[table]].findMany({ orderBy: { id: "asc" } });
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export type ImportResult =
  | { ok: true; counts: Record<BackupTable, number> }
  | { ok: false; error: string };

/**
 * Ersetzt den kompletten Datenbestand durch das Backup. Läuft in einer
 * Transaktion — schlägt ein Schritt fehl, bleibt die DB unverändert.
 * Original-IDs werden übernommen, damit alle Relationen intakt bleiben.
 */
export async function importBackup(
  payload: unknown,
  db: BackupDb = prisma as unknown as BackupDb
): Promise<ImportResult> {
  const validation = validateBackup(payload);
  if (!validation.ok) return validation;
  const { data } = validation.backup;

  const counts = {} as Record<BackupTable, number>;
  await db.$transaction(
    async (tx) => {
      // Alle übrigen Tabellen hängen per Cascade (direkt oder transitiv) an Team.
      await tx.team.deleteMany();
      for (const table of BACKUP_TABLES) {
        const rows = data[table];
        await tx[MODEL_BY_TABLE[table]].createMany({ data: rows });
        counts[table] = rows.length;
      }
    },
    { timeout: 120_000 }
  );
  return { ok: true, counts };
}
