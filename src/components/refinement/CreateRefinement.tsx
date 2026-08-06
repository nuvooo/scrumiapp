"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createRefinement } from "@/app/(app)/refinement/actions";
import { storedProfile } from "@/components/ProfileDock";

export function CreateRefinement({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [profileName, setProfileName] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Der Ersteller ist automatisch Moderator — Name und Avatar kommen aus dem Profil unten links.
  useEffect(() => {
    setProfileName(storedProfile().name);
  }, []);

  const create = async () => {
    if (pending) return;
    const profile = storedProfile();
    if (!profile.name) {
      setError("Lege zuerst unten links dein Profil an — der Ersteller wird automatisch Moderator.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await createRefinement(teamId, name, profile.name, profile.avatar);
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
      <div className="mt-3 grid grid-cols-1 items-end gap-3 md:grid-cols-[1.4fr,auto]">
        <div>
          <label htmlFor="ref-name" className="mono-label mb-[7px] block">Name</label>
          <input
            id="ref-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="z. B. Refinement KW 32"
            className="input-field"
          />
        </div>
        <button type="button" onClick={create} disabled={pending} className="btn-primary whitespace-nowrap px-4 py-2.5">
          {pending ? "Legt an…" : "Anlegen"}
        </button>
      </div>
      <div className="mt-2 text-[12px] text-dim">
        {profileName
          ? `Du wirst als ${profileName} Moderator dieser Session.`
          : "Der Ersteller wird automatisch Moderator — Name kommt aus deinem Profil unten links."}
      </div>
      {error && <div className="mt-2 text-[12.5px] text-danger">{error}</div>}
    </div>
  );
}
