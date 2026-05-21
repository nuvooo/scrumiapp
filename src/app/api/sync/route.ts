import { NextResponse } from "next/server";
import { syncAllTeams } from "@/lib/sync/syncAll";

export const dynamic = "force-dynamic";

/** Löst sofort einen Sync aller Teams aus (Komfort/Fallback-Button im UI). */
export async function POST() {
  try {
    await syncAllTeams();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
