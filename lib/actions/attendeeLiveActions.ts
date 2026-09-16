"use server";
import { revalidatePath } from "next/cache";
import { randomId } from "@/lib/security/portableCrypto";
import { requireLiveEventControlAccessForRequest } from "@/lib/auth/liveControlRequestGuard";
import { applyAttendeeLiveDecision, getAttendeeLiveCapability, recordAttendeeStageRequest, setAttendeeLiveCapability, setAttendeeLiveControlState } from "@/services/venue/attendeeLivePermissionService";
import { getCurrentAttendeeIdentity } from "@/services/attendees/attendeeSessionService";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { removeLiveKitParticipantFromMainStage } from "@/services/video/livekitParticipantAdmin";
import type { AttendeeLiveDecision, AttendeeLiveRoomKind } from "@/types/attendeeLive";

function bool(value: FormDataEntryValue | null) {
  return value === "true" || value === "on" || value === "1";
}

/** Every surface that renders the roster, the pending queue, or the attendee's own stage state. */
function revalidateLiveSurfaces(eventId: string) {
  revalidatePath(`/admin/testing/${eventId}`);
  revalidatePath(`/crew/events/${eventId}`);
  revalidatePath(`/app/events/${eventId}`);
  revalidatePath(`/venue/${eventId}/stage`);
}

async function requireControl(eventId: string) {
  const auth = await requireLiveEventControlAccessForRequest(eventId);
  if (!auth.ok) throw new Error(auth.error);
  return auth;
}

async function recordAttendeeLiveDecision(input: { eventId: string; roomId: string; actorRole: string; action: string; attendeeId?: string; reason?: string }) {
  await getRuntimeStore().appendStageStreamEvent({
    id: randomId("attendee-live-action"),
    eventId: input.eventId,
    stageId: input.roomId,
    signal: "attendee_access_decision",
    nextSource: "LIVEKIT_INGRESS",
    failurePlane: "NONE",
    message: `${input.actorRole} ${input.action}${input.attendeeId ? ` attendee ${input.attendeeId}` : ""}${input.reason ? `: ${input.reason}` : ""}`,
    createdAt: new Date().toISOString(),
  }).catch(() => undefined);
}

export async function updateAttendeeLiveControl(formData: FormData) {
  const eventId = String(formData.get("eventId") || "");
  const roomKind = String(formData.get("roomKind") || "main_stage") as AttendeeLiveRoomKind;
  const roomId = String(formData.get("roomId") || "main-stage");
  const auth = await requireControl(eventId);
  await setAttendeeLiveControlState({ eventId, roomKind, roomId, globalCameraEnabled: bool(formData.get("globalCameraEnabled")), globalMicrophoneEnabled: bool(formData.get("globalMicrophoneEnabled")), globalScreenShareEnabled: bool(formData.get("globalScreenShareEnabled")), requestRequired: bool(formData.get("requestRequired")), attendeeJoinRequiresApproval: bool(formData.get("attendeeJoinRequiresApproval")), emergencyPublishingDisabled: bool(formData.get("emergencyPublishingDisabled")), updatedAt: new Date().toISOString() });
  await recordAttendeeLiveDecision({ eventId, roomId, actorRole: auth.actorRole, action: `updated ${roomKind} live control state` });
  revalidateLiveSurfaces(eventId);
}

export async function requestAttendeeStageAccess(formData: FormData) {
  const eventId = String(formData.get("eventId") || "");
  const roomKind = String(formData.get("roomKind") || "main_stage") as AttendeeLiveRoomKind;
  const roomId = String(formData.get("roomId") || "main-stage");
  const identity = await getCurrentAttendeeIdentity(eventId);
  if (!identity) return;
  const attendeeId = identity.attendeeId;
  // Records the request as pending (requestStatus "requested"); grants nothing until the crew decides.
  await recordAttendeeStageRequest({ eventId, roomKind, roomId, attendeeId });
  await recordAttendeeLiveDecision({ eventId, roomId, actorRole: "attendee", action: "requested live stage access for", attendeeId });
  revalidateLiveSurfaces(eventId);
}

const DECISION_LABEL: Record<AttendeeLiveDecision, string> = {
  permit: "permitted live access for",
  approve_publish: "approved stage publishing (camera + mic) for",
  revoke: "revoked live access for",
  decline: "declined the stage request of",
  reset: "reset live access to registered-only for",
};

/** One-click roster decision: permit | approve_publish | revoke | decline | reset. */
export async function decideAttendeeLiveAccess(formData: FormData) {
  const eventId = String(formData.get("eventId") || "");
  const roomKind = String(formData.get("roomKind") || "main_stage") as AttendeeLiveRoomKind;
  const roomId = String(formData.get("roomId") || "main-stage");
  const attendeeId = String(formData.get("attendeeId") || "");
  const raw = String(formData.get("decision") || "");
  const decision: AttendeeLiveDecision | undefined = raw === "permit" || raw === "approve_publish" || raw === "revoke" || raw === "decline" || raw === "reset" ? raw : undefined;
  if (!eventId || !attendeeId || !decision) return;
  const auth = await requireControl(eventId);
  const reason = String(formData.get("reason") || "").trim() || undefined;
  await applyAttendeeLiveDecision({ eventId, roomKind, roomId, attendeeId, decision, actorRole: auth.actorRole, reason });
  const livekitParticipantRemoval = decision === "revoke" && roomKind === "main_stage" ? await removeLiveKitParticipantFromMainStage({ eventId, stageId: roomId, attendeeId }).catch(() => ({ status: "failed" as const })) : undefined;
  await recordAttendeeLiveDecision({ eventId, roomId, actorRole: auth.actorRole, action: DECISION_LABEL[decision], attendeeId, reason: decision === "revoke" ? `${reason || "Crew revoked live-event access."} LiveKit removal: ${livekitParticipantRemoval?.status || "not_needed"}` : reason });
  revalidateLiveSurfaces(eventId);
}

export async function setAttendeeLiveApproval(formData: FormData) {
  const eventId = String(formData.get("eventId") || "");
  const roomKind = String(formData.get("roomKind") || "main_stage") as AttendeeLiveRoomKind;
  const roomId = String(formData.get("roomId") || "main-stage");
  const attendeeId = String(formData.get("attendeeId") || "");
  if (!attendeeId) return;
  const auth = await requireControl(eventId);
  const revoked = bool(formData.get("revoked"));
  const approvedForStage = !revoked && bool(formData.get("approvedForStage"));
  // The manual form is a full overwrite of the flags; the pending request must survive it.
  const existing = await getAttendeeLiveCapability(eventId, roomKind, roomId, attendeeId).catch(() => undefined);
  const closesRequest = existing?.requestStatus === "requested" && (revoked || approvedForStage);
  await setAttendeeLiveCapability({ eventId, roomKind, roomId, attendeeId, canJoinLiveStream: !revoked && bool(formData.get("canJoinLiveStream")), canPublishCamera: !revoked && bool(formData.get("canPublishCamera")), canPublishMicrophone: !revoked && bool(formData.get("canPublishMicrophone")), canShareScreen: !revoked && bool(formData.get("canShareScreen")), approvedForStage, revoked, revokedReason: revoked ? String(formData.get("revokedReason") || "Crew revoked live-event access.") : undefined, requestStatus: closesRequest ? (revoked ? "declined" : "approved") : existing?.requestStatus, requestedAt: existing?.requestedAt, decidedAt: closesRequest ? new Date().toISOString() : existing?.decidedAt, updatedBy: auth.actorRole, updatedAt: new Date().toISOString() });
  const livekitParticipantRemoval = revoked && roomKind === "main_stage" ? await removeLiveKitParticipantFromMainStage({ eventId, stageId: roomId, attendeeId }).catch(() => ({ status: "failed" as const })) : undefined;
  await recordAttendeeLiveDecision({ eventId, roomId, actorRole: auth.actorRole, action: revoked ? "revoked live access for" : "permitted live access for", attendeeId, reason: revoked ? `${String(formData.get("revokedReason") || "Crew revoked live-event access.")} LiveKit removal: ${livekitParticipantRemoval?.status || "not_needed"}` : undefined });
  revalidateLiveSurfaces(eventId);
}
