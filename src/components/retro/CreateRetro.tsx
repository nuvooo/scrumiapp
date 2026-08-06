"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createRetro } from "@/app/(app)/retro/actions";
import { RETRO_TEMPLATES } from "@/lib/view/retroState";
import { onProfileSaved, storedProfile, type StoredProfile } from "@/components/ProfileDock";

export function CreateRetro({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [profile, setProfile] = useState<StoredProfile | null>(null);
  const [templateKey, setTemplateKey] = useState(RETRO_TEMPLATES[0].key);
  const [votesText, setVotesText] = useState("3");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const template = RETRO_TEMPLATES.find((t) => t.key === templateKey) ?? RETRO_TEMPLATES[0];

  // Nur Moderatoren legen Boards an — Rolle kommt aus dem Profil unten links
  // und reagiert live auf Änderungen.
  useEffect(() => {
    setProfile(storedProfile());
    return onProfileSaved(() => setProfile(storedProfile()));
  }, []);

  const isModerator = profile?.retroRole === "moderator";
  const canCreate = isModerator && !!profile?.name;

  const create = async () => {
    if (pending || !profile || !canCreate) return;
    setPending(true);
    setError(null);
    const votes = Number(votesText);
    const result = await createRetro(teamId, name, profile.name, templateKey, votes, profile.avatar);
    setPending(false);
    if (!result.ok || !result.data) {
      setError(result.error ?? "Anlegen fehlgeschlagen.");
      return;
    }
    window.localStorage.setItem(`scrumi.retro.${result.data.retroId}.token`, result.data.token);
    router.push(`/retro/${result.data.retroId}`);
  };

  return (
    <div className="card p-[18px]">
      <div className="text-sm font-semibold">Neue Retro</div>
      <div className="mt-3 grid grid-cols-1 items-end gap-3 md:grid-cols-[1.4fr,1.2fr,72px,auto]">
        <div>
          <label htmlFor="retro-name" className="mono-label mb-[7px] block">Name</label>
          <input
            id="retro-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Retro Sprint 42"
            disabled={!canCreate}
            className="input-field disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <div>
          <label htmlFor="retro-template" className="mono-label mb-[7px] block">Template</label>
          <select
            id="retro-template"
            value={templateKey}
            onChange={(e) => setTemplateKey(e.target.value)}
            className="input-field"
          >
            {RETRO_TEMPLATES.map((tpl) => (
              <option key={tpl.key} value={tpl.key}>{tpl.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="retro-votes" className="mono-label mb-[7px] block">Stimmen</label>
          <input
            id="retro-votes"
            value={votesText}
            onChange={(e) => setVotesText(e.target.value)}
            inputMode="numeric"
            className="input-field text-center font-mono"
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
      {/* Spalten-Vorschau des gewählten Templates */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {template.columns.map((c) => (
          <span
            key={c.name}
            className="flex items-center gap-1.5 rounded-full border border-edge bg-field px-2.5 py-1 text-[12px] text-mid"
          >
            <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
            {c.name}
          </span>
        ))}
        <span className="text-[11.5px] text-dim">— Spalten lassen sich im Board jederzeit anpassen</span>
      </div>
      <div className="mt-2 text-[12px] text-dim">
        {canCreate
          ? `Du wirst als ${profile?.name} Moderator dieses Boards.`
          : !profile?.name
            ? "Lege zuerst unten links dein Profil an — nur Moderatoren können Retros anlegen."
            : "Nur Moderatoren legen Retros an — stelle unten links deine Rolle im Retro auf Moderator."}
      </div>
      {error && <div className="mt-2 text-[12.5px] text-danger">{error}</div>}
    </div>
  );
}
