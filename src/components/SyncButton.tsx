"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SyncButton({ lastSyncedLabel }: { lastSyncedLabel?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function sync() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/sync", { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3.5">
      <div className="text-xs text-faint">
        {busy
          ? "Jira Cloud wird abgefragt…"
          : lastSyncedLabel
          ? `zuletzt synchronisiert: ${lastSyncedLabel}`
          : "noch nicht synchronisiert"}
      </div>
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
