import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { applyLiveChatRate, liveChatRateCooldownState } from "@/services/venue/liveChatRateLimit";
import { LIVE_CHAT_LOCKED_MESSAGE, LIVE_CHAT_SILENCED_MESSAGE, liveChatAttendeeModerationKey, liveChatRateKey, liveChatRoomModerationKey, slowModeSecondsOf, type LiveChatDelta, type LiveChatMessage, type LiveChatModerationState, type LiveChatPosterClass, type LiveChatPostRejection, type LiveChatRoomKind, type LiveChatSlowModeSeconds } from "@/types/liveChat";

export type LiveChatViewer = "attendee" | "crew";

/**
 * Attendees never receive hidden messages; crew receive everything so the
 * "hidden by <role>" tag can be shown and the message restored.
 */
export async function listLiveRoomChatMessages(eventId: string, roomKind: LiveChatRoomKind, roomId: string, viewer: LiveChatViewer = "attendee") {
  return getRuntimeStore().listLiveChatMessages(eventId, roomKind, roomId, { includeHidden: viewer === "crew" });
}

export async function appendLiveRoomChatMessage(input: Omit<LiveChatMessage, "id" | "moderationStatus" | "createdAt" | "moderatedBy" | "moderatedAt" | "archivedAt" | "archivedBy"> & { createdAt?: string }) {
  const message: LiveChatMessage = {
    ...input,
    id: `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    moderationStatus: "visible",
    createdAt: input.createdAt || new Date().toISOString(),
  };
  return getRuntimeStore().appendLiveChatMessage(message);
}

export interface LiveChatRoomModeration {
  locked: boolean;
  lockedBy?: string;
  lockedAt?: string;
  /** 0 when slow mode is off. Lives on the same room row as the lock, in its jsonb state. */
  slowModeSeconds: LiveChatSlowModeSeconds;
  slowModeBy?: string;
  /** When the crew last cleared this room, and how many messages that archived. */
  clearedAt?: string;
  clearedBy?: string;
  clearedCount?: number;
}

/** "main_stage:main-stage" — the slow-mode clock is per room, not per event. */
export function liveChatRoomKey(roomKind: LiveChatRoomKind, roomId: string) {
  return `${roomKind}:${roomId}`;
}

export interface LiveChatAttendeeModeration {
  silenced: boolean;
  silencedBy?: string;
  silencedAt?: string;
  reason?: string;
}

export async function getLiveChatRoomModeration(eventId: string, roomKind: LiveChatRoomKind, roomId: string): Promise<LiveChatRoomModeration> {
  const state = await getRuntimeStore().getLiveChatModerationState(liveChatRoomModerationKey(eventId, roomKind, roomId)).catch(() => undefined);
  const settings = { slowModeSeconds: slowModeSecondsOf(state?.slowModeSeconds), slowModeBy: state?.slowModeSeconds ? state.updatedBy : undefined, clearedAt: state?.clearedAt, clearedBy: state?.clearedBy, clearedCount: state?.clearedCount };
  return state?.locked ? { locked: true, lockedBy: state.updatedBy, lockedAt: state.updatedAt, ...settings } : { locked: false, ...settings };
}

export async function getLiveChatAttendeeModeration(eventId: string, roomKind: LiveChatRoomKind, roomId: string, attendeeId: string): Promise<LiveChatAttendeeModeration> {
  const state = await getRuntimeStore().getLiveChatModerationState(liveChatAttendeeModerationKey(eventId, roomKind, roomId, attendeeId)).catch(() => undefined);
  return state?.silenced ? { silenced: true, silencedBy: state.updatedBy, silencedAt: state.updatedAt, reason: state.reason } : { silenced: false };
}

export function rejectionMessage(rejection: LiveChatPostRejection) {
  if (rejection === "silenced") return LIVE_CHAT_SILENCED_MESSAGE;
  if (rejection === "locked") return LIVE_CHAT_LOCKED_MESSAGE;
  if (rejection === "not_registered") return "Register for this event to chat with your real attendee identity.";
  if (rejection === "slow_mode") return slowModeRejection(0);
  if (rejection === "rate_limited") return "You are sending messages too quickly. Wait a moment and send it again.";
  return "Type a message before sending.";
}

export function slowModeRejection(secondsLeft: number) {
  return `Slow mode is on. Wait ${Math.max(0, secondsLeft)} second${secondsLeft === 1 ? "" : "s"} before your next message — nothing you typed was thrown away.`;
}

/** Crew, the host, and speakers post at will; slow mode is a throttle on the room, not on the show. */
export function slowModeExempt(posterClass: LiveChatPosterClass) {
  return posterClass === "crew" || posterClass === "speaker";
}

export type LiveChatPostResult = { ok: true; message: LiveChatMessage } | { ok: false; rejection: LiveChatPostRejection; reason: string; retryAfterSeconds?: number };

/**
 * The one attendee write path. The rules are enforced HERE, not only in the UI:
 * a stale page, a replayed form, or a hand-made request still cannot post into
 * a locked room or past a silence.
 */
export async function postLiveRoomChatMessage(input: { eventId: string; roomKind: LiveChatRoomKind; roomId: string; attendeeId: string; displayName: string; company?: string; message: string; posterClass?: LiveChatPosterClass; now?: Date }): Promise<LiveChatPostResult> {
  const message = input.message.trim();
  if (!message) return { ok: false, rejection: "empty", reason: rejectionMessage("empty") };
  const now = input.now || new Date();
  const posterClass = input.posterClass || "attendee";
  const store = getRuntimeStore();
  const roomKey = liveChatRoomKey(input.roomKind, input.roomId);
  const [room, attendee, rateState] = await Promise.all([
    getLiveChatRoomModeration(input.eventId, input.roomKind, input.roomId),
    getLiveChatAttendeeModeration(input.eventId, input.roomKind, input.roomId, input.attendeeId),
    store.getLiveChatRateState(liveChatRateKey(input.eventId, input.attendeeId)).catch(() => undefined),
  ]);
  if (attendee.silenced) return { ok: false, rejection: "silenced", reason: rejectionMessage("silenced") };
  if (room.locked) return { ok: false, rejection: "locked", reason: rejectionMessage("locked") };
  // Slow mode: the crew's pace for this room, and only for the people it is meant for.
  if (room.slowModeSeconds && !slowModeExempt(posterClass)) {
    const lastPostAt = rateState?.lastPostAtByRoom?.[roomKey];
    const elapsedMs = lastPostAt ? now.getTime() - Date.parse(lastPostAt) : Number.POSITIVE_INFINITY;
    if (elapsedMs < room.slowModeSeconds * 1000) {
      const secondsLeft = Math.ceil((room.slowModeSeconds * 1000 - elapsedMs) / 1000);
      return { ok: false, rejection: "slow_mode", reason: slowModeRejection(secondsLeft), retryAfterSeconds: secondsLeft };
    }
  }
  // The flood guard, for everyone, always. A refusal writes the cooldown back so the next attempt
  // is answered by the same sentence instead of recounting.
  const rate = applyLiveChatRate({ eventId: input.eventId, attendeeId: input.attendeeId, roomKey, state: rateState, now });
  if (!rate.ok) {
    // A cooldown already running is NOT extended by hammering the send button — otherwise the
    // person who retries most never gets back in, which is the opposite of the intent.
    if (rate.limit !== "cooldown") await store.setLiveChatRateState(liveChatRateCooldownState({ eventId: input.eventId, attendeeId: input.attendeeId, state: rateState, now })).catch(() => undefined);
    return { ok: false, rejection: "rate_limited", reason: rate.reason, retryAfterSeconds: rate.retryAfterSeconds };
  }
  const saved = await appendLiveRoomChatMessage({ eventId: input.eventId, roomKind: input.roomKind, roomId: input.roomId, attendeeId: input.attendeeId, displayName: input.displayName, company: input.company, message, createdAt: now.toISOString() });
  await store.setLiveChatRateState(rate.state).catch(() => undefined);
  return { ok: true, message: saved };
}

/**
 * When may this person post again in this room? The composer counts down from this, and the delta
 * poll refreshes it, so a page left open does not offer a Send that the write path will refuse.
 */
export async function getLiveChatPostWindow(input: { eventId: string; roomKind: LiveChatRoomKind; roomId: string; attendeeId?: string; posterClass?: LiveChatPosterClass; slowModeSeconds: LiveChatSlowModeSeconds }) {
  const posterClass = input.posterClass || "attendee";
  const exempt = slowModeExempt(posterClass);
  if (!input.attendeeId) return { exempt, nextPostAllowedAt: undefined, cooldownUntil: undefined };
  const state = await getRuntimeStore().getLiveChatRateState(liveChatRateKey(input.eventId, input.attendeeId)).catch(() => undefined);
  const lastPostAt = state?.lastPostAtByRoom?.[liveChatRoomKey(input.roomKind, input.roomId)];
  const nextPostAllowedAt = !exempt && input.slowModeSeconds && lastPostAt ? new Date(Date.parse(lastPostAt) + input.slowModeSeconds * 1000).toISOString() : undefined;
  return { exempt, nextPostAllowedAt, cooldownUntil: state?.cooldownUntil };
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

/**
 * One row holds every standing decision about a room — the lock, slow mode, and the last clear —
 * so each writer MERGES rather than replacing: turning slow mode on must not quietly unlock a
 * locked room, and locking must not turn slow mode off.
 */
async function patchLiveChatRoomState(input: { eventId: string; roomKind: LiveChatRoomKind; roomId: string; actorRole: string }, patch: Partial<LiveChatModerationState>) {
  const store = getRuntimeStore();
  const key = liveChatRoomModerationKey(input.eventId, input.roomKind, input.roomId);
  const current = await store.getLiveChatModerationState(key).catch(() => undefined);
  const state: LiveChatModerationState = {
    ...(current || {}),
    key,
    eventId: input.eventId,
    roomKind: input.roomKind,
    roomId: input.roomId,
    scope: "room",
    locked: current?.locked ?? false,
    silenced: false,
    ...patch,
    updatedBy: input.actorRole,
    updatedAt: now(),
  };
  return store.setLiveChatModerationState(state);
}

export async function setLiveChatRoomLock(input: { eventId: string; roomKind: LiveChatRoomKind; roomId: string; locked: boolean; actorRole: string; reason?: string }) {
  return patchLiveChatRoomState(input, { locked: input.locked, reason: input.locked ? input.reason : undefined });
}

/** Slow mode: 0 turns it off, 5 / 10 / 30 is the wait an ordinary attendee has between posts. */
export async function setLiveChatSlowMode(input: { eventId: string; roomKind: LiveChatRoomKind; roomId: string; slowModeSeconds: LiveChatSlowModeSeconds; actorRole: string }) {
  return patchLiveChatRoomState(input, { slowModeSeconds: slowModeSecondsOf(input.slowModeSeconds) });
}

/**
 * Clear chat. The schema carries archived_at / archived_by on every message, so this ARCHIVES the
 * room — the rows stay for the audit and for an export, they simply leave every view, crew
 * included. Nothing is hard-deleted. Returns how many rows were archived so the crew's confirm and
 * the audit line can name the number.
 */
export async function clearLiveChatRoom(input: { eventId: string; roomKind: LiveChatRoomKind; roomId: string; actorRole: string }) {
  const clearedAt = now();
  const clearedCount = await getRuntimeStore().archiveLiveChatRoomMessages({ eventId: input.eventId, roomKind: input.roomKind, roomId: input.roomId, archivedAt: clearedAt, archivedBy: input.actorRole });
  await patchLiveChatRoomState(input, { clearedAt, clearedBy: input.actorRole, clearedCount });
  return { clearedCount, clearedAt };
}

/** How many messages a Clear chat would archive right now — the number in the crew's confirm. */
export async function countLiveChatRoomMessages(eventId: string, roomKind: LiveChatRoomKind, roomId: string) {
  return (await getRuntimeStore().listLiveChatMessages(eventId, roomKind, roomId, { includeHidden: true }).catch(() => [] as LiveChatMessage[])).length;
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

/** The newest change this viewer already holds, so the first poll asks only for what came after. */
export function liveChatCursorOf(messages: LiveChatMessage[]) {
  let cursor = new Date(0).toISOString();
  for (const message of messages) for (const stamp of [message.createdAt, message.moderatedAt, message.archivedAt]) if (stamp && stamp > cursor) cursor = stamp;
  return cursor;
}

/**
 * The delta an open chat polls for. It answers with what CHANGED since the caller's cursor, not
 * with the window again: new messages, plus the ids that left this viewer's room (hidden by the
 * crew, or archived by Clear chat) so a hide actually disappears on every open page. The standing
 * state — locked, silenced, slow mode, the last clear — rides along every time because it is four
 * small fields and getting it wrong means a page that lies.
 */
export async function listLiveRoomChatDelta(input: { eventId: string; roomKind: LiveChatRoomKind; roomId: string; since?: string; viewer: LiveChatViewer; attendeeId?: string; posterClass?: LiveChatPosterClass }): Promise<LiveChatDelta> {
  const since = input.since && Number.isFinite(Date.parse(input.since)) ? input.since : new Date(0).toISOString();
  const [room, attendee, changed] = await Promise.all([
    getLiveChatRoomModeration(input.eventId, input.roomKind, input.roomId),
    input.attendeeId ? getLiveChatAttendeeModeration(input.eventId, input.roomKind, input.roomId, input.attendeeId) : Promise.resolve({ silenced: false }),
    getRuntimeStore().listLiveChatMessagesSince(input.eventId, input.roomKind, input.roomId, since),
  ]);
  const gone = (message: LiveChatMessage) => Boolean(message.archivedAt) || (input.viewer !== "crew" && message.moderationStatus === "hidden");
  const you = await getLiveChatPostWindow({ eventId: input.eventId, roomKind: input.roomKind, roomId: input.roomId, attendeeId: input.attendeeId, posterClass: input.posterClass, slowModeSeconds: room.slowModeSeconds });
  return {
    cursor: liveChatCursorOf(changed) > since ? liveChatCursorOf(changed) : since,
    messages: changed.filter((message) => !gone(message)),
    removedIds: changed.filter(gone).map((message) => message.id),
    locked: room.locked,
    silenced: attendee.silenced,
    slowModeSeconds: room.slowModeSeconds,
    clearedAt: room.clearedAt,
    you,
  };
}

export function liveChatRoomPath(eventId: string, roomKind: LiveChatRoomKind, roomId: string) {
  if (roomKind === "main_stage") return `/venue/${eventId}/stage`;
  if (roomKind === "breakout") return `/venue/${eventId}/breakouts`;
  return `/venue/${eventId}/sessions/${roomId}`;
}
