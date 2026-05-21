"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface Option {
  id: string;
  name: string;
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

  const selectClass = "rounded bg-slate-800 px-3 py-1.5 text-sm";

  return (
    <div className="flex items-center gap-3">
      <select
        aria-label="Team"
        className={selectClass}
        value={params.get("team") ?? ""}
        onChange={(e) => update("team", e.target.value)}
      >
        {teams.length === 0 && <option value="">Kein Team</option>}
        {teams.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <select
        aria-label="Sprint"
        className={selectClass}
        value={params.get("sprint") ?? ""}
        onChange={(e) => update("sprint", e.target.value)}
      >
        {sprints.length === 0 && <option value="">Kein Sprint</option>}
        {sprints.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
    </div>
  );
}
