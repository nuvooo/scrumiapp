"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRefinement } from "@/app/(app)/refinement/actions";

export function CreateRefinement({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await createRefinement(teamId, name, adminName);
    setPending(false);
    if (!result.ok || !result.data) {
      setError(result.error ?? "Anlegen fehlgeschlagen.");
      return;
    }
    window.localStorage.setItem(`scrumi.refinement.${result.data.refinementId}.token`, result.data.token);
    router.push(`/refinement/${result.data.refinementId}`);
  };

  return (
    <div className="card p-[18px]">
      <div className="text-sm font-semibold">Neues Refinement</div>
      <div className="mt-3 grid grid-cols-1 items-end gap-3 md:grid-cols-[1.4fr,1fr,auto]">
        <div>
          <label htmlFor="ref-name" className="mono-label mb-[7px] block">Name</label>
          <input
            id="ref-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Refinement KW 32"
            className="input-field"
          />
        </div>
        <div>
          <label htmlFor="ref-admin" className="mono-label mb-[7px] block">Dein Name (Admin)</label>
          <input
            id="ref-admin"
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            placeholder="z. B. Sebastian"
            className="input-field"
          />
        </div>
        <button type="button" onClick={create} disabled={pending} className="btn-primary whitespace-nowrap px-4 py-2.5">
          {pending ? "Legt an…" : "Anlegen"}
        </button>
      </div>
      {error && <div className="mt-2 text-[12.5px] text-danger">{error}</div>}
    </div>
  );
}
