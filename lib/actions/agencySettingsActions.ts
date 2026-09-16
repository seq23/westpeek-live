"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireWorkspaceActor, WorkspaceActorRequiredError } from "@/lib/auth/workspaceActor";
import { saveAgencySettings } from "@/services/agencies/agencySettingsService";
import { isRuntimeSchemaMissing } from "@/services/events/eventRepository";
import type { AgencyMemberEntry } from "@/types/runtimeEvent";

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function saveAgencySettingsAction(formData: FormData): Promise<void> {
  let failure = "";
  try {
    const actor = await requireWorkspaceActor();
    if (actor.kind === "operator") throw new Error("Operator access cannot change agency settings.");
    const members: AgencyMemberEntry[] = [];
    for (let index = 0; index < 12; index += 1) {
      const name = field(formData, `member-${index}-name`);
      const email = field(formData, `member-${index}-email`);
      const role = field(formData, `member-${index}-role`);
      if (name || email) members.push({ name, email, role });
    }
    await saveAgencySettings({ agencyName: field(formData, "agencyName"), primaryColor: field(formData, "primaryColor"), accentColor: field(formData, "accentColor"), members }, actor);
    revalidatePath("/app");
    revalidatePath("/app/settings");
  } catch (error) {
    if (error instanceof WorkspaceActorRequiredError) redirect("/production-access/owner?next=/app/settings");
    failure = isRuntimeSchemaMissing(error) ? "The runtime tables are missing in Supabase; run db/migrations/0024_runtime_events.sql first." : error instanceof Error ? error.message : "Could not save settings.";
  }
  redirect(failure ? `/app/settings?error=${encodeURIComponent(failure.slice(0, 160))}` : "/app/settings?saved=1");
}
