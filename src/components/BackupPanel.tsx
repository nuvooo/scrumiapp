"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BACKUP_TABLES, validateBackup, type BackupFile } from "@/lib/backupFormat";

const TABLE_LABELS: Record<(typeof BACKUP_TABLES)[number], string> = {
  teams: "Teams",
  teamMembers: "Team-Mitglieder",
  sprints: "Sprints",
  issues: "Issues",
  burndownPoints: "Burndown-Punkte",
  capacityEntries: "Kapazitätseinträge",
  refinements: "Refinements",
  refinementTickets: "Refinement-Tickets",
  refinementParticipants: "Refinement-Teilnehmer",
  refinementVotes: "Refinement-Votes",
};

type Status =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string };

export function BackupPanel() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ fileName: string; backup: BackupFile } | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [busy, setBusy] = useState(false);

  async function selectFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setStatus({ kind: "idle" });
    setPending(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setStatus({ kind: "error", message: "Die Datei ist kein gültiges JSON." });
      return;
    }
    const result = validateBackup(parsed);
    if (!result.ok) {
      setStatus({ kind: "error", message: result.error });
      return;
    }
    setPending({ fileName: file.name, backup: result.backup });
  }

  async function runImport() {
    if (!pending || busy) return;
    setBusy(true);
    setStatus({ kind: "idle" });
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pending.backup),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && body?.ok) {
        setPending(null);
        setStatus({ kind: "success", message: "Import abgeschlossen — alle Daten wurden ersetzt." });
        router.refresh();
      } else {
        setStatus({ kind: "error", message: body?.error ?? `Import fehlgeschlagen (HTTP ${res.status})` });
      }
    } catch {
      setStatus({ kind: "error", message: "Server nicht erreichbar." });
    } finally {
      setBusy(false);
    }
  }

  const summary = pending
    ? BACKUP_TABLES.map((t) => ({ label: TABLE_LABELS[t], count: pending.backup.data[t].length })).filter(
        (row) => row.count > 0
      )
    : [];

  return (
    <div>
      <div className="card mt-6 max-w-[820px] p-[18px]">
        <div className="text-sm font-semibold">Export</div>
        <p className="mt-1 text-[13px] text-muted">
          Lädt den kompletten Datenbestand als JSON-Datei herunter — zum Sichern oder zum Import in einer
          anderen Scrumi-Instanz.
        </p>
        <a href="/api/backup" className="btn-primary mt-3.5 inline-block px-4 py-2.5">
          Backup herunterladen
        </a>
      </div>

      <div className="card mt-3.5 max-w-[820px] p-[18px]">
        <div className="text-sm font-semibold">Import</div>
        <p className="mt-1 text-[13px] text-muted">
          Spielt eine Backup-Datei ein. Achtung: <strong>Ersetzt alle vorhandenen Daten</strong> dieser
          Instanz.
        </p>
        <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={selectFile} />
        <button
          type="button"
          className="btn-secondary mt-3.5 px-4 py-2.5"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
        >
          Backup-Datei wählen…
        </button>

        {pending && (
          <div className="mt-4 border-t border-line pt-4">
            <div className="text-[13px]">
              <span className="font-semibold">{pending.fileName}</span>
              <span className="text-muted"> — exportiert am {new Date(pending.backup.exportedAt).toLocaleString("de-DE")}</span>
            </div>
            <ul className="mt-2 text-[13px] text-muted">
              {summary.length === 0 && <li>Backup ist leer.</li>}
              {summary.map((row) => (
                <li key={row.label}>
                  {row.count} × {row.label}
                </li>
              ))}
            </ul>
            <div className="mt-3.5 flex items-center gap-3">
              <button type="button" className="btn-danger px-4 py-2.5" onClick={runImport} disabled={busy}>
                {busy ? "Importiere…" : "Jetzt importieren (ersetzt alles)"}
              </button>
              <button
                type="button"
                className="btn-secondary px-4 py-2.5"
                onClick={() => setPending(null)}
                disabled={busy}
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {status.kind === "error" && <p className="mt-3 text-[13px] text-red-400">{status.message}</p>}
        {status.kind === "success" && <p className="mt-3 text-[13px] text-emerald-400">{status.message}</p>}
      </div>
    </div>
  );
}
