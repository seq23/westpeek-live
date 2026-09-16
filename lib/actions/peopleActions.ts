"use server";

import { revalidatePath } from "next/cache";
import { getWorkspaceActor } from "@/lib/auth/workspaceActor";
import { archiveTestPeople } from "@/services/attendees/peopleDirectoryService";

/**
 * "Archive test rows": our own Playwright and Tier-4 fixtures leave the People list. Owner only,
 * and it archives — the contact keeps its row with archived_at set and the attendee profiles behind
 * it become `revoked`. A row from a real event is never touched.
 */
export async function archiveTestPeopleAction() {
  const actor = await getWorkspaceActor();
  if (actor?.kind !== "owner") throw new Error("Only the owner can archive test rows.");
  const result = await archiveTestPeople(actor.label);
  revalidatePath("/app/people");
  revalidatePath("/app/owner");
  return result;
}
