"use client";

import { useState } from "react";

/** Kleiner Eingabe-Dialog (Ersatz für window.prompt) — z. B. „Neue Bahn". */
export function RoadmapPromptDialog({
  title,
  label,
  placeholder,
  confirmLabel,
  pending,
  onClose,
  onSubmit,
}: {
  title: string;
  label: string;
  placeholder?: string;
  confirmLabel: string;
  pending: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState("");

  const submit = () => {
    if (value.trim()) onSubmit(value.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm px-[18px] py-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <label className="mt-3.5 block">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">{label}</span>
          <input
            type="text"
            value={value}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={placeholder}
            className="mt-1 w-full rounded-[7px] border border-edge bg-field px-2.5 py-1.5 text-[13px] text-fg"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary px-3.5 py-[7px]">
            Abbrechen
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !value.trim()}
            className="btn-primary px-3.5 py-[7px] disabled:opacity-40"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
