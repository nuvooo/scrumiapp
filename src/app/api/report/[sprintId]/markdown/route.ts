import { loadReport } from "@/lib/view/loaders";
import { buildReportMarkdown } from "@/lib/report/markdown";

/** Dateiname aus dem Sprintnamen: nur ASCII-Kleinbuchstaben, Ziffern und Bindestriche. */
function slug(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" })[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "sprint";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sprintId: string }> },
) {
  const { sprintId } = await params;
  const report = await loadReport(sprintId);
  if (!report || report.state === "FUTURE") {
    return new Response("Kein Report verfügbar", { status: 404 });
  }
  const markdown = buildReportMarkdown(report.data);
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="sprint-report-${slug(report.data.sprintName)}.md"`,
    },
  });
}
