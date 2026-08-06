"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createRefinement } from "@/app/(app)/refinement/actions";
import { onProfileSaved, storedProfile, type StoredProfile } from "@/components/ProfileDock";

export function CreateRefinement({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [profile, setProfile] = useState<StoredProfile | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nur Moderatoren legen Sessions an — Rolle kommt aus dem Profil unten links
  // und reagiert live auf Änderungen.
  useEffect(() => {
    setProfile(storedProfile());
    return onProfileSaved(() => setProfile(storedProfile()));
  }, []);

  const isModerator = profile?.refinementRole === "moderator";
  const canCreate = isModerator && !!profile?.name;

  const create = async () => {
    if (pending || !profile || !canCreate) return;
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
            disabled={!canCreate}
            className="input-field disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <button
          type="button"
          onClick={create}
          disabled={pending || !canCreate}
          className="btn-primary whitespace-nowrap px-4 py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Legt an…" : "Anlegen"}
        </button>
      </div>
      <div className="mt-2 text-[12px] text-dim">
        {canCreate
          ? `Du wirst als ${profile?.name} Moderator dieser Session.`
          : !profile?.name
            ? "Lege zuerst unten links dein Profil an — nur Moderatoren können Refinements anlegen."
            : "Nur Moderatoren legen Refinements an — stelle unten links deine Rolle im Refinement auf Moderator."}
      </div>
      {error && <div className="mt-2 text-[12.5px] text-danger">{error}</div>}
    </div>
  );
}
