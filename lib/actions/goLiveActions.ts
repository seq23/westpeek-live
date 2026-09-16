"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireLiveEventControlAccessForRequest } from "@/lib/auth/liveControlRequestGuard";
import { setEventStatus } from "@/services/events/eventRepository";
import { getWorkspaceActor } from "@/lib/auth/workspaceActor";
import { provisionStreamYardLiveKitIngress } from "@/services/video/livekitIngressService";
import { getOperatorStageStreamState } from "@/services/video/stageStreamStateService";

function clean(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function revalidateGoLiveSurfaces(eventId: string) {
  for (const path of [`/app/events/${eventId}/publish`, `/app/events/${eventId}`, `/crew/events/${eventId}`, "/app/owner", `/venue/${eventId}/lobby`, `/venue/${eventId}/stage`]) revalidatePath(path);
}

/**
 * Going live is ONE action. It used to be two pages: set the status on Publish, then find the RTMP
 * credentials on the crew deck. Now pressing Go live flips the event to live AND leaves the
 * producer holding credentials — minting them only when the event has none, because ending a show
 * releases the key and a restart needs a fresh one.
 */
export async function goLiveAction(formData: FormData) {
  const eventId = clean(formData.get("eventId"));
  const stageId = clean(formData.get("stageId")) || "main-stage";
  if (!eventId) return;
  const auth = await requireLiveEventControlAccessForRequest(eventId, "go_live");
  if (!auth.ok) throw new Error(auth.error);
  const actor = await getWorkspaceActor();
  const state = await getOperatorStageStreamState(eventId, stageId).catch(() => undefined);
  if (!state?.livekitStreamKey) {
    await provisionStreamYardLiveKitIngress({ eventId, stageId, actorRole: auth.actorRole });
  }
  if (actor) await setEventStatus(eventId, "live", actor).catch(() => undefined);
  revalidateGoLiveSurfaces(eventId);
  const back = clean(formData.get("returnTo"));
  if (back) redirect(back);
}

/**
 * "Get stream credentials" when there are none, "New stream key" when replacing a working one.
 * Same server work either way; the card does the naming and the confirm.
 */
export async function getStreamCredentialsAction(formData: FormData) {
  const eventId = clean(formData.get("eventId"));
  const stageId = clean(formData.get("stageId")) || "main-stage";
  if (!eventId) return;
  const auth = await requireLiveEventControlAccessForRequest(eventId, "go_live");
  if (!auth.ok) throw new Error(auth.error);
  await provisionStreamYardLiveKitIngress({ eventId, stageId, actorRole: auth.actorRole });
  revalidateGoLiveSurfaces(eventId);
  const back = clean(formData.get("returnTo"));
  if (back) redirect(back);
}
