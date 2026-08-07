"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface Option {
  id: string;
  name: string;
}

function LabeledSelect({
  label,
  value,
  options,
  emptyLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  emptyLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint">{label}</span>
      <div className="relative">
        <select
          aria-label={label}
          className="cursor-pointer appearance-none rounded-[9px] border border-edge bg-field py-[7px] pl-[11px] pr-[30px] text-[13px] text-fg"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.length === 0 && <option value="">{emptyLabel}</option>}
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-faint">▾</span>
      </div>
    </div>
  );
}

/** Auswahl in die URL schreiben — Seiten lesen team/sprint aus den Query-Parametern. */
function useSelectionUpdate() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (key: "team" | "sprint", value: string) => {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    if (key === "team") next.delete("sprint");
    router.push(`${pathname}?${next.toString()}`);
  };
}

/** Team-Wahl (Verwaltung) — gilt für alle Seiten; ein Teamwechsel setzt den Sprint zurück. */
export function TeamSelect({ teams, value }: { teams: Option[]; value: string }) {
  const update = useSelectionUpdate();
  return (
    <LabeledSelect label="Team" value={value} options={teams} emptyLabel="Kein Team" onChange={(v) => update("team", v)} />
  );
}

/** Sprint-Wahl direkt auf einer Analyse-Seite (z. B. Burndown) — der aktive Sprint ist vorausgewählt. */
export function SprintSelect({ sprints, value }: { sprints: Option[]; value: string }) {
  const update = useSelectionUpdate();
  return (
    <LabeledSelect
      label="Sprint"
      value={value}
      options={sprints}
      emptyLabel="Kein Sprint"
      onChange={(v) => update("sprint", v)}
    />
  );
}
