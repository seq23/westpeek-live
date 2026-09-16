import { getLiveKitEnv } from "@/lib/env";
import { createLiveKitServerToken, livekitTwirp } from "@/services/video/livekitIngressService";
import { normalizeLiveKitRoomName } from "@/services/video/livekitRoomNaming";

/**
 * What LiveKit's RoomService actually tells us about a stage room, through the same twirp helper the
 * ingress calls use.
 *
 * Read the limits honestly, because the Diagnose panel is only useful if it does:
 * `RoomService/ListParticipants` returns who is IN the room and what each of them PUBLISHES. It does
 * NOT return connection quality, and it does NOT return what a viewer is SUBSCRIBED to — LiveKit
 * keeps both on the client. So the server half of a diagnosis answers "are they connected, and is
 * there anything for them to receive"; the attendee's own client answers "am I receiving it, and how
 * well" through the stage heartbeat. Neither half is guessed from the other.
 */
export interface LiveKitParticipantTrack {
  sid?: string;
  type?: string;
  source?: string;
  muted?: boolean;
}

export interface LiveKitParticipantSnapshot {
  identity: string;
  name?: string;
  /** JOINING | JOINED | ACTIVE | DISCONNECTED, as LiveKit reports it. */
  state?: string;
  joinedAt?: string;
  isPublisher: boolean;
  canSubscribe: boolean;
  tracks: LiveKitParticipantTrack[];
}

export interface LiveKitRoomSnapshot {
  /** False when LiveKit is unconfigured or unreachable: the panel then says "unknown", never "fine". */
  reachable: boolean;
  roomName: string;
  reason?: string;
  participants: LiveKitParticipantSnapshot[];
  /** Whether the production feed (or any publisher) has anything on air for viewers to subscribe to. */
  publishingTracks: number;
  checkedAt: string;
}

interface TwirpParticipantInfo {
  sid?: string;
  identity?: string;
  name?: string;
  state?: string | number;
  joined_at?: string | number;
  is_publisher?: boolean;
  permission?: { can_subscribe?: boolean };
  tracks?: Array<{ sid?: string; type?: string | number; source?: string | number; muted?: boolean }>;
}

const STATE_NAMES = ["JOINING", "JOINED", "ACTIVE", "DISCONNECTED"];

function stateName(value: string | number | undefined) {
  if (value === undefined || value === null || value === "") return undefined;
  const numeric = typeof value === "number" ? value : /^\d+$/.test(value) ? Number(value) : undefined;
  return numeric === undefined ? String(value) : STATE_NAMES[numeric] || String(value);
}

function isoFromSeconds(value: string | number | undefined) {
  const seconds = typeof value === "number" ? value : Number(value || 0);
  if (!seconds) return undefined;
  return new Date(seconds * 1000).toISOString();
}

export async function listStageParticipants(eventId: string, stageId = "main-stage"): Promise<LiveKitRoomSnapshot> {
  const roomName = normalizeLiveKitRoomName(eventId, stageId);
  const checkedAt = new Date().toISOString();
  const livekit = getLiveKitEnv();
  if (!livekit.livekitUrl || !livekit.livekitApiKey || !livekit.livekitApiSecret) {
    return { reachable: false, roomName, reason: "LiveKit server credentials are not configured, so nothing can be read about who is connected.", participants: [], publishingTracks: 0, checkedAt };
  }
  try {
    const token = createLiveKitServerToken({ apiKey: livekit.livekitApiKey, apiSecret: livekit.livekitApiSecret, roomName });
    const listed = await livekitTwirp<{ participants?: TwirpParticipantInfo[] }>({ livekitUrl: livekit.livekitUrl, token, method: "RoomService/ListParticipants", body: { room: roomName } });
    const participants = (listed.participants || []).map((item) => ({
      identity: String(item.identity || item.sid || ""),
      name: item.name || undefined,
      state: stateName(item.state),
      joinedAt: isoFromSeconds(item.joined_at),
      isPublisher: Boolean(item.is_publisher),
      // Absent in LiveKit's JSON means the default, which is true; only an explicit false denies it.
      canSubscribe: item.permission?.can_subscribe !== false,
      tracks: (item.tracks || []).map((track) => ({ sid: track.sid, type: track.type === undefined ? undefined : String(track.type), source: track.source === undefined ? undefined : String(track.source), muted: Boolean(track.muted) })),
    }));
    const publishingTracks = participants.reduce((total, participant) => total + participant.tracks.filter((track) => !track.muted).length, 0);
    return { reachable: true, roomName, participants, publishingTracks, checkedAt };
  } catch (error) {
    // Unreachable is not "everyone is fine". Say so and let the panel print grey.
    return { reachable: false, roomName, reason: error instanceof Error ? error.message : "LiveKit did not answer.", participants: [], publishingTracks: 0, checkedAt };
  }
}

/** The ingress publisher is minted as `streamyard-<event>-<stage>`; it is a feed, not a person. */
export function isProductionFeedParticipant(identity: string | undefined) {
  return Boolean(identity && identity.startsWith("streamyard-"));
}

/** An attendee's LiveKit identity is their attendee id (the token's `profileId`). */
export function participantFor(snapshot: LiveKitRoomSnapshot, attendeeId: string) {
  return snapshot.participants.find((participant) => participant.identity === attendeeId && !isProductionFeedParticipant(participant.identity));
}
