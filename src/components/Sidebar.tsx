"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const NAV_GROUPS = [
  {
    title: "Analyse",
    items: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/burndown", label: "Burndown" },
      { href: "/velocity", label: "Velocity" },
      { href: "/capacity", label: "Kapazität" },
    ],
  },
  {
    title: "Verwaltung",
    items: [{ href: "/settings/teams", label: "Teams / Jira" }],
  },
];

export function Sidebar({ jiraHost }: { jiraHost: string | null }) {
  const pathname = usePathname();
  const qs = useSearchParams().toString();

  return (
    <aside className="sticky top-0 flex h-screen w-[236px] flex-none flex-col gap-[26px] border-r border-line bg-[rgba(11,14,20,0.55)] px-3.5 py-[22px]">
      <div className="flex items-center gap-2.5 px-2">
        <div className="h-[22px] w-[22px] rounded-[7px] bg-gradient-to-br from-[#A5BAFF] to-[#5E80EE] shadow-[0_3px_12px_rgba(124,156,255,0.4)]" />
        <div className="text-base font-semibold tracking-[-0.01em]">Scrumi</div>
        <div className="ml-auto font-mono text-[10px] text-faint">v1.0</div>
      </div>

      <nav className="flex flex-col gap-0.5">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.title} className="flex flex-col gap-0.5">
            <div className={`px-2 pb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-faint ${gi > 0 ? "pt-[18px]" : ""}`}>
              {group.title}
            </div>
            {group.items.map((item) => {
              const active = pathname === item.href;
              const href = qs ? `${item.href}?${qs}` : item.href;
              return (
                <Link
                  key={item.href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] ${
                    active
                      ? "bg-gradient-to-r from-[rgba(124,156,255,0.17)] to-[rgba(124,156,255,0.03)] text-fg"
                      : "text-muted hover:bg-navhover"
                  }`}
                >
                  <span className={`h-[5px] w-[5px] rounded-full ${active ? "bg-accent" : "bg-tipline"}`} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-auto rounded-[10px] border border-line bg-panel p-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">Jira Cloud</div>
        <div className="mt-2 flex items-center gap-[7px] text-[12.5px] text-mid">
          <span className={`h-1.5 w-1.5 rounded-full ${jiraHost ? "bg-ok" : "bg-faint"}`} />
          {jiraHost ? "verbunden" : "nicht konfiguriert"}
        </div>
        {jiraHost && <div className="mt-1 font-mono text-[11px] text-faint">{jiraHost}</div>}
      </div>
    </aside>
  );
}
