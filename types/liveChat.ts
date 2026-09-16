export type LiveChatRoomKind = "main_stage" | "breakout" | "session";
export type LiveChatModerationStatus = "visible" | "hidden" | "flagged";

export interface LiveChatMessage {
  id: string;
  eventId: string;
  roomKind: LiveChatRoomKind;
  roomId: string;
  attendeeId?: string;
  displayName: string;
  company?: string;
  message: string;
  moderationStatus: LiveChatModerationStatus;
  /** Crew role that hid (or last restored) the message: owner | operator | crew. */
  moderatedBy?: string;
  moderatedAt?: string;
  /** Set by "Clear chat": the message leaves every view but stays a row. Never a hard delete. */
  archivedAt?: string;
  archivedBy?: string;
  createdAt: string;
}

/**
 * One row per moderation decision that outlives a single message.
 * scope "room": the room is locked (nobody but crew posts). attendeeId is absent.
 * scope "attendee": that attendee is silenced in that room. attendeeId is present.
 * Key: eventId:roomKind:roomId for a room, eventId:roomKind:roomId:attendeeId for an attendee.
 */
export type LiveChatModerationScope = "room" | "attendee";

export interface LiveChatModerationState {
  key: string;
  eventId: string;
  roomKind: LiveChatRoomKind;
  roomId: string;
  scope: LiveChatModerationScope;
  attendeeId?: string;
  locked: boolean;
  silenced: boolean;
  reason?: string;
  /** Room scope only: 0 (off), 5, 10, or 30 seconds between posts for an ordinary attendee. */
  slowModeSeconds?: LiveChatSlowModeSeconds;
  /** Room scope only: when the crew last cleared the room, and how many messages that archived. */
  clearedAt?: string;
  clearedBy?: string;
  clearedCount?: number;
  updatedBy: string;
  updatedAt: string;
}

/**
 * Slow mode. A crew toggle per room: while it is on, an ordinary attendee waits this many seconds
 * between posts and the composer counts down. Crew, the host, and speakers are exempt — the people
 * who have to answer a room of 500 cannot be the ones throttled.
 */
export type LiveChatSlowModeSeconds = 0 | 5 | 10 | 30;
export const LIVE_CHAT_SLOW_MODE_OPTIONS: readonly LiveChatSlowModeSeconds[] = [0, 5, 10, 30];

export function slowModeSecondsOf(value: unknown): LiveChatSlowModeSeconds {
  const seconds = Number(value);
  return (LIVE_CHAT_SLOW_MODE_OPTIONS as readonly number[]).includes(seconds) ? (seconds as LiveChatSlowModeSeconds) : 0;
}

/** Who is posting, for the exemptions. Resolved from the cookies by `getLiveChatPosterClass`. */
export type LiveChatPosterClass = "crew" | "speaker" | "attendee";

/**
 * The per-person flood guard, always on and independent of slow mode. One row per attendee per
 * event: the timestamps of their recent posts and, once they trip a limit, the moment they may
 * post again.
 */
export interface LiveChatRateState {
  key: string;
  eventId: string;
  attendeeId: string;
  /** ISO timestamps of recent posts, newest first, capped at LIVE_CHAT_RATE_HISTORY. */
  recentPostsAt: string[];
  cooldownUntil?: string;
  /** Last post per room ("main_stage:main-stage"), which is what slow mode counts down from. */
  lastPostAtByRoom?: Record<string, string>;
  updatedAt: string;
}

export function liveChatRateKey(eventId: string, attendeeId: string) {
  return `${eventId}:${attendeeId}`;
}

export type LiveChatPostRejection = "locked" | "silenced" | "not_registered" | "empty" | "slow_mode" | "rate_limited";

export const LIVE_CHAT_SILENCED_MESSAGE = "You have been silenced by the crew";
export const LIVE_CHAT_LOCKED_MESSAGE = "Chat is locked by the crew";
export const LIVE_CHAT_SLOW_MODE_MESSAGE = "Slow mode is on";
export const LIVE_CHAT_RATE_LIMITED_MESSAGE = "You are sending messages too quickly";

export function liveChatRoomModerationKey(eventId: string, roomKind: LiveChatRoomKind, roomId: string) {
  return `${eventId}:${roomKind}:${roomId}`;
}

export function liveChatAttendeeModerationKey(eventId: string, roomKind: LiveChatRoomKind, roomId: string, attendeeId: string) {
  return `${eventId}:${roomKind}:${roomId}:${attendeeId}`;
}

/**
 * A delta poll answer. `messages` are the rows created or changed since the caller's cursor;
 * `removedIds` are the rows that left this viewer's room since then (hidden by the crew, or
 * archived by Clear chat) so an open page can drop them. `clearedAt` moving means the crew
 * cleared the room and the client empties the list without waiting for every removal.
 */
export interface LiveChatDelta {
  cursor: string;
  messages: LiveChatMessage[];
  removedIds: string[];
  locked: boolean;
  silenced: boolean;
  slowModeSeconds: LiveChatSlowModeSeconds;
  clearedAt?: string;
  /** The caller's own posting state: when they may post again, and why they are or are not throttled. */
  you: { exempt: boolean; nextPostAllowedAt?: string; cooldownUntil?: string };
}
