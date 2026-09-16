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
  updatedBy: string;
  updatedAt: string;
}

export type LiveChatPostRejection = "locked" | "silenced" | "not_registered" | "empty";

export const LIVE_CHAT_SILENCED_MESSAGE = "You have been silenced by the crew";
export const LIVE_CHAT_LOCKED_MESSAGE = "Chat is locked by the crew";

export function liveChatRoomModerationKey(eventId: string, roomKind: LiveChatRoomKind, roomId: string) {
  return `${eventId}:${roomKind}:${roomId}`;
}

export function liveChatAttendeeModerationKey(eventId: string, roomKind: LiveChatRoomKind, roomId: string, attendeeId: string) {
  return `${eventId}:${roomKind}:${roomId}:${attendeeId}`;
}
