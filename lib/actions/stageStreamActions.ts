"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireLiveEventControlAccessForRequest } from "@/lib/auth/liveControlRequestGuard";
import type { CrewAction } from "@/lib/auth/crewRolePermissions";
import { provisionStreamYardLiveKitIngress } from "@/services/video/livekitIngressService";
import { applyStageStreamSignal } from "@/services/video/stageStreamStateService";
import { endShowForEvent } from "@/services/video/showEndService";
import type { StageStreamSignal } from "@/types/stageStream";
import { rungReadiness, type LadderSource } from "@/lib/video/fallbackReadiness";
import { getEventBackupRoom, saveEventBackupRoom } from "@/services/video/backupRoomService";

/** Owner, operator, or event-scoped crew whose role may `go_live`. Attendees, anonymous callers, and the other crew roles are refused before any write, with the role reason. */
async function requireControl(eventId: string, action: CrewAction = "go_live") {
  const auth = await requireLiveEventControlAccessForRequest(eventId, action);
  if (!auth.ok) throw new Error(auth.error);
  return auth;
}

function revalidateStageSurfaces(eventId: string) {
  revalidatePath(`/admin/testing/${eventId}`);
  revalidatePath(`/crew/events/${eventId}`);
  revalidatePath(`/app/events/${eventId}`);
  revalidatePath(`/app/events/${eventId}/publish`);
  revalidatePath(`/venue/${eventId}/stage`);
  revalidatePath(`/venue/${eventId}/lobby`);
  revalidatePath(`/app/events/${eventId}/video/main-stage`);
}

export async function generateStreamYardCredentials(formData: FormData) {
  const eventId = String(formData.get("eventId") || "event-summit");
  const stageId = String(formData.get("stageId") || "main-stage");
  const auth = await requireControl(eventId);
  await provisionStreamYardLiveKitIngress({ eventId, stageId, actorRole: auth.actorRole });
  revalidateStageSurfaces(eventId);
}

export async function applyStageStreamOperatorSignal(formData: FormData) {
  const eventId = String(formData.get("eventId") || "event-summit");
  const stageId = String(formData.get("stageId") || "main-stage");
  const signal = String(formData.get("signal") || "manual_switch_to_daily") as StageStreamSignal;
  const reason = String(formData.get("reason") || "Operator selected action from testing console.");
  await requireControl(eventId);
  // A manual move down to a rung with nothing behind it is refused at the server too: the disabled
  // button is the courtesy, this is the guarantee (a black player for the whole room otherwise).
  const manualMove: Partial<Record<StageStreamSignal, LadderSource>> = {
    manual_switch_to_cloudflare_stream: "CLOUDFLARE_STREAM",
    manual_switch_to_daily: "DAILY",
    manual_switch_to_zoom: "ZOOM",
    manual_switch_to_google_meet: "GOOGLE_MEET",
  };
  const target = manualMove[signal];
  if (target) {
    // Zoom and Google Meet are ready when THIS event has a meeting saved, so the readiness read
    // carries the event's Backup rooms row rather than asking the environment.
    const rung = rungReadiness(target, process.env, await getEventBackupRoom(eventId, stageId));
    if (!rung.ready) throw new Error(`Refused: ${rung.reason}`);
  }
  await applyStageStreamSignal({ eventId, stageId, signal, reason });
  revalidateStageSurfaces(eventId);
}

/**
 * END THE SHOW — press this BEFORE stopping the feed.
 *
 * Marks the stage intentionally ended (so the ingress_ended that follows becomes ENDED, not a
 * Daily failover) and sets the event to `ended` (so the same holds even if the stage state is
 * ever reset). Seed events keep their compiled status; the stage mark alone protects them.
 */
export async function endTheShow(formData: FormData): Promise<void> {
  const eventId = String(formData.get("eventId") || "");
  const stageId = String(formData.get("stageId") || "main-stage");
  if (!eventId) return;
  const auth = await requireControl(eventId);
  await endShowForEvent({ eventId, stageId, actorRole: auth.actorRole });
  revalidateStageSurfaces(eventId);
}

/**
 * SAVE THE BACKUP ROOMS — the Zoom meeting and the Google Meet link for this event.
 *
 * Owner, operator, or event-scoped crew who may `go_live`, which is the same gate as moving the room
 * down the ladder: whoever can move to Zoom is whoever can say which Zoom. Both fields are optional
 * and both are editable during the show; the attendee player picks a new value up on its next poll,
 * so nobody has to reload anything.
 *
 * A value that is not a meeting is refused with a sentence saying what is wrong with it, handed back
 * through the query string so the card can show it beside the field rather than throwing a 500 at a
 * crew member who is mid-show.
 */
export async function saveBackupRoomsAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get("eventId") || "");
  const stageId = String(formData.get("stageId") || "main-stage");
  const returnTo = String(formData.get("returnTo") || "");
  if (!eventId) return;
  const auth = await requireControl(eventId);
  const savedBy = auth.actorRole === "crew" ? `crew:${auth.crewRole}` : auth.actorRole;
  const result = await saveEventBackupRoom({
    eventId,
    stageId,
    zoomMeetingNumber: String(formData.get("zoomMeetingNumber") || ""),
    zoomPasscode: String(formData.get("zoomPasscode") || ""),
    googleMeetUrl: String(formData.get("googleMeetUrl") || ""),
    savedBy,
  });
  revalidateStageSurfaces(eventId);
  if (!returnTo) return;
  const separator = returnTo.includes("?") ? "&" : "?";
  redirect(`${returnTo}${separator}${result.ok ? "backupRooms=saved" : `backupRoomsError=${encodeURIComponent(result.reason || "That could not be saved.")}`}`);
}
