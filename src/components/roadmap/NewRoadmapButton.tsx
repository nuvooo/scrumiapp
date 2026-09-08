"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRoadmapAction } from "@/app/(app)/roadmap/actions";
import { monthKey, addMonths } from "@/lib/view/roadmapGrid";

export function NewRoadmapButton({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [start, setStart] = useState(() => monthKey(new Date()));
  const [end, setEnd] = useState(() => addMonths(monthKey(new Date()), 11));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result = await createRoadmapAction(teamId, name, start, end);
      if (!result.ok || !result.data) {
        setError(result.error ?? "Anlegen fehlgeschlagen.");
        return;
      }
      setOpen(false);
      setName("");
      router.push(`/roadmap/${result.data.id}?team=${teamId}`);
    });

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary px-3.5 py-[7px]">
        + Neue Roadmap
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="card w-full max-w-md px-[18px] py-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[15px] font-semibold">Neue Roadmap</h2>
            <label className="mt-3.5 block">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Name</span>
              <input
                type="text"
                value={name}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                className="mt-1 w-full rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[13px] text-fg"
                placeholder="z. B. Plattform 2026"
              />
            </label>
            <div className="mt-3 flex gap-3">
              <label className="flex-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Von</span>
                <input
                  type="month"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="mt-1 w-full rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[13px] text-fg"
                />
              </label>
              <label className="flex-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Bis</span>
                <input
                  type="month"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="mt-1 w-full rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[13px] text-fg"
                />
              </label>
            </div>
            {error && <p className="mt-2.5 text-[12.5px] text-danger">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary px-3.5 py-[7px]">
                Abbrechen
              </button>
              <button type="button" onClick={submit} disabled={pending} className="btn-primary px-3.5 py-[7px] disabled:opacity-40">
                {pending ? "Lege an…" : "Anlegen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
