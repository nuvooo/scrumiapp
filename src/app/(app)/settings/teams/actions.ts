"use server";

import { revalidatePath } from "next/cache";
import { createTeam } from "@/lib/repositories/teamRepository";

export async function addTeam(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const jiraBoardId = String(formData.get("jiraBoardId") ?? "").trim();
  const syncIntervalMinutes = Number(formData.get("syncIntervalMinutes") ?? "60");
  if (!name || !jiraBoardId) return;

  await createTeam({
    name,
    jiraBoardId,
    syncIntervalMinutes: Number.isFinite(syncIntervalMinutes) ? syncIntervalMinutes : 60,
  });
  revalidatePath("/settings/teams");
}
