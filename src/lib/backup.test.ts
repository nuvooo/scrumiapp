import { describe, it, expect } from "vitest";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BACKUP_TABLES,
  validateBackup,
  exportBackup,
  importBackup,
  type BackupDb,
} from "./backup";

type Row = Record<string, unknown>;

/** Fake-Prisma-Client, der alle Aufrufe in `calls` protokolliert. */
function fakeDb(rowsByTable: Partial<Record<string, Row[]>> = {}) {
  const calls: string[] = [];
  const models = [
    "team",
    "teamMember",
    "sprint",
    "issue",
    "burndownPoint",
    "capacityEntry",
    "refinement",
    "refinementTicket",
    "refinementParticipant",
    "refinementVote",
  ] as const;
  const db = {} as Record<string, unknown> & { $transaction: BackupDb["$transaction"] };
  for (const name of models) {
    db[name] = {
      findMany: async () => rowsByTable[name] ?? [],
      deleteMany: async () => {
        calls.push(`${name}.deleteMany`);
        return { count: 0 };
      },
      createMany: async ({ data }: { data: Row[] }) => {
        calls.push(`${name}.createMany:${data.length}`);
        return { count: data.length };
      },
    };
  }
  db.$transaction = async (fn) => fn(db as unknown as BackupDb);
  return { db: db as unknown as BackupDb, calls };
}

function validPayload(overrides: Partial<Record<string, unknown>> = {}) {
  const data = Object.fromEntries(BACKUP_TABLES.map((t) => [t, []]));
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: "2026-08-03T10:00:00.000Z",
    data,
    ...overrides,
  };
}

describe("validateBackup", () => {
  it("akzeptiert ein gültiges Backup", () => {
    const result = validateBackup(validPayload());
    expect(result.ok).toBe(true);
  });

  it("lehnt Nicht-Objekte ab", () => {
    expect(validateBackup(null).ok).toBe(false);
    expect(validateBackup("text").ok).toBe(false);
  });

  it("lehnt falsches Format ab", () => {
    const result = validateBackup(validPayload({ format: "anders" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Format");
  });

  it("lehnt unbekannte Version ab", () => {
    const result = validateBackup(validPayload({ version: 99 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Version");
  });

  it("lehnt fehlende Tabellen ab", () => {
    const data = Object.fromEntries(BACKUP_TABLES.map((t) => [t, []]));
    delete (data as Record<string, unknown>).issues;
    const result = validateBackup(validPayload({ data }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("issues");
  });

  it("lehnt Tabellen ab, die keine Arrays sind", () => {
    const data = Object.fromEntries(BACKUP_TABLES.map((t) => [t, []]));
    (data as Record<string, unknown>).teams = "kein Array";
    const result = validateBackup(validPayload({ data }));
    expect(result.ok).toBe(false);
  });
});

describe("exportBackup", () => {
  it("liefert alle Tabellen mit Format und Version", async () => {
    const { db } = fakeDb({
      team: [{ id: "t1", name: "Alpha" }],
      sprint: [{ id: "s1", teamId: "t1" }],
    });
    const backup = await exportBackup(db);
    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Object.keys(backup.data)).toEqual([...BACKUP_TABLES]);
    expect(backup.data.teams).toEqual([{ id: "t1", name: "Alpha" }]);
    expect(backup.data.sprints).toEqual([{ id: "s1", teamId: "t1" }]);
    expect(backup.data.issues).toEqual([]);
  });
});

describe("importBackup", () => {
  it("löscht zuerst Teams und legt dann in FK-Reihenfolge an", async () => {
    const { db, calls } = fakeDb();
    const payload = validPayload();
    (payload.data as Record<string, Row[]>).teams = [{ id: "t1", name: "Alpha" }];
    (payload.data as Record<string, Row[]>).sprints = [{ id: "s1", teamId: "t1" }];

    const result = await importBackup(payload, db);
    expect(result.ok).toBe(true);
    expect(calls).toEqual([
      "team.deleteMany",
      "team.createMany:1",
      "teamMember.createMany:0",
      "sprint.createMany:1",
      "issue.createMany:0",
      "burndownPoint.createMany:0",
      "capacityEntry.createMany:0",
      "refinement.createMany:0",
      "refinementTicket.createMany:0",
      "refinementParticipant.createMany:0",
      "refinementVote.createMany:0",
    ]);
  });

  it("liefert die Anzahl importierter Zeilen pro Tabelle", async () => {
    const { db } = fakeDb();
    const payload = validPayload();
    (payload.data as Record<string, Row[]>).teams = [{ id: "t1" }, { id: "t2" }];

    const result = await importBackup(payload, db);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.counts.teams).toBe(2);
      expect(result.counts.sprints).toBe(0);
    }
  });

  it("schreibt bei ungültigem Payload nichts in die DB", async () => {
    const { db, calls } = fakeDb();
    const result = await importBackup({ format: "falsch" }, db);
    expect(result.ok).toBe(false);
    expect(calls).toEqual([]);
  });
});
