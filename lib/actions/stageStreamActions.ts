"use server";
import { revalidatePath } from "next/cache";
import { requireLiveEventControlAccessForRequest } from "@/lib/auth/liveControlRequestGuard";
import { provisionStreamYardLiveKitIngress } from "@/services/video/livekitIngressService";
import { applyStageStreamSignal } from "@/services/video/stageStreamStateService";
import { endShowForEvent } from "@/services/video/showEndService";
import type { StageStreamSignal } from "@/types/stageStream";

/** Owner, operator, or event-scoped crew. Attendees and anonymous callers are refused before any write. */
async function requireControl(eventId: string) {
  const auth = await requireLiveEventControlAccessForRequest(eventId);
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
