import { NextResponse } from "next/server";
import { getSyncProgress } from "@/lib/sync/progress";

export const dynamic = "force-dynamic";

/** Aktueller Fortschritt des laufenden Syncs (für die Anzeige im UI). */
export async function GET() {
  return NextResponse.json(getSyncProgress());
}
