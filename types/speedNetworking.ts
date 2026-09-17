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

/**
 * The sentence that removes the last hesitation before pressing Join queue, written once and
 * rendered beside the button — never as a paragraph somewhere further down the page.
 *
 * It lived at the bottom of the explainer until 17 Sep 2026, which put it three screens away from
 * the moment it answers. One constant so the promise and the button cannot drift apart, and so a
 * validator can prove it is still beside the action rather than merely still in the repo.
 */
export const SPEED_NETWORKING_PRIVACY_PROMISE = "Your match sees your name and your company. Nothing else.";

/**
 * The rotation (16 Sep 2026, the owner: "it should continually keep u in a 4 min cycle of talking
 * to new people with a small lag between to set up"). When a match runs out both people are put
 * straight back in the queue and paired again — but the next match does not start on the same
 * beat: it is created with a `startsAt` a few seconds out, and that gap is the setup beat. During
 * it each person sees who they just finished with, who is coming, and their own camera preview.
 *
 * Here rather than in the matching config because a client component reads it, and the matching
 * config reaches the pure engine and through it the server-only video services. It is re-exported
 * as SPEED_NETWORKING_MATCHING_CONFIG.cycle so there is still one object to read.
 */
export const SPEED_NETWORKING_CYCLE = {
  /** The beat between one match ending and the next starting. */
  setupGapSeconds: 9,
  /** A token is issued this long before the bell, so the connection is up when the match starts. */
  tokenLeadSeconds: 2,
  /** How often the attendee's own state is polled while nothing is about to change. */
  idlePollMs: 5_000,
  /** ...and inside the last seconds of a match, or during the gap, where a second matters. */
  transitionPollMs: 1_000,
  /** The tail of a match that counts as a transition. */
  transitionWindowSeconds: 15,
} as const;

export function speedNetworkingRoomName(eventId: string, matchId: string) {
  return `${eventId}-net-${matchId}`.replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase();
}
