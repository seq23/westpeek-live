/**
 * Real speed networking (16 Sep 2026). A queue per event of registered attendees, and 1:1
 * matches with their own LiveKit room. The pure matcher lives in
 * services/speed-networking/speedNetworkingEngine.ts; these are the rows the runtime store keeps.
 */
export type SpeedNetworkingQueueEntryStatus = "waiting" | "matched" | "done" | "left";
export type SpeedNetworkingMatchState = "active" | "ended" | "expired";

export interface SpeedNetworkingQueueEntry {
  id: string;
  eventId: string;
  attendeeId: string;
  displayName: string;
  company: string;
  title: string;
  status: SpeedNetworkingQueueEntryStatus;
  joinedAt: string;
  matchedAt?: string;
  matchId?: string;
  matchesCompleted: number;
  updatedAt: string;
}

export interface SpeedNetworkingMatchRecord {
  id: string;
  eventId: string;
  attendeeAId: string;
  attendeeBId: string;
  normalizedPairKey: string;
  /** The LiveKit room: `<eventId>-net-<matchId>`; a token is issued only to these two attendees. */
  roomName: string;
  status: SpeedNetworkingMatchState;
  startsAt: string;
  expiresAt: string;
  endedAt?: string;
  endedReason?: string;
}

export interface SpeedNetworkingSettings {
  open: boolean;
  matchMinutes: number;
  updatedBy: string;
  updatedAt: string;
}

export const SPEED_NETWORKING_DEFAULT_MINUTES = 4;

export function speedNetworkingRoomName(eventId: string, matchId: string) {
  return `${eventId}-net-${matchId}`.replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase();
}
