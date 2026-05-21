"use server";

import { revalidatePath } from "next/cache";
import { upsertCapacityEntry } from "@/lib/repositories/capacityRepository";

export async function upsertCapacity(formData: FormData) {
  const sprintId = String(formData.get("sprintId") ?? "");
  const teamMemberId = String(formData.get("teamMemberId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const plannedPersonDays = Number(formData.get("plannedPersonDays") ?? "0");
  const actualPersonDays = Number(formData.get("actualPersonDays") ?? "0");
  if (!sprintId || !teamMemberId || !name) return;
  if (!Number.isFinite(plannedPersonDays) || plannedPersonDays < 0) return;
  if (!Number.isFinite(actualPersonDays) || actualPersonDays < 0) return;

  await upsertCapacityEntry(sprintId, teamMemberId, { name, plannedPersonDays, actualPersonDays });
  revalidatePath("/capacity");
  revalidatePath("/dashboard");
}
