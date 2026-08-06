"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRetro } from "@/app/(app)/retro/actions";
import { RETRO_TEMPLATES } from "@/lib/view/retroState";

export function CreateRetro({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [templateKey, setTemplateKey] = useState(RETRO_TEMPLATES[0].key);
  const [votesText, setVotesText] = useState("3");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const template = RETRO_TEMPLATES.find((t) => t.key === templateKey) ?? RETRO_TEMPLATES[0];

  const create = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    const votes = Number(votesText);
    const result = await createRetro(teamId, name, adminName, templateKey, votes);
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
      <div className="mt-3 grid grid-cols-1 items-end gap-3 md:grid-cols-[1.3fr,1fr,1.2fr,72px,auto]">
        <div>
          <label htmlFor="retro-name" className="mono-label mb-[7px] block">Name</label>
          <input
            id="retro-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Retro Sprint 42"
            className="input-field"
          />
        </div>
        <div>
          <label htmlFor="retro-admin" className="mono-label mb-[7px] block">Dein Name (Moderator)</label>
          <input
            id="retro-admin"
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            placeholder="z. B. Sebastian"
            className="input-field"
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
        <button type="button" onClick={create} disabled={pending} className="btn-primary whitespace-nowrap px-4 py-2.5">
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
      {error && <div className="mt-2 text-[12.5px] text-danger">{error}</div>}
    </div>
  );
}
