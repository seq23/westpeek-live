"use server";

import { revalidatePath } from "next/cache";
import { requireLiveEventControlAccessForRequest } from "@/lib/auth/liveControlRequestGuard";
import type { CrewAction } from "@/lib/auth/crewRolePermissions";
import { clearRoomFallbackOverride, getRoomFallbackState, runRoomHealthCheck, switchRoomFallback } from "@/services/video/roomFallbackService";
import type { V4RoomType, V4VideoProvider } from "@/types/v4";

/**
 * The same guard as every other live control: owner and operator pass; a crew cookie must be for
 * this event, still current (not revoked by a host-link rotation), and its real role allowed.
 */
async function requireVideoControl(eventId: string, action: CrewAction) {
  if (!eventId) throw new Error("Choose the event first.");
  const auth = await requireLiveEventControlAccessForRequest(eventId, action);
  if (!auth.ok) throw new Error(auth.error);
}

export async function runVideoHealthCheckAction(formData: FormData) {
  const eventId = String(formData.get("eventId") || "");
  const roomType = String(formData.get("roomType") || "main_stage") as V4RoomType;
  await requireVideoControl(eventId, "run_video_health_check");
  await runRoomHealthCheck(eventId, roomType, "technical_director");
  revalidatePath(`/app/events/${eventId}/video-health`);
}

export async function switchRoomFallbackAction(formData: FormData) {
  const eventId = String(formData.get("eventId") || "");
  const roomType = String(formData.get("roomType") || "main_stage") as V4RoomType;
  const provider = String(formData.get("provider") || "daily") as V4VideoProvider;
  const confirmedByCrew = String(formData.get("confirmedByCrew") || "") === "true";
  await requireVideoControl(eventId, "switch_video_fallback");
  const state = await getRoomFallbackState(eventId, roomType);
  await switchRoomFallback({ state, provider, confirmedByCrew, actorRole: "technical_director", reason: `operator_requested_${provider}` });
  revalidatePath(`/app/events/${eventId}/video-health`);
}

export async function clearRoomFallbackOverrideAction(formData: FormData) {
  const eventId = String(formData.get("eventId") || "");
  const roomType = String(formData.get("roomType") || "main_stage") as V4RoomType;
  await requireVideoControl(eventId, "clear_video_fallback");
  const state = await getRoomFallbackState(eventId, roomType);
  await clearRoomFallbackOverride(state, "technical_director");
  revalidatePath(`/app/events/${eventId}/video-health`);
}
