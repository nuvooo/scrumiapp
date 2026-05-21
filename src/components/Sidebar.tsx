"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "📊 Dashboard" },
  { href: "/burndown", label: "📉 Burndown" },
  { href: "/velocity", label: "📈 Velocity" },
  { href: "/capacity", label: "👥 Kapazität" },
  { href: "/settings/teams", label: "⚙ Teams / Jira" },
];

export function Sidebar() {
  const pathname = usePathname();
  const qs = useSearchParams().toString();

  return (
    <nav className="flex w-56 flex-col gap-1 border-r border-slate-800 bg-slate-900 p-4">
      <div className="mb-6 text-xl font-bold">⚡ Scrumi</div>
      {NAV.map((item) => {
        const active = pathname === item.href;
        const href = qs ? `${item.href}?${qs}` : item.href;
        return (
          <Link
            key={item.href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded px-3 py-2 text-sm ${active ? "bg-slate-700 font-semibold" : "hover:bg-slate-800"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
