"use client";

/** Druck-/PDF- und Markdown-Aktionen des Sprint-Reports — im Druck ausgeblendet. */
export function ReportActions({ markdownUrl }: { markdownUrl: string }) {
  return (
    <div className="flex flex-none gap-2 print:hidden">
      <button type="button" onClick={() => window.print()} className="btn-primary px-4 py-[9px]">
        Drucken / PDF
      </button>
      <a href={markdownUrl} download className="btn-secondary flex items-center px-4 py-[9px]">
        Als Markdown
      </a>
    </div>
  );
}
