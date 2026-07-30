"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_GROUPS } from "@/lib/view/nav";

/** Burger-Button + Slide-in-Menü — nur unter lg sichtbar (Desktop hat die Sidebar). */
export function MobileNav({ jiraHost }: { jiraHost: string | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const qs = useSearchParams().toString();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label="Menü öffnen"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 flex-col items-center justify-center gap-[5px] rounded-lg border border-edge bg-field"
      >
        <span className="h-px w-4 bg-fg" />
        <span className="h-px w-4 bg-fg" />
        <span className="h-px w-4 bg-fg" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex h-full w-[264px] flex-col gap-[26px] border-r border-line bg-[#0B0E14] px-3.5 py-[22px]">
            <div className="flex items-center gap-2.5 px-2">
              <Image src="/scrumi-logo.png" alt="Scrumi-Logo" width={26} height={26} />
              <div className="text-base font-semibold tracking-[-0.01em]">Scrumi</div>
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
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[14px] ${
                          active
                            ? "bg-gradient-to-r from-[rgba(124,156,255,0.17)] to-[rgba(124,156,255,0.03)] text-fg"
                            : "text-muted"
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
          </div>
          <button
            type="button"
            aria-label="Menü schließen"
            onClick={() => setOpen(false)}
            className="flex-1 bg-[rgba(4,6,10,0.6)] backdrop-blur-sm"
          />
        </div>
      )}
    </div>
  );
}
