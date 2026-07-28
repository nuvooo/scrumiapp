"use server";

import { revalidatePath } from "next/cache";
import { upsertCapacityEntry } from "@/lib/repositories/capacityRepository";

export async function upsertCapacity(formData: FormData) {
  const sprintId = String(formData.get("sprintId") ?? "");
  const teamMemberId = String(formData.get("teamMemberId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  // Roster-Felder sind Freitext, deshalb auch Kommawerte ("8,5") akzeptieren
  const plannedPersonDays = Number(String(formData.get("plannedPersonDays") ?? "0").replace(",", "."));
  const actualPersonDays = Number(String(formData.get("actualPersonDays") ?? "0").replace(",", "."));
  if (!sprintId || !teamMemberId || !name) return;
  if (!Number.isFinite(plannedPersonDays) || plannedPersonDays < 0) return;
  if (!Number.isFinite(actualPersonDays) || actualPersonDays < 0) return;

  await upsertCapacityEntry(sprintId, teamMemberId, { name, plannedPersonDays, actualPersonDays });
  // PT fließen in Effizienz und Prognose ein — alle betroffenen Ansichten aktualisieren
  revalidatePath("/capacity");
  revalidatePath("/dashboard");
  revalidatePath("/velocity");
}
