import { matchIsInSetup, tokenAllowedForRoom } from "@/services/speed-networking/speedNetworkingService";
import { ensureLiveKitRoomWithCapacity, listLiveKitRoomParticipants, removeLiveKitRoomParticipant, type LiveKitRoomParticipant } from "@/services/video/livekitRoomAdmin";
import type { SpeedNetworkingMatchRecord } from "@/types/speedNetworking";

/**
 * A 1:1 networking room holds exactly the two attendees of one ACTIVE match, and nobody else,
 * ever. Enforced in three places because one was not enough (16 Sep 2026: the owner's own 1:1
 * rendered five tiles, including people who were never matched with her):
 *
 *  1. the grant — only role "attendee", only the two attendees of that active match;
 *  2. the LiveKit room itself — created ahead of the first token with max_participants = 2, so the
 *     server refuses a third body even if a grant were ever wrong;
 *  3. the join — anyone already in the room who is not one of the two is removed before the token
 *     is handed out, and the joiner's own earlier connection is removed so a rejoin replaces it
 *     cleanly instead of leaving LiveKit's duplicate-identity ghost behind.
 *
 * The room is deleted when the match ends, expires, or somebody leaves, so the next match and any
 * rejoin start from an empty room.
 */

/** Two people. Not a default, a maximum: the LiveKit room is created with this cap. */
export const SPEED_NETWORKING_ROOM_CAPACITY = 2;

/**
 * A networking room outlives its match by at most a minute, so a dropped connection can come back
 * but a forgotten room cannot sit there collecting people.
 */
export const SPEED_NETWORKING_ROOM_EMPTY_TIMEOUT_SECONDS = 60;

/**
 * The LiveKit participant identity for one attendee in a networking room: their event-scoped
 * attendee id, never anything derived from a display name (two attendees called "Ada" would
 * otherwise collide and displace each other). It is deliberately stable rather than
 * per-connection: a networking room seats exactly two, so a second tab from the same person has
 * to replace their first connection, not take the other person's seat.
 */
export function speedNetworkingParticipantIdentity(attendeeId: string) {
  return attendeeId;
}

export function speedNetworkingRoomIdentities(match: SpeedNetworkingMatchRecord) {
  return [speedNetworkingParticipantIdentity(match.attendeeAId), speedNetworkingParticipantIdentity(match.attendeeBId)];
}

export interface SpeedNetworkingAdmission {
  ok: boolean;
  reason: string;
  /** The only two identities that may ever be in this room. */
  allowedIdentities: string[];
  /** In the room right now and not one of the two — removed before any token is issued. */
  strangers: string[];
  /** The joiner's own earlier connection, if any — removed so the rejoin does not leave a ghost tile. */
  staleSelf: string[];
}

const NOT_YOURS = "This networking room is not yours: tokens go only to the two matched attendees while the match is active.";
const ATTENDEES_ONLY = "A speed networking room is a private 1:1 between two registered attendees; no other role can be given a token for it.";
const NOT_OPEN_YET = "Your next match has not started yet. The room opens when the countdown reaches zero.";

function isPresent(participant: LiveKitRoomParticipant) {
  return participant.state !== "DISCONNECTED";
}

/**
 * Pure: who may join this room, and who has to be thrown out first. `participants` is what the
 * LiveKit server reports; undefined means LiveKit could not be asked (no credentials), in which
 * case the grant still applies and there is simply nothing to purge.
 */
export function decideSpeedNetworkingRoomAdmission(input: {
  match: SpeedNetworkingMatchRecord | undefined;
  roomName: string;
  attendeeId: string;
  role: string;
  participants?: LiveKitRoomParticipant[];
}): SpeedNetworkingAdmission {
  const empty = { allowedIdentities: [] as string[], strangers: [] as string[], staleSelf: [] as string[] };
  if (input.role !== "attendee") return { ok: false, reason: ATTENDEES_ONLY, ...empty };
  if (!tokenAllowedForRoom(input.match, input.roomName, input.attendeeId)) {
    // A match decided but still inside its setup beat is refused too, with a reason that says so —
    // the client shows the countdown rather than "this room is not yours".
    const waitingForTheBell = input.match && matchIsInSetup(input.match) && (input.match.attendeeAId === input.attendeeId || input.match.attendeeBId === input.attendeeId);
    return { ok: false, reason: waitingForTheBell ? NOT_OPEN_YET : NOT_YOURS, ...empty };
  }

  const match = input.match!;
  const allowedIdentities = speedNetworkingRoomIdentities(match);
  const mine = speedNetworkingParticipantIdentity(input.attendeeId);
  const present = (input.participants || []).filter(isPresent);
  const strangers = present.filter((participant) => !allowedIdentities.includes(participant.identity)).map((participant) => participant.identity);
  const staleSelf = present.filter((participant) => participant.identity === mine).map((participant) => participant.identity);
  return { ok: true, reason: "Matched for speed networking.", allowedIdentities, strangers, staleSelf };
}

export interface SpeedNetworkingRoomPreparation extends SpeedNetworkingAdmission {
  /** Identities actually removed from the room before the token was issued. */
  purged: string[];
  /** False when LiveKit is not configured: the grant held, but nothing could be cleaned or capped. */
  livekitReachable: boolean;
}

/**
 * The join path: refuse anyone who is not one of the two, cap the room at two on the server, then
 * clear out anyone who should not be there (and the joiner's own earlier connection) before the
 * token is minted.
 */
export async function prepareSpeedNetworkingRoomForJoin(input: {
  match: SpeedNetworkingMatchRecord | undefined;
  roomName: string;
  attendeeId: string;
  role: string;
}): Promise<SpeedNetworkingRoomPreparation> {
  const gate = decideSpeedNetworkingRoomAdmission({ ...input, participants: undefined });
  if (!gate.ok) return { ...gate, purged: [], livekitReachable: false };

  await ensureLiveKitRoomWithCapacity({
    roomName: input.roomName,
    maxParticipants: SPEED_NETWORKING_ROOM_CAPACITY,
    emptyTimeoutSeconds: SPEED_NETWORKING_ROOM_EMPTY_TIMEOUT_SECONDS,
  }).catch(() => undefined);

  const listed = await listLiveKitRoomParticipants(input.roomName).catch(() => ({ configured: false as const }));
  if (!listed.configured) return { ...gate, purged: [], livekitReachable: false };

  const admission = decideSpeedNetworkingRoomAdmission({ ...input, participants: listed.participants });
  const purged: string[] = [];
  for (const identity of [...admission.strangers, ...admission.staleSelf]) {
    const removal = await removeLiveKitRoomParticipant(input.roomName, identity).catch(() => ({ configured: false as const }));
    if (removal.configured && removal.removed) purged.push(identity);
  }
  return { ...admission, purged, livekitReachable: true };
}
