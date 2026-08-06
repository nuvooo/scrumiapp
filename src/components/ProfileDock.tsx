"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AVATAR_EMOJIS } from "@/lib/view/refinementState";

export interface DockRole {
  value: string;
  label: string;
  hint: string;
}

export const REFINEMENT_ROLES: DockRole[] = [
  { value: "estimator", label: "Schätzer", hint: "sitzt am Tisch und stimmt ab" },
  { value: "moderator", label: "Moderator", hint: "deckt auf und übernimmt Schätzungen" },
  { value: "visitor", label: "Besucher", hint: "schaut nur zu" },
];

export const RETRO_ROLES: DockRole[] = [
  { value: "member", label: "Teilnehmer", hint: "schreibt Karten und votet" },
  { value: "moderator", label: "Moderator", hint: "Spalten, Verdeckt-Modus, Mergen" },
];

export interface StoredProfile {
  name: string;
  avatar: string;
  refinementRole: string;
  retroRole: string;
}

const PROFILE_KEY = "scrumi.profile";
/** Dock aktualisiert seine Anzeige. */
const UPDATED_EVENT = "scrumi:profile-updated";
/** Explizites Speichern — aktive Räume übernehmen die Änderung in die Session. */
const SAVED_EVENT = "scrumi:profile-saved";

/** Gespeichertes Profil — belegt Beitritts-Formulare und den Dialog vor. */
export function storedProfile(): StoredProfile {
  const fallback: StoredProfile = { name: "", avatar: "", refinementRole: "estimator", retroRole: "member" };
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<StoredProfile>;
    return {
      name: parsed.name ?? fallback.name,
      avatar: parsed.avatar ?? fallback.avatar,
      refinementRole: parsed.refinementRole ?? fallback.refinementRole,
      retroRole: parsed.retroRole ?? fallback.retroRole,
    };
  } catch {
    return fallback;
  }
}

/** Profil (teilweise) schreiben; notifyRooms=true lässt aktive Räume die Änderung anwenden. */
export function writeProfile(partial: Partial<StoredProfile>, notifyRooms: boolean): StoredProfile {
  const merged = { ...storedProfile(), ...partial };
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(merged));
  } catch {
    // localStorage gesperrt — dann eben ohne Persistenz.
  }
  window.dispatchEvent(new CustomEvent(UPDATED_EVENT));
  if (notifyRooms) window.dispatchEvent(new CustomEvent<StoredProfile>(SAVED_EVENT, { detail: merged }));
  return merged;
}

/** Räume abonnieren explizite Profil-Speicherungen, um sie in die Session zu übernehmen. */
export function onProfileSaved(callback: (profile: StoredProfile) => void): () => void {
  const handler = (e: Event) => callback((e as CustomEvent<StoredProfile>).detail);
  window.addEventListener(SAVED_EVENT, handler);
  return () => window.removeEventListener(SAVED_EVENT, handler);
}

function RoleSection({
  title,
  roles,
  value,
  groupName,
  onChange,
}: {
  title: string;
  roles: DockRole[];
  value: string;
  groupName: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset aria-label={title} className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3">
      <div className="text-[12px] font-medium text-mid">{title}</div>
      {roles.map((r) => (
        <label key={r.value} className="flex cursor-pointer items-center gap-2 text-[13px] text-mid">
          <input
            type="radio"
            name={groupName}
            checked={value === r.value}
            onChange={() => onChange(r.value)}
            className="h-4 w-4 accent-[#6e8ff6]"
          />
          <span className="font-medium text-fg">{r.label}</span>
          <span className="text-[12px] text-dim">— {r.hint}</span>
        </label>
      ))}
    </fieldset>
  );
}

/**
 * Globales Profil, auf jeder Seite unten links sichtbar: in der Sidebar
 * unter der Jira-Karte (per Portal), auf Mobile schwebend. Der Dialog hat
 * zwei Rollen-Sektionen (Refinement und Retro). Beim Speichern übernehmen
 * gerade geöffnete Räume Name, Avatar und ihre jeweilige Rolle sofort.
 */
export function ProfileDock() {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [profile, setProfile] = useState<StoredProfile | null>(null);
  const [open, setOpen] = useState(false);
  const [nameText, setNameText] = useState("");
  const [avatarSel, setAvatarSel] = useState("");
  const [refinementSel, setRefinementSel] = useState("");
  const [retroSel, setRetroSel] = useState("");

  useEffect(() => {
    setSlot(document.getElementById("profile-dock-slot"));
    setProfile(storedProfile());
    const handler = () => setProfile(storedProfile());
    window.addEventListener(UPDATED_EVENT, handler);
    return () => window.removeEventListener(UPDATED_EVENT, handler);
  }, []);

  if (profile === null) return null;

  const openDock = () => {
    const current = storedProfile();
    setNameText(current.name);
    setAvatarSel(current.avatar);
    setRefinementSel(current.refinementRole);
    setRetroSel(current.retroRole);
    setOpen(true);
  };

  const save = () => {
    if (!nameText.trim()) return;
    writeProfile(
      { name: nameText.trim(), avatar: avatarSel, refinementRole: refinementSel, retroRole: retroSel },
      true,
    );
    setOpen(false);
  };

  const refinementLabel = REFINEMENT_ROLES.find((r) => r.value === profile.refinementRole)?.label ?? "";
  const retroLabel = RETRO_ROLES.find((r) => r.value === profile.retroRole)?.label ?? "";

  const chip = (
    <button
      type="button"
      aria-label="Profil bearbeiten"
      title="Name, Avatar und Rollen ändern"
      onClick={openDock}
      className="card flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-raise"
    >
      <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full border border-accent bg-chip text-[17px] leading-none">
        {profile.avatar || (
          <span className="text-[13px] font-semibold text-accent">
            {profile.name ? profile.name.charAt(0).toUpperCase() : "?"}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-fg">{profile.name || "Dein Profil"}</span>
        <span className="block truncate text-[11px] text-dim">
          {refinementLabel} · {retroLabel}
        </span>
      </span>
      <span className="flex-none text-[13px] text-dim">✎</span>
    </button>
  );

  return (
    <>
      {/* Desktop: in der Sidebar unter der Jira-Karte; Mobile: schwebend unten links */}
      {slot && createPortal(chip, slot)}
      <div className={`fixed bottom-4 left-4 z-40 w-[210px] ${slot ? "lg:hidden" : ""}`}>{chip}</div>

      {open && (
        <div
          role="dialog"
          aria-label="Dein Profil"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="card max-h-[86vh] w-full max-w-[380px] overflow-y-auto p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold">Dein Profil</div>
            <input
              aria-label="Dein Name"
              value={nameText}
              onChange={(e) => setNameText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder="Dein Name"
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
            <RoleSection
              title="Rolle im Refinement"
              roles={REFINEMENT_ROLES}
              value={refinementSel}
              groupName="dock-role-refinement"
              onChange={setRefinementSel}
            />
            <RoleSection
              title="Rolle im Retro"
              roles={RETRO_ROLES}
              value={retroSel}
              groupName="dock-role-retro"
              onChange={setRetroSel}
            />
            <div className="mt-3.5 flex gap-2">
              <button type="button" onClick={save} className="btn-primary px-4 py-2">
                Speichern
              </button>
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary px-3.5 py-2">
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
