"use client";

import { useState } from "react";
import { AVATAR_EMOJIS } from "@/lib/view/refinementState";

export interface DockRole {
  value: string;
  label: string;
  hint: string;
}

/** Gespeichertes Profil für die Vorbelegung von Beitritts-Formularen. */
export function storedProfile(): { name: string; avatar: string } {
  try {
    const raw = window.localStorage.getItem("scrumi.profile");
    if (!raw) return { name: "", avatar: "" };
    const parsed = JSON.parse(raw) as { name?: string; avatar?: string };
    return { name: parsed.name ?? "", avatar: parsed.avatar ?? "" };
  } catch {
    return { name: "", avatar: "" };
  }
}

/**
 * Zentrales Profil-Widget unten links — ein Bauteil für Refinement und Retro.
 * Zeigt Avatar, Name und Rolle; Klick öffnet den Editor. Name und Avatar
 * werden zusätzlich lokal gemerkt, um künftige Beitritte vorzubelegen.
 */
export function ProfileDock({
  name,
  avatar,
  role,
  roles,
  onSave,
}: {
  name: string;
  avatar: string;
  role: string;
  roles: DockRole[];
  onSave: (name: string, avatar: string, role: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [nameText, setNameText] = useState("");
  const [avatarSel, setAvatarSel] = useState("");
  const [roleSel, setRoleSel] = useState("");

  const openDock = () => {
    setNameText(name);
    setAvatarSel(avatar);
    setRoleSel(role);
    setOpen(true);
  };

  const save = () => {
    if (!nameText.trim()) return;
    try {
      window.localStorage.setItem("scrumi.profile", JSON.stringify({ name: nameText.trim(), avatar: avatarSel }));
    } catch {
      // localStorage gesperrt — Vorbelegung entfällt, Speichern läuft trotzdem.
    }
    onSave(nameText.trim(), avatarSel, roleSel);
    setOpen(false);
  };

  const roleLabel = roles.find((r) => r.value === role)?.label ?? "";

  return (
    <div className="fixed bottom-4 left-4 z-40">
      {open ? (
        <div className="card w-[320px] p-4">
          <div className="text-sm font-semibold">Dein Profil</div>
          <input
            aria-label="Dein Name"
            value={nameText}
            onChange={(e) => setNameText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            className="input-field mt-3"
          />
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              aria-label="Kein Avatar"
              title="Kein Avatar"
              onClick={() => setAvatarSel("")}
              className={`flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border text-[12px] text-mid ${
                avatarSel === "" ? "border-accent bg-chip" : "border-edge bg-field"
              }`}
            >
              –
            </button>
            {AVATAR_EMOJIS.map((a) => (
              <button
                key={a}
                type="button"
                aria-label={`Avatar ${a}`}
                onClick={() => setAvatarSel(a)}
                className={`flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border text-[15px] ${
                  avatarSel === a ? "border-accent bg-chip" : "border-edge bg-field hover:border-tipline"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3">
            <div className="text-[12px] font-medium text-mid">Rolle</div>
            {roles.map((r) => (
              <label key={r.value} className="flex cursor-pointer items-center gap-2 text-[13px] text-mid">
                <input
                  type="radio"
                  name="dock-role"
                  checked={roleSel === r.value}
                  onChange={() => setRoleSel(r.value)}
                  className="h-4 w-4 accent-[#6e8ff6]"
                />
                <span className="font-medium text-fg">{r.label}</span>
                <span className="text-[12px] text-dim">— {r.hint}</span>
              </label>
            ))}
          </div>
          <div className="mt-3.5 flex gap-2">
            <button type="button" onClick={save} className="btn-primary px-4 py-2">
              Speichern
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary px-3.5 py-2">
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          aria-label="Profil bearbeiten"
          title="Name, Avatar und Rolle ändern"
          onClick={openDock}
          className="card flex items-center gap-2.5 px-3 py-2 text-left hover:bg-raise"
        >
          <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full border border-accent bg-chip text-[17px] leading-none">
            {avatar || (
              <span className="text-[13px] font-semibold text-accent">{name.charAt(0).toUpperCase()}</span>
            )}
          </span>
          <span className="min-w-0">
            <span className="block max-w-[150px] truncate text-[13px] font-semibold text-fg">{name}</span>
            <span className="block text-[11px] text-dim">{roleLabel}</span>
          </span>
          <span className="flex-none text-[13px] text-dim">✎</span>
        </button>
      )}
    </div>
  );
}
