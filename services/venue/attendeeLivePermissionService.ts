import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import type { AttendeeLiveCapability, AttendeeLiveControlState, AttendeeLiveDecision, AttendeeLiveRoomKind } from "@/types/attendeeLive";

export function attendeeLiveCapabilityKey(eventId: string, roomKind: AttendeeLiveRoomKind, roomId: string, attendeeId: string) {
  return `${eventId}:${roomKind}:${roomId}:${attendeeId}`;
}

export function attendeeLiveControlKey(eventId: string, roomKind: AttendeeLiveRoomKind, roomId: string) {
  return `${eventId}:${roomKind}:${roomId}`;
}

export function defaultLiveControlState(eventId: string, roomKind: AttendeeLiveRoomKind, roomId: string): AttendeeLiveControlState {
  return {
    eventId,
    roomKind,
    roomId,
    globalCameraEnabled: roomKind !== "main_stage",
    globalMicrophoneEnabled: roomKind !== "main_stage",
    globalScreenShareEnabled: false,
    requestRequired: roomKind === "main_stage",
    attendeeJoinRequiresApproval: false,
    emergencyPublishingDisabled: false,
    updatedAt: new Date().toISOString(),
  };
}

export async function getAttendeeLiveControlState(eventId: string, roomKind: AttendeeLiveRoomKind, roomId: string) {
  const key = attendeeLiveControlKey(eventId, roomKind, roomId);
  const existing = await getRuntimeStore().getAttendeeLiveControlState(key).catch(() => undefined);
  return existing || defaultLiveControlState(eventId, roomKind, roomId);
}

export async function setAttendeeLiveControlState(state: AttendeeLiveControlState) {
  return getRuntimeStore().setAttendeeLiveControlState(attendeeLiveControlKey(state.eventId, state.roomKind, state.roomId), { ...state, updatedAt: new Date().toISOString() });
}

export async function getAttendeeLiveCapability(eventId: string, roomKind: AttendeeLiveRoomKind, roomId: string, attendeeId: string) {
  const key = attendeeLiveCapabilityKey(eventId, roomKind, roomId, attendeeId);
  return getRuntimeStore().getAttendeeLiveCapability(key);
}

export async function setAttendeeLiveCapability(capability: AttendeeLiveCapability) {
  return getRuntimeStore().setAttendeeLiveCapability(attendeeLiveCapabilityKey(capability.eventId, capability.roomKind, capability.roomId, capability.attendeeId), { ...capability, updatedAt: new Date().toISOString() });
}


export function evaluateAttendeeLiveAccess(input: {
  control: AttendeeLiveControlState;
  capability?: AttendeeLiveCapability;
  roomKind: AttendeeLiveRoomKind;
}) {
  const { control, capability, roomKind } = input;
  if (control.emergencyPublishingDisabled && capability?.revoked) {
    return { canJoin: false, reason: capability.revokedReason || "Crew revoked live-event access.", status: "revoked" as const };
  }
  if (capability?.revoked) {
    return { canJoin: false, reason: capability.revokedReason || "Crew revoked live-event access.", status: "revoked" as const };
  }
  if (roomKind === "main_stage" && control.attendeeJoinRequiresApproval && !capability?.canJoinLiveStream) {
    return { canJoin: false, reason: "Live-event access is waiting for crew approval.", status: "waiting_for_approval" as const };
  }
  return { canJoin: true, reason: "Live-event access is permitted.", status: capability?.canJoinLiveStream ? "permitted" as const : "open" as const };
}

export async function canAttendeeJoinLive(input: { eventId: string; roomKind: AttendeeLiveRoomKind; roomId: string; attendeeId: string }) {
  const [control, capability] = await Promise.all([
    getAttendeeLiveControlState(input.eventId, input.roomKind, input.roomId),
    getAttendeeLiveCapability(input.eventId, input.roomKind, input.roomId, input.attendeeId),
  ]);
  return evaluateAttendeeLiveAccess({ control, capability, roomKind: input.roomKind });
}

export async function canAttendeePublishLive(input: { eventId: string; roomKind: AttendeeLiveRoomKind; roomId: string; attendeeId: string }) {
  const [control, capability] = await Promise.all([
    getAttendeeLiveControlState(input.eventId, input.roomKind, input.roomId),
    getAttendeeLiveCapability(input.eventId, input.roomKind, input.roomId, input.attendeeId),
  ]);
  const join = evaluateAttendeeLiveAccess({ control, capability, roomKind: input.roomKind });
  if (!join.canJoin) return { canPublishAudio: false, canPublishVideo: false, canShareScreen: false, reason: join.reason };
  if (control.emergencyPublishingDisabled) return { canPublishAudio: false, canPublishVideo: false, canShareScreen: false, reason: "Crew disabled attendee publishing during live operations." };
  if (input.roomKind === "main_stage" && !capability?.approvedForStage) return { canPublishAudio: false, canPublishVideo: false, canShareScreen: false, reason: "Main stage publishing requires crew approval." };
  return {
    canPublishAudio: control.globalMicrophoneEnabled && Boolean(capability?.canPublishMicrophone || input.roomKind !== "main_stage"),
    canPublishVideo: control.globalCameraEnabled && Boolean(capability?.canPublishCamera || input.roomKind !== "main_stage"),
    canShareScreen: control.globalScreenShareEnabled && Boolean(capability?.canShareScreen),
    reason: "Publishing allowed by crew controls.",
  };
}

// ---- One-click crew decisions ------------------------------------------------

function emptyCapability(eventId: string, roomKind: AttendeeLiveRoomKind, roomId: string, attendeeId: string): AttendeeLiveCapability {
  return { eventId, roomKind, roomId, attendeeId, canJoinLiveStream: false, canPublishCamera: false, canPublishMicrophone: false, canShareScreen: false, approvedForStage: false, revoked: false, updatedAt: new Date().toISOString() };
}

/**
 * The attendee asked to join the stage. Records the request without granting anything;
 * a previous decline is superseded by the new request.
 */
export function requestedCapability(previous: AttendeeLiveCapability | undefined, base: { eventId: string; roomKind: AttendeeLiveRoomKind; roomId: string; attendeeId: string }): AttendeeLiveCapability {
  const current = previous || emptyCapability(base.eventId, base.roomKind, base.roomId, base.attendeeId);
  return { ...current, requestStatus: "requested", requestedAt: new Date().toISOString(), decidedAt: undefined, updatedAt: new Date().toISOString() };
}

/**
 * Pure: the next capability for a crew decision. Exported so the ordering rules are unit-testable
 * without a store.
 *   permit           → may watch the live stage (join); publishing untouched; un-revokes.
 *   approve_publish  → may watch AND publish camera + mic on the stage; closes a pending request as approved.
 *   revoke           → nothing; revoked with reason; a pending request is closed as declined.
 *   decline          → the request is closed as declined; nothing else changes.
 *   reset            → back to "registered, no decision": no grants, not revoked, no request.
 */
export function decideCapability(previous: AttendeeLiveCapability | undefined, input: { eventId: string; roomKind: AttendeeLiveRoomKind; roomId: string; attendeeId: string; decision: AttendeeLiveDecision; actorRole: string; reason?: string }): AttendeeLiveCapability {
  const now = new Date().toISOString();
  const current = previous || emptyCapability(input.eventId, input.roomKind, input.roomId, input.attendeeId);
  const closeRequest = (status: "approved" | "declined") => (current.requestStatus === "requested" ? { requestStatus: status, decidedAt: now } : {});
  if (input.decision === "permit") {
    return { ...current, canJoinLiveStream: true, revoked: false, revokedReason: undefined, updatedBy: input.actorRole, updatedAt: now };
  }
  if (input.decision === "approve_publish") {
    return { ...current, canJoinLiveStream: true, canPublishCamera: true, canPublishMicrophone: true, approvedForStage: true, revoked: false, revokedReason: undefined, requestStatus: "approved", decidedAt: now, updatedBy: input.actorRole, updatedAt: now };
  }
  if (input.decision === "reset") {
    return { ...emptyCapability(input.eventId, input.roomKind, input.roomId, input.attendeeId), updatedBy: input.actorRole, updatedAt: now };
  }
  if (input.decision === "decline") {
    return { ...current, ...closeRequest("declined"), requestStatus: "declined", decidedAt: now, updatedBy: input.actorRole, updatedAt: now };
  }
  return { ...current, canJoinLiveStream: false, canPublishCamera: false, canPublishMicrophone: false, canShareScreen: false, approvedForStage: false, revoked: true, revokedReason: input.reason || "Crew revoked live-event access.", ...closeRequest("declined"), updatedBy: input.actorRole, updatedAt: now };
}

export async function applyAttendeeLiveDecision(input: { eventId: string; roomKind: AttendeeLiveRoomKind; roomId: string; attendeeId: string; decision: AttendeeLiveDecision; actorRole: string; reason?: string }) {
  const previous = await getAttendeeLiveCapability(input.eventId, input.roomKind, input.roomId, input.attendeeId).catch(() => undefined);
  return setAttendeeLiveCapability(decideCapability(previous, input));
}

export async function recordAttendeeStageRequest(input: { eventId: string; roomKind: AttendeeLiveRoomKind; roomId: string; attendeeId: string }) {
  const previous = await getAttendeeLiveCapability(input.eventId, input.roomKind, input.roomId, input.attendeeId).catch(() => undefined);
  return setAttendeeLiveCapability(requestedCapability(previous, input));
}
