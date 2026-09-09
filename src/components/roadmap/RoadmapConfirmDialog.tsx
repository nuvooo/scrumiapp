"use client";

/** Bestätigungs-Dialog (Ersatz für window.confirm) — mit destruktivem Standard. */
export function RoadmapConfirmDialog({
  title,
  message,
  confirmLabel,
  pending,
  onClose,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm px-[18px] py-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <p className="mt-2.5 text-[13px] leading-relaxed text-mid">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary px-3.5 py-[7px]">
            Abbrechen
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="rounded-[9px] border border-[#5a2a2a] bg-[#1d0e0e] px-3.5 py-[7px] text-[12.5px] text-danger hover:bg-[#2a1414] disabled:opacity-40"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
