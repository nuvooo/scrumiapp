"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** Eintrag eines Dropdown-Menüs der Werkzeugleiste. */
export type MenuEntry =
  | {
      key: string;
      icon?: ReactNode;
      label: string;
      /** Zweite Zeile, z. B. der Kontext („in „Retouren““) */
      hint?: string;
      disabled?: boolean;
      danger?: boolean;
      onSelect: () => void;
    }
  | { key: string; separator: true }
  | { key: string; content: ReactNode };

/** Dropdown-Menü mit Auslöser-Button; schließt bei Klick außerhalb, Escape und nach Auswahl. */
export function RoadmapMenu({
  trigger,
  triggerClassName,
  ariaLabel,
  title,
  entries,
  align = "left",
  className = "",
}: {
  trigger: ReactNode;
  triggerClassName: string;
  ariaLabel?: string;
  title?: string;
  entries: MenuEntry[];
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={`rm-dd ${className}`}>
      <button
        type="button"
        className={triggerClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={ariaLabel}
        title={title}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
      </button>
      {open && (
        <div id={menuId} role="menu" className={`rm-menu ${align === "right" ? "right" : ""}`}>
          {entries.map((entry) => {
            if ("separator" in entry) return <div key={entry.key} className="rm-msep" role="separator" />;
            if ("content" in entry) return <div key={entry.key} className="rm-mcontent">{entry.content}</div>;
            return (
              <button
                key={entry.key}
                type="button"
                role="menuitem"
                className={`rm-mi ${entry.danger ? "danger" : ""}`}
                disabled={entry.disabled}
                onClick={() => {
                  setOpen(false);
                  entry.onSelect();
                }}
              >
                <span className="ico" aria-hidden="true">{entry.icon}</span>
                <span>
                  {entry.label}
                  {entry.hint && <span className="hint">{entry.hint}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Icons (16/24-Raster, Strichstärke 1.7) ---------- */

const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const icons = {
  plus: <svg {...svgProps}><path d="M12 5v14M5 12h14" /></svg>,
  chevronDown: <svg {...svgProps}><path d="m6 9 6 6 6-6" /></svg>,
  chevronsUp: <svg {...svgProps}><path d="m7 12 5-5 5 5" /><path d="m7 18 5-5 5 5" /></svg>,
  chevronsDown: <svg {...svgProps}><path d="m7 6 5 5 5-5" /><path d="m7 12 5 5 5-5" /></svg>,
  dependency: <svg {...svgProps}><path d="M5 4v7a3 3 0 0 0 3 3h11" /><path d="m15 10 4 4-4 4" /></svg>,
  sliders: (
    <svg {...svgProps}>
      <path d="M4 7h9M18 7h2M4 17h4M13 17h7" />
      <circle cx="15.5" cy="7" r="2.2" />
      <circle cx="10.5" cy="17" r="2.2" />
    </svg>
  ),
  layers: <svg {...svgProps}><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></svg>,
  folder: <svg {...svgProps}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></svg>,
  rows: <svg {...svgProps}><rect x="3" y="4" width="18" height="7" rx="1.5" /><rect x="3" y="13" width="18" height="7" rx="1.5" /></svg>,
  ticket: (
    <svg {...svgProps}>
      <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z" />
    </svg>
  ),
  target: <svg {...svgProps}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>,
  diamond: <svg {...svgProps}><path d="m12 3 9 9-9 9-9-9 9-9Z" /></svg>,
};
