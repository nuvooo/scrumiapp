"use server";

import { revalidatePath } from "next/cache";
import { createTeam, updateTeam, deleteTeam } from "@/lib/repositories/teamRepository";
import { addMember, renameMember, removeMember, setMemberDefaultDays } from "@/lib/repositories/teamMemberRepository";

export async function addTeam(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const jiraBoardId = String(formData.get("jiraBoardId") ?? "").trim();
  const syncIntervalMinutes = Number(formData.get("syncIntervalMinutes") ?? "60");
  if (!name || !jiraBoardId) return;

  await createTeam({
    name,
    jiraBoardId,
    syncIntervalMinutes: Number.isFinite(syncIntervalMinutes) && syncIntervalMinutes > 0 ? syncIntervalMinutes : 60,
  });
  revalidatePath("/settings/teams");
}

export async function editTeam(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const jiraBoardId = String(formData.get("jiraBoardId") ?? "").trim();
  const syncIntervalMinutes = Number(formData.get("syncIntervalMinutes") ?? "60");
  if (!id || !name || !jiraBoardId) return;

  // Datumsfeld liefert "YYYY-MM-DD" (UTC-Mitternacht); leer = Stichtag entfernen, alle Sprints zählen
  const metricsSinceRaw = String(formData.get("metricsSince") ?? "").trim();
  let metricsSince: Date | null = null;
  if (metricsSinceRaw) {
    const parsed = new Date(metricsSinceRaw);
    if (Number.isNaN(parsed.getTime())) return;
    metricsSince = parsed;
  }

  await updateTeam(id, {
    name,
    jiraBoardId,
    syncIntervalMinutes: Number.isFinite(syncIntervalMinutes) && syncIntervalMinutes > 0 ? syncIntervalMinutes : 60,
    metricsSince,
  });
  revalidatePath("/settings/teams");
}

export async function removeTeam(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deleteTeam(id);
  revalidatePath("/settings/teams");
}

/** "8" / "8,5" -> Zahl, leer -> null; ungültig/negativ -> undefined (Abbruch). */
function parseOptionalDays(raw: string): number | null | undefined {
  if (!raw) return null;
  const n = Number.parseFloat(raw.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

export async function createMember(formData: FormData) {
  const teamId = String(formData.get("teamId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!teamId || !name) return;
  const defaultPersonDays = parseOptionalDays(String(formData.get("defaultPersonDays") ?? "").trim());
  if (defaultPersonDays === undefined) return;
  await addMember(teamId, name, defaultPersonDays);
  revalidatePath("/settings/teams");
  revalidatePath("/capacity");
}

export async function editMemberDays(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const defaultPersonDays = parseOptionalDays(String(formData.get("defaultPersonDays") ?? "").trim());
  if (defaultPersonDays === undefined) return;
  await setMemberDefaultDays(id, defaultPersonDays);
  revalidatePath("/settings/teams");
  revalidatePath("/capacity");
}

export async function editMember(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;
  await renameMember(id, name);
  revalidatePath("/settings/teams");
}

export async function deleteMember(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await removeMember(id);
  revalidatePath("/settings/teams");
}
