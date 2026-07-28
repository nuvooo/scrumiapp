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

export function TeamSprintSelector({ teams, sprints }: { teams: Option[]; sprints: Option[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(key: "team" | "sprint", value: string) {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    if (key === "team") next.delete("sprint");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex items-center gap-3">
      <LabeledSelect
        label="Team"
        value={params.get("team") ?? ""}
        options={teams}
        emptyLabel="Kein Team"
        onChange={(v) => update("team", v)}
      />
      <LabeledSelect
        label="Sprint"
        value={params.get("sprint") ?? ""}
        options={sprints}
        emptyLabel="Kein Sprint"
        onChange={(v) => update("sprint", v)}
      />
    </div>
  );
}
