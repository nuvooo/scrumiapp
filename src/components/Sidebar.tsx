"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_GROUPS } from "@/lib/view/nav";

const COLLAPSED_KEY = "scrumi.sidebarCollapsed";
/** ProfileDock lauscht darauf und wechselt zwischen Sidebar-Slot und Floating-Chip. */
export const SIDEBAR_TOGGLED_EVENT = "scrumi:sidebar-toggled";

export function Sidebar({ jiraHost }: { jiraHost: string | null }) {
  const pathname = usePathname();
  const qs = useSearchParams().toString();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "1");
  }, []);

  // Nach jedem Umschalten Bescheid geben — erst dann existiert bzw. fehlt der Dock-Slot.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(SIDEBAR_TOGGLED_EVENT));
  }, [collapsed]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      // localStorage gesperrt — dann eben ohne Merken.
    }
  };

  return (
    <aside
      className={`sticky top-0 hidden h-screen flex-none flex-col border-r border-line bg-[#0B0E14] py-[22px] transition-[width] duration-200 lg:flex ${
        collapsed ? "w-[58px] items-center gap-4 px-2" : "w-[236px] gap-[26px] px-3.5"
      }`}
    >
      <div className={collapsed ? "flex flex-col items-center gap-3" : "flex items-center gap-2.5 px-2"}>
        <Image
          src="/scrumi-logo.png"
          alt="Scrumi-Logo"
          width={26}
          height={26}
          className="drop-shadow-[0_3px_12px_rgba(124,156,255,0.4)]"
        />
        {!collapsed && (
          <>
            <div className="text-base font-semibold tracking-[-0.01em]">Scrumi</div>
            <div className="ml-auto font-mono text-[10px] text-faint">v1.0</div>
          </>
        )}
        <button
          type="button"
          aria-label={collapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}
          title={collapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}
          onClick={toggle}
          className="flex h-6 w-6 flex-none items-center justify-center rounded-md border border-edge bg-field text-[11px] text-mid hover:text-fg"
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      {!collapsed && (
        <>
          <nav className="min-h-0 flex-none overflow-y-auto">
            <div className="flex flex-col gap-0.5">
              {NAV_GROUPS.map((group, gi) => (
                <div key={group.title} className="flex flex-col gap-0.5">
                  <div
                    className={`px-2 pb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-faint ${gi > 0 ? "pt-[18px]" : ""}`}
                  >
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
            </div>
          </nav>

          <div className="mt-auto flex flex-col gap-3">
            <div className="rounded-[10px] border border-line bg-panel p-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">Jira Cloud</div>
              <div className="mt-2 flex items-center gap-[7px] text-[12.5px] text-mid">
                <span className={`h-1.5 w-1.5 rounded-full ${jiraHost ? "bg-ok" : "bg-faint"}`} />
                {jiraHost ? "verbunden" : "nicht konfiguriert"}
              </div>
              {jiraHost && <div className="mt-1 font-mono text-[11px] text-faint">{jiraHost}</div>}
            </div>

            {/* Andock-Platz fürs Profil (ProfileDock rendert hier per Portal hinein,
                sobald man in einem Refinement/Retro angemeldet ist). */}
            <div id="profile-dock-slot" />
          </div>
        </>
      )}
    </aside>
  );
}
