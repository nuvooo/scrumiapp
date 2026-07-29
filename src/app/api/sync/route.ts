import { NextResponse, type NextRequest } from "next/server";
import { syncAllTeams } from "@/lib/sync/syncAll";

export const dynamic = "force-dynamic";

/**
 * Löst sofort einen Sync aller Teams aus (Komfort/Fallback-Button im UI).
 * Mit ?full=1 werden auch bereits abgeschlossene Sprints neu geladen.
 */
export async function POST(request: NextRequest) {
  try {
    const full = request.nextUrl.searchParams.get("full") === "1";
    await syncAllTeams(undefined, { full });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
