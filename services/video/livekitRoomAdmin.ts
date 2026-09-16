import { createHmac } from "crypto";
import { getLiveKitEnv } from "@/lib/env";
import { normalizeLiveKitApiBaseUrl } from "@/services/video/livekitIngressService";

/**
 * Generic LiveKit RoomService admin calls: who is actually in a room, throwing someone out,
 * capping a room, and deleting it. The ingress service already talks to RoomService this way for
 * the main stage; speed networking needs the same reach to keep a 1:1 room to exactly its two
 * people. Every URL goes through normalizeLiveKitApiBaseUrl, which turns the wss:// runtime URL
 * into the https:// Twirp base before fetch().
 */

export interface LiveKitRoomParticipant {
  identity: string;
  name: string;
  /** LiveKit reports JOINING | JOINED | ACTIVE | DISCONNECTED. */
  state: string;
  publishedTrackCount: number;
}

/** Every admin call reports whether it could even be attempted, so a missing key never reads as "clean". */
export type LiveKitAdminOutcome<T> = { configured: false } | ({ configured: true } & T);

function base64UrlEncode(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function createRoomAdminToken(input: { apiKey: string; apiSecret: string; roomName: string; roomCreate?: boolean }) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(JSON.stringify({
    iss: input.apiKey,
    sub: "west-peek-live-room-admin",
    iat: now,
    nbf: now,
    exp: now + 300,
    // DeleteRoom and CreateRoom are roomCreate operations; ListParticipants and RemoveParticipant are roomAdmin.
    video: { roomAdmin: true, roomCreate: input.roomCreate === true, room: input.roomName },
  }));
  const signature = createHmac("sha256", input.apiSecret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

async function roomService(input: { livekitUrl: string; token: string; method: string; body: unknown }) {
  const response = await fetch(`${normalizeLiveKitApiBaseUrl(input.livekitUrl)}/twirp/livekit.RoomService/${input.method}`, {
    method: "POST",
    headers: { authorization: `Bearer ${input.token}`, "content-type": "application/json" },
    body: JSON.stringify(input.body),
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, text };
}

function configured() {
  const livekit = getLiveKitEnv();
  if (!livekit.livekitUrl || !livekit.livekitApiKey || !livekit.livekitApiSecret) return undefined;
  return { livekitUrl: livekit.livekitUrl, apiKey: livekit.livekitApiKey, apiSecret: livekit.livekitApiSecret };
}

interface RawParticipant { identity?: string; name?: string; state?: string | number; tracks?: unknown[] }

/** LiveKit answers state as the enum name over JSON, but older servers send the ordinal. */
const PARTICIPANT_STATES = ["JOINING", "JOINED", "ACTIVE", "DISCONNECTED"];

export function normalizeParticipantState(state: string | number | undefined) {
  if (typeof state === "number") return PARTICIPANT_STATES[state] || "UNKNOWN";
  return state || "UNKNOWN";
}

/** Who the LiveKit server thinks is in this room right now — the only authority on room occupancy. */
export async function listLiveKitRoomParticipants(roomName: string): Promise<LiveKitAdminOutcome<{ participants: LiveKitRoomParticipant[] }>> {
  const env = configured();
  if (!env) return { configured: false };
  const token = createRoomAdminToken({ apiKey: env.apiKey, apiSecret: env.apiSecret, roomName });
  const result = await roomService({ livekitUrl: env.livekitUrl, token, method: "ListParticipants", body: { room: roomName } });
  if (!result.ok) return { configured: true, participants: [] };
  const parsed = result.text ? (JSON.parse(result.text) as { participants?: RawParticipant[] }) : {};
  return {
    configured: true,
    participants: (parsed.participants || []).map((item) => ({
      identity: item.identity || "",
      name: item.name || "",
      state: normalizeParticipantState(item.state),
      publishedTrackCount: Array.isArray(item.tracks) ? item.tracks.length : 0,
    })),
  };
}

export async function removeLiveKitRoomParticipant(roomName: string, identity: string): Promise<LiveKitAdminOutcome<{ removed: boolean }>> {
  const env = configured();
  if (!env) return { configured: false };
  const token = createRoomAdminToken({ apiKey: env.apiKey, apiSecret: env.apiSecret, roomName });
  const result = await roomService({ livekitUrl: env.livekitUrl, token, method: "RemoveParticipant", body: { room: roomName, identity } });
  return { configured: true, removed: result.ok };
}

/**
 * Create the room ahead of the first token with a hard capacity, so the LiveKit server itself
 * refuses an extra body even if our own grant were ever wrong. Idempotent: an existing room is
 * left alone (LiveKit answers "already exists"), which is why the cap is also re-checked in the grant.
 */
export async function ensureLiveKitRoomWithCapacity(input: { roomName: string; maxParticipants: number; emptyTimeoutSeconds: number }): Promise<LiveKitAdminOutcome<{ created: boolean }>> {
  const env = configured();
  if (!env) return { configured: false };
  const token = createRoomAdminToken({ apiKey: env.apiKey, apiSecret: env.apiSecret, roomName: input.roomName, roomCreate: true });
  const result = await roomService({
    livekitUrl: env.livekitUrl,
    token,
    method: "CreateRoom",
    body: { name: input.roomName, max_participants: input.maxParticipants, empty_timeout: input.emptyTimeoutSeconds, departure_timeout: 5 },
  });
  return { configured: true, created: result.ok };
}

/** Deleting the room disconnects everyone still in it — the only cleanup that cannot leave a ghost behind. */
export async function deleteLiveKitRoom(roomName: string): Promise<LiveKitAdminOutcome<{ deleted: boolean }>> {
  const env = configured();
  if (!env) return { configured: false };
  const token = createRoomAdminToken({ apiKey: env.apiKey, apiSecret: env.apiSecret, roomName, roomCreate: true });
  const result = await roomService({ livekitUrl: env.livekitUrl, token, method: "DeleteRoom", body: { room: roomName } });
  return { configured: true, deleted: result.ok };
}
