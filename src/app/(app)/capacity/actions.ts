"use server";

import { revalidatePath } from "next/cache";
import { addCapacityEntry, removeCapacityEntry } from "@/lib/repositories/capacityRepository";

export async function addCapacity(formData: FormData) {
  const sprintId = String(formData.get("sprintId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const personDays = Number(formData.get("personDays") ?? "0");
  if (!sprintId || !name || !Number.isFinite(personDays) || personDays <= 0) return;

  await addCapacityEntry(sprintId, { name, personDays });
  revalidatePath("/capacity");
  revalidatePath("/dashboard");
}

export async function deleteCapacity(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await removeCapacityEntry(id);
  revalidatePath("/capacity");
  revalidatePath("/dashboard");
}
