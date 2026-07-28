"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Progress {
  running: boolean;
  teamName: string | null;
  done: number;
  total: number;
  skipped: number;
}

export function SyncButton({ lastSyncedLabel }: { lastSyncedLabel?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function sync() {
    if (busy) return;
    setBusy(true);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/sync/status");
        const p = (await res.json()) as Progress;
        setProgress(p.running ? p : null);
      } catch {
        // Statusabfrage ist Komfort — Fehler hier nie an den Nutzer durchreichen
      }
    }, 800);
    try {
      await fetch("/api/sync", { method: "POST" });
      router.refresh();
    } finally {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      setProgress(null);
      setBusy(false);
    }
  }

  const statusText = busy
    ? progress && progress.total > 0
      ? `Synchronisiere ${progress.teamName ?? ""}: Sprint ${Math.min(progress.done + 1, progress.total)} von ${progress.total}`
      : "Jira Cloud wird abgefragt…"
    : lastSyncedLabel
    ? `zuletzt synchronisiert: ${lastSyncedLabel}`
    : "noch nicht synchronisiert";

  return (
    <div className="flex items-center gap-3.5">
      <div className="text-xs text-faint">{statusText}</div>
      <button
        onClick={sync}
        disabled={busy}
        className={`btn-primary flex items-center gap-2 px-[15px] py-2 ${busy ? "opacity-70" : ""}`}
      >
        <span
          className={`h-[11px] w-[11px] animate-spin rounded-full border-2 border-[rgba(10,13,19,0.35)] border-t-ink ${busy ? "block" : "hidden"}`}
        />
        {busy ? "Synchronisiere…" : "Sync"}
      </button>
    </div>
  );
}
