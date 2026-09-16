import { CURRENT_BUILD_ID } from "@/lib/runtime/buildVersion";
import { latestSessionsByAttendee } from "@/services/venue/attendeeClientHeartbeatService";
import { listStageParticipants, participantFor, type LiveKitParticipantSnapshot, type LiveKitRoomSnapshot } from "@/services/video/livekitParticipantService";
import type { AttendeeRosterRow } from "@/services/venue/attendeeRosterService";
import type { AttendeeSession } from "@/types/attendeeSession";

/**
 * "I can't see it" has three causes that look identical to the person saying it, and the whole point
 * of this panel is to tell them apart in one glance:
 *
 *   never_connected        no LiveKit participant for their identity — they never got into the room.
 *   receiving_nothing      in the room, but subscribed to no tracks. OURS to fix.
 *   poor_connection        subscribed, but their client reports poor/lost quality. THEIRS to fix.
 *   watching               in the room, subscribed, quality fine.
 *   nothing_on_air         in the room and subscribed to nothing because nothing is being published
 *                          — not their fault and not a subscription bug; the feed is not up.
 *   unknown                a probe did not run. Grey, never green: see the rule below.
 *
 * THE RULE: a verdict is only ever as good as the probe behind it. LiveKit unreachable, or an
 * attendee who has never sent a heartbeat, reads `unknown` — never "fine". Every field carries where
 * it came from and when, so nothing on the panel is an assumption wearing a fact's clothes.
 */
export type AttendeeVerdict = "watching" | "never_connected" | "receiving_nothing" | "poor_connection" | "nothing_on_air" | "unknown";

export interface AttendeeDiagnosis {
  attendeeId: string;
  verdict: AttendeeVerdict;
  /** One sentence a producer can act on, not a restatement of the verdict. */
  headline: string;
  /** The LiveKit half: are they in the room, and what do they publish. */
  participant?: LiveKitParticipantSnapshot;
  livekitReachable: boolean;
  livekitReason?: string;
  livekitCheckedAt: string;
  /** Whether anything is on air for a viewer to subscribe to at all. */
  publishingTracks: number;
  /** The client half: what their own browser last reported. */
  session?: AttendeeSession;
  buildMatchesCurrent?: boolean;
  currentBuildId: string;
}

export interface AttendeeDiagnosisSet {
  eventId: string;
  stageId: string;
  room: LiveKitRoomSnapshot;
  byAttendee: Map<string, AttendeeDiagnosis>;
}

const POOR = new Set(["poor", "lost"]);

export function diagnoseAttendee(input: { attendeeId: string; room: LiveKitRoomSnapshot; session?: AttendeeSession; currentBuildId: string }): AttendeeDiagnosis {
  const { attendeeId, room, session, currentBuildId } = input;
  const participant = participantFor(room, attendeeId);
  const base = {
    attendeeId,
    participant,
    livekitReachable: room.reachable,
    livekitReason: room.reason,
    livekitCheckedAt: room.checkedAt,
    publishingTracks: room.publishingTracks,
    session,
    buildMatchesCurrent: session?.clientBuildId ? session.clientBuildId === currentBuildId : undefined,
    currentBuildId,
  };
  if (!room.reachable) return { ...base, verdict: "unknown", headline: `LiveKit could not be read, so nothing here is known. ${room.reason || ""}`.trim() };
  if (!participant || participant.state === "DISCONNECTED") return { ...base, verdict: "never_connected", headline: "They are not in the stage room at all. Ask them to reload the stage page; if they still cannot get in, check whether they are permitted to watch." };
  const subscribed = session?.clientSubscribedTracks;
  const quality = session?.clientConnectionQuality;
  if (subscribed === undefined && quality === undefined) return { ...base, verdict: "unknown", headline: "They are in the room, but their browser has not reported yet, so we cannot say what is reaching them. Wait 20 seconds, or ask them to reload." };
  if (room.publishingTracks === 0) return { ...base, verdict: "nothing_on_air", headline: "They are in the room and nothing is being published — the feed is not up. This is not their connection: get stream credentials and start the feed." };
  if (subscribed === 0) return { ...base, verdict: "receiving_nothing", headline: "They are in the room and the feed is on air, but they are subscribed to nothing. That is ours, not theirs: have them reload the stage; if it repeats, check their watch permit and the room token." };
  if (quality && POOR.has(quality)) return { ...base, verdict: "poor_connection", headline: `They are receiving ${subscribed ?? "the"} track${subscribed === 1 ? "" : "s"} but their connection is ${quality}. That is their network: suggest closing other tabs, wired over wi-fi, or the audio-only fallback.` };
  return { ...base, verdict: "watching", headline: `They are in the room, subscribed to ${subscribed ?? "the"} track${subscribed === 1 ? "" : "s"}, connection ${quality || "not reported"}. Nothing on our side is wrong.` };
}

/**
 * One LiveKit call and one session read for the WHOLE roster — never one per row. A per-row probe on
 * a 200-person roster would be 200 twirp calls on every render of the crew deck.
 */
export async function diagnoseRoster(input: { eventId: string; stageId?: string; rows: readonly Pick<AttendeeRosterRow, "attendeeId">[] }): Promise<AttendeeDiagnosisSet> {
  const stageId = input.stageId || "main-stage";
  const [room, sessions] = await Promise.all([
    listStageParticipants(input.eventId, stageId),
    latestSessionsByAttendee(input.eventId),
  ]);
  const byAttendee = new Map<string, AttendeeDiagnosis>();
  for (const row of input.rows) byAttendee.set(row.attendeeId, diagnoseAttendee({ attendeeId: row.attendeeId, room, session: sessions.get(row.attendeeId), currentBuildId: CURRENT_BUILD_ID }));
  return { eventId: input.eventId, stageId, room, byAttendee };
}

export const VERDICT_LABEL: Record<AttendeeVerdict, string> = {
  watching: "Watching",
  never_connected: "Never connected",
  receiving_nothing: "Receiving nothing — ours",
  poor_connection: "Poor connection — theirs",
  nothing_on_air: "Nothing on air",
  unknown: "Unknown",
};
