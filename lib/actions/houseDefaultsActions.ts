"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspaceActor } from "@/lib/auth/workspaceActor";
import { parseQuestionLines } from "@/services/attendees/registrationQuestions";
import { saveHouseDefaults, setHouseLogo } from "@/services/agencies/houseDefaultsService";
import { requestHouseLogoUpload } from "@/services/assets/eventAssetService";

function clean(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

/** Every surface a house default reaches, so a change is visible without a reload of the world. */
function revalidateHouseSurfaces() {
  for (const path of ["/app", "/app/settings", "/app/events/new", "/app/email", "/app/capacity"]) revalidatePath(path);
}

/**
 * Save the house defaults. Operator-reachable on purpose — nothing on this page is secret; the
 * access codes and master passwords stay in the owner-only vault in the Owner Console.
 */
export async function saveHouseDefaultsAction(formData: FormData): Promise<void> {
  const actor = await requireWorkspaceActor();
  const result = await saveHouseDefaults({
    fromEmail: clean(formData.get("fromEmail")),
    replyToEmail: clean(formData.get("replyToEmail")),
    defaultTimezone: clean(formData.get("defaultTimezone")),
    defaultNetworkingMatchMinutes: Number(clean(formData.get("defaultNetworkingMatchMinutes"))),
    defaultAttendeeSessionDays: Number(clean(formData.get("defaultAttendeeSessionDays"))),
    defaultRegistrationQuestions: parseQuestionLines(clean(formData.get("defaultRegistrationQuestions"))),
    livekitTier: clean(formData.get("livekitTier")),
  }, actor);
  revalidateHouseSurfaces();
  if (!result.ok) redirect(`/app/settings?error=${encodeURIComponent(result.reason)}`);
  redirect("/app/settings?savedDefaults=1");
}

/** Step one of the logo upload: the browser PUTs the bytes, the Worker never carries the file. */
export async function requestHouseLogoUploadAction(input: { fileName: string; mimeType: string; sizeBytes: number }) {
  await requireWorkspaceActor();
  return requestHouseLogoUpload(input);
}

/** Step two: record where it landed, so every surface that renders the wordmark can render this instead. */
export async function confirmHouseLogoUploadAction(input: { storagePath: string; fileName: string }) {
  const actor = await requireWorkspaceActor();
  await setHouseLogo(input, actor);
  revalidateHouseSurfaces();
  return { ok: true as const };
}

/** Take the logo back off. The wordmark returns; the object stays in the bucket, unreferenced. */
export async function clearHouseLogoAction(): Promise<void> {
  const actor = await requireWorkspaceActor();
  await setHouseLogo({ storagePath: "", fileName: "" }, actor);
  revalidateHouseSurfaces();
  redirect("/app/settings?savedDefaults=1");
}
