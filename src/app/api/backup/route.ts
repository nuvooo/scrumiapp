import { NextResponse, type NextRequest } from "next/server";
import { exportBackup, importBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";

/** Liefert den kompletten Datenbestand als Backup-Datei zum Download. */
export async function GET() {
  try {
    const backup = await exportBackup();
    const filename = `scrumi-backup-${backup.exportedAt.slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** Ersetzt den kompletten Datenbestand durch das hochgeladene Backup. */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => null);
    const result = await importBackup(payload);
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
