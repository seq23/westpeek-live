import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { refusePreviewWrite } from "@/lib/auth/previewIdentity";
import { LIVE_CHAT_LOCKED_MESSAGE, LIVE_CHAT_SILENCED_MESSAGE, liveChatAttendeeModerationKey, liveChatRoomModerationKey, type LiveChatMessage, type LiveChatModerationState, type LiveChatPostRejection, type LiveChatRoomKind } from "@/types/liveChat";

export type LiveChatViewer = "attendee" | "crew";

/**
 * Attendees never receive hidden messages; crew receive everything so the
 * "hidden by <role>" tag can be shown and the message restored.
 */
export async function listLiveRoomChatMessages(eventId: string, roomKind: LiveChatRoomKind, roomId: string, viewer: LiveChatViewer = "attendee") {
  return getRuntimeStore().listLiveChatMessages(eventId, roomKind, roomId, { includeHidden: viewer === "crew" });
}

export async function appendLiveRoomChatMessage(input: Omit<LiveChatMessage, "id" | "moderationStatus" | "createdAt" | "moderatedBy" | "moderatedAt">) {
  const message: LiveChatMessage = {
    ...input,
    id: `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    moderationStatus: "visible",
    createdAt: new Date().toISOString(),
  };
  return getRuntimeStore().appendLiveChatMessage(message);
}

export interface LiveChatRoomModeration {
  locked: boolean;
  lockedBy?: string;
  lockedAt?: string;
}

export interface LiveChatAttendeeModeration {
  silenced: boolean;
  silencedBy?: string;
  silencedAt?: string;
  reason?: string;
}

export async function getLiveChatRoomModeration(eventId: string, roomKind: LiveChatRoomKind, roomId: string): Promise<LiveChatRoomModeration> {
  const state = await getRuntimeStore().getLiveChatModerationState(liveChatRoomModerationKey(eventId, roomKind, roomId)).catch(() => undefined);
  return state?.locked ? { locked: true, lockedBy: state.updatedBy, lockedAt: state.updatedAt } : { locked: false };
}

export async function getLiveChatAttendeeModeration(eventId: string, roomKind: LiveChatRoomKind, roomId: string, attendeeId: string): Promise<LiveChatAttendeeModeration> {
  const state = await getRuntimeStore().getLiveChatModerationState(liveChatAttendeeModerationKey(eventId, roomKind, roomId, attendeeId)).catch(() => undefined);
  return state?.silenced ? { silenced: true, silencedBy: state.updatedBy, silencedAt: state.updatedAt, reason: state.reason } : { silenced: false };
}

export function rejectionMessage(rejection: LiveChatPostRejection) {
  if (rejection === "silenced") return LIVE_CHAT_SILENCED_MESSAGE;
  if (rejection === "locked") return LIVE_CHAT_LOCKED_MESSAGE;
  if (rejection === "not_registered") return "Register for this event to chat with your real attendee identity.";
  return "Type a message before sending.";
}

export type LiveChatPostResult = { ok: true; message: LiveChatMessage } | { ok: false; rejection: LiveChatPostRejection; reason: string };

/**
 * The one attendee write path. The rules are enforced HERE, not only in the UI:
 * a stale page, a replayed form, or a hand-made request still cannot post into
 * a locked room or past a silence.
 */
export async function postLiveRoomChatMessage(input: { eventId: string; roomKind: LiveChatRoomKind; roomId: string; attendeeId: string; displayName: string; company?: string; message: string }): Promise<LiveChatPostResult> {
  // A preview is never a voice in the room. Refused HERE so a hand-made POST cannot post either.
  refusePreviewWrite(input.attendeeId, "post a chat message");
  const message = input.message.trim();
  if (!message) return { ok: false, rejection: "empty", reason: rejectionMessage("empty") };
  const [room, attendee] = await Promise.all([
    getLiveChatRoomModeration(input.eventId, input.roomKind, input.roomId),
    getLiveChatAttendeeModeration(input.eventId, input.roomKind, input.roomId, input.attendeeId),
  ]);
  if (attendee.silenced) return { ok: false, rejection: "silenced", reason: rejectionMessage("silenced") };
  if (room.locked) return { ok: false, rejection: "locked", reason: rejectionMessage("locked") };
  const saved = await appendLiveRoomChatMessage({ eventId: input.eventId, roomKind: input.roomKind, roomId: input.roomId, attendeeId: input.attendeeId, displayName: input.displayName, company: input.company, message });
  return { ok: true, message: saved };
}

// ---- Crew decisions -------------------------------------------------------

function now() {
  return new Date().toISOString();
}

export async function setLiveChatMessageVisibility(input: { eventId: string; messageId: string; hidden: boolean; actorRole: string }) {
  return getRuntimeStore().updateLiveChatMessageModeration({ id: input.messageId, eventId: input.eventId, moderationStatus: input.hidden ? "hidden" : "visible", moderatedBy: input.actorRole, moderatedAt: now() });
}

export async function setLiveChatAttendeeSilence(input: { eventId: string; roomKind: LiveChatRoomKind; roomId: string; attendeeId: string; silenced: boolean; actorRole: string; reason?: string }) {
  const state: LiveChatModerationState = {
    key: liveChatAttendeeModerationKey(input.eventId, input.roomKind, input.roomId, input.attendeeId),
    eventId: input.eventId,
    roomKind: input.roomKind,
    roomId: input.roomId,
    scope: "attendee",
    attendeeId: input.attendeeId,
    locked: false,
    silenced: input.silenced,
    reason: input.silenced ? input.reason : undefined,
    updatedBy: input.actorRole,
    updatedAt: now(),
  };
  return getRuntimeStore().setLiveChatModerationState(state);
}

export async function setLiveChatRoomLock(input: { eventId: string; roomKind: LiveChatRoomKind; roomId: string; locked: boolean; actorRole: string; reason?: string }) {
  const state: LiveChatModerationState = {
    key: liveChatRoomModerationKey(input.eventId, input.roomKind, input.roomId),
    eventId: input.eventId,
    roomKind: input.roomKind,
    roomId: input.roomId,
    scope: "room",
    locked: input.locked,
    silenced: false,
    reason: input.locked ? input.reason : undefined,
    updatedBy: input.actorRole,
    updatedAt: now(),
  };
  return getRuntimeStore().setLiveChatModerationState(state);
}

export interface LiveChatModerationQueue {
  eventId: string;
  messages: LiveChatMessage[];
  lockedRooms: LiveChatModerationState[];
  silencedAttendees: LiveChatModerationState[];
  /** Attendees silenced anywhere in the event, for the roster and the per-message button state. */
  silencedAttendeeIds: Set<string>;
}

export async function getLiveChatModerationQueue(eventId: string, limit = 40): Promise<LiveChatModerationQueue> {
  const store = getRuntimeStore();
  const [messages, states] = await Promise.all([
    store.listRecentLiveChatMessages(eventId, limit).catch(() => [] as LiveChatMessage[]),
    store.listLiveChatModerationStates(eventId).catch(() => [] as LiveChatModerationState[]),
  ]);
  const lockedRooms = states.filter((state) => state.scope === "room" && state.locked);
  const silencedAttendees = states.filter((state) => state.scope === "attendee" && state.silenced && state.attendeeId);
  return { eventId, messages, lockedRooms, silencedAttendees, silencedAttendeeIds: new Set(silencedAttendees.map((state) => state.attendeeId as string)) };
}

export function liveChatRoomPath(eventId: string, roomKind: LiveChatRoomKind, roomId: string) {
  if (roomKind === "main_stage") return `/venue/${eventId}/stage`;
  if (roomKind === "breakout") return `/venue/${eventId}/breakouts`;
  return `/venue/${eventId}/sessions/${roomId}`;
}
