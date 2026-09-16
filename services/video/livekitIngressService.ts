import { createHmac } from "crypto";
import { getLiveKitEnv } from "@/lib/env";
import { applyStageStreamSignal, getOrCreateStageStreamState, recordStagePollHeartbeat, stageStreamKey } from "@/services/video/stageStreamStateService";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { normalizeLiveKitRoomName } from "@/services/video/livekitRoomNaming";

export interface LiveKitIngressProvisioningResult {
  ok: boolean;
  eventId: string;
  stageId: string;
  roomName: string;
  ingressId?: string;
  rtmpUrl?: string;
  streamKey?: string;
  status: "GENERATING_CREDENTIALS" | "READY_FOR_STREAMYARD" | "ERROR_SAFE";
  message: string;
}

export function normalizeLiveKitApiBaseUrl(livekitUrl: string) {
  const trimmed = livekitUrl.replace(/\/$/, "");
  if (trimmed.startsWith("wss://")) return `https://${trimmed.slice("wss://".length)}`;
  if (trimmed.startsWith("ws://")) return `http://${trimmed.slice("ws://".length)}`;
  return trimmed;
}

function base64UrlEncode(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function createLiveKitServerToken(input: { apiKey: string; apiSecret: string; roomName: string }) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(JSON.stringify({
    iss: input.apiKey,
    sub: "west-peek-live-ingress-provisioner",
    iat: now,
    nbf: now,
    exp: now + 300,
    video: {
      roomCreate: true,
      roomAdmin: true,
      ingressAdmin: true,
      room: input.roomName,
    },
  }));
  const signature = createHmac("sha256", input.apiSecret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

async function livekitTwirp<T>(input: { livekitUrl: string; token: string; method: string; body: unknown }): Promise<T> {
  const response = await fetch(`${normalizeLiveKitApiBaseUrl(input.livekitUrl)}/twirp/livekit.${input.method}`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${input.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(input.body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`LiveKit API ${input.method} failed (${response.status}): ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) as T : {} as T;
}

async function ensureLiveKitRoom(livekitUrl: string, token: string, roomName: string) {
  try {
    await livekitTwirp({ livekitUrl, token, method: "RoomService/CreateRoom", body: { name: roomName, empty_timeout: 300, max_participants: 1000 } });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (!message.includes("already") && !message.includes("exists")) throw error;
  }
}

interface LiveKitIngressInfo {
  ingress_id?: string;
  url?: string;
  stream_key?: string;
  room_name?: string;
  /** LiveKit reports whether anything is actually being pushed into the ingress. */
  state?: { status?: string | number; error?: string };
}

interface LiveKitIngressListResponse {
  items?: LiveKitIngressInfo[];
  ingress?: LiveKitIngressInfo[];
}

async function findExistingLiveKitIngress(livekitUrl: string, token: string, input: { roomName: string; ingressId: string }) {
  const listed = await livekitTwirp<LiveKitIngressListResponse>({
    livekitUrl,
    token,
    method: "Ingress/ListIngress",
    body: { room_name: input.roomName },
  });
  const items = listed.items || listed.ingress || [];
  return items.find((item) => item.ingress_id === input.ingressId) || null;
}

async function createLiveKitRtmpIngress(livekitUrl: string, token: string, input: { eventId: string; stageId: string; roomName: string }) {
  return livekitTwirp<LiveKitIngressInfo>({
    livekitUrl,
    token,
    method: "Ingress/CreateIngress",
    body: {
      input_type: "RTMP_INPUT",
      name: `StreamYard ${input.eventId} ${input.stageId}`,
      room_name: input.roomName,
      participant_identity: `streamyard-${input.eventId}-${input.stageId}`.replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase(),
      participant_name: "StreamYard Production Feed",
      enable_transcoding: true,
    },
  });
}

export async function provisionStreamYardLiveKitIngress(input: { eventId: string; stageId?: string; actorRole?: string }): Promise<LiveKitIngressProvisioningResult> {
  const stageId = input.stageId || "main-stage";
  const livekit = getLiveKitEnv();
  const roomName = normalizeLiveKitRoomName(input.eventId, stageId);
  const current = await getOrCreateStageStreamState(input.eventId, stageId);

  if (!livekit.livekitUrl || !livekit.livekitApiKey || !livekit.livekitApiSecret) {
    return { ok: false, eventId: input.eventId, stageId, roomName, status: "ERROR_SAFE", message: "LiveKit server credentials are missing. Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET before generating StreamYard RTMP credentials." };
  }

  try {
    const token = createLiveKitServerToken({ apiKey: livekit.livekitApiKey, apiSecret: livekit.livekitApiSecret, roomName });
    if (current.livekitIngressId && current.livekitIngressUrl && current.livekitStreamKey) {
      const existingIngress = await findExistingLiveKitIngress(livekit.livekitUrl, token, { roomName, ingressId: current.livekitIngressId });
      if (existingIngress) {
        return { ok: true, eventId: input.eventId, stageId, roomName, ingressId: current.livekitIngressId, rtmpUrl: current.livekitIngressUrl, streamKey: current.livekitStreamKey, status: "READY_FOR_STREAMYARD", message: "Existing StreamYard RTMP credentials are ready and were verified against LiveKit. Reuse these credentials unless the producer intentionally regenerates ingress." };
      }
    }

    await ensureLiveKitRoom(livekit.livekitUrl, token, roomName);
    let ingress: LiveKitIngressInfo;
    try {
      ingress = await createLiveKitRtmpIngress(livekit.livekitUrl, token, { eventId: input.eventId, stageId, roomName });
    } catch (error) {
      // LIVEKIT CAPS THE NUMBER OF INGRESS OBJECTS ON THE PROJECT. On 16 Sep 2026 a fresh Room could
      // not get credentials: every earlier event — the demos, an archived throwaway, a planned draft —
      // still held its ingress, because nothing ever deleted one. Reclaim what no live show is using
      // and try once more; the console shows the reason if that is still not enough.
      if (!/429|resource_exhausted|ingress object limit/i.test(String((error as Error)?.message))) throw error;
      const reclaimed = await reclaimStaleIngresses(livekit.livekitUrl, token, { keepRoomName: roomName });
      if (reclaimed.deleted.length === 0) throw new Error(`${(error as Error).message} — nothing stale to reclaim: every ingress belongs to a live or upcoming event.`);
      ingress = await createLiveKitRtmpIngress(livekit.livekitUrl, token, { eventId: input.eventId, stageId, roomName });
    }
    if (!ingress.ingress_id || !ingress.url || !ingress.stream_key) throw new Error("LiveKit did not return ingress_id, url, and stream_key.");
    const updated = await applyStageStreamSignal({ eventId: input.eventId, stageId, signal: "generate_credentials", reason: "LiveKit RTMP ingress created for StreamYard production." });
    const state = { ...updated, lastProvisionError: undefined, livekitRoomName: roomName, livekitIngressId: ingress.ingress_id, livekitIngressUrl: ingress.url, livekitStreamKey: ingress.stream_key, updatedAt: new Date().toISOString() };
    await getRuntimeStore().setStageStreamState(stageStreamKey(input.eventId, stageId), state);
    return { ok: true, eventId: input.eventId, stageId, roomName, ingressId: ingress.ingress_id, rtmpUrl: ingress.url, streamKey: ingress.stream_key, status: "READY_FOR_STREAMYARD", message: "Ready for StreamYard Connection. Paste the RTMP URL and Stream Key into StreamYard Custom RTMP." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "LiveKit ingress provisioning failed safely.";
    try {
      const failed = { ...(await getOrCreateStageStreamState(input.eventId, stageId)), lastProvisionError: message, updatedAt: new Date().toISOString() };
      await getRuntimeStore().setStageStreamState(stageStreamKey(input.eventId, stageId), failed);
    } catch {
      // the message still returns to the caller
    }
    return { ok: false, eventId: input.eventId, stageId, roomName, status: "ERROR_SAFE", message };
  }
}

interface LiveKitIngressListed extends LiveKitIngressInfo { name?: string }

/** Which runtime events may keep their ingress: anything that is live or about to be. */
const KEEP_STATUSES = new Set(["live", "registration_open", "pre_event", "published"]);

/**
 * Delete every ingress that no live or upcoming event needs: ended, archived and draft runtime
 * events, seed demos, and rooms nothing in the store knows about. An ingress that is publishing
 * right now is never touched, whatever its event says. Returns what went, for the log.
 */
export async function reclaimStaleIngresses(livekitUrl: string, token: string, input: { keepRoomName?: string } = {}): Promise<{ deleted: string[]; kept: string[] }> {
  const listed = await livekitTwirp<{ items?: LiveKitIngressListed[]; ingress?: LiveKitIngressListed[] }>({ livekitUrl, token, method: "Ingress/ListIngress", body: {} });
  const items = listed.items || listed.ingress || [];
  const events = await getRuntimeStore().listRuntimeEvents().catch(() => []);
  const statusByRoom = new Map<string, string>();
  for (const event of events) statusByRoom.set(normalizeLiveKitRoomName(event.id, "main-stage"), event.status);
  const deleted: string[] = [];
  const kept: string[] = [];
  for (const item of items) {
    if (!item.ingress_id) continue;
    const room = item.room_name || "";
    const publishing = PUBLISHING_STATES.has(String(item.state?.status ?? ""));
    const status = statusByRoom.get(room);
    const keep = publishing || room === input.keepRoomName || (status !== undefined && KEEP_STATUSES.has(status));
    if (keep) { kept.push(item.ingress_id); continue; }
    try {
      await livekitTwirp<unknown>({ livekitUrl, token, method: "Ingress/DeleteIngress", body: { ingress_id: item.ingress_id } });
      deleted.push(item.ingress_id);
    } catch {
      kept.push(item.ingress_id);
    }
  }
  return { deleted, kept };
}

/**
 * Give an event's ingress back when the show is over or the event is put away, and forget the
 * credentials so a Restore mints fresh ones. Safe to call when there is nothing to release.
 */
export async function releaseIngressForEvent(eventId: string, stageId = "main-stage"): Promise<{ released: boolean; reason: string }> {
  const state = await getOrCreateStageStreamState(eventId, stageId);
  if (!state.livekitIngressId) return { released: false, reason: "no ingress on record" };
  const livekit = getLiveKitEnv();
  if (!livekit.livekitUrl || !livekit.livekitApiKey || !livekit.livekitApiSecret) return { released: false, reason: "LiveKit credentials missing" };
  const roomName = normalizeLiveKitRoomName(eventId, stageId);
  try {
    const token = createLiveKitServerToken({ apiKey: livekit.livekitApiKey, apiSecret: livekit.livekitApiSecret, roomName });
    await livekitTwirp<unknown>({ livekitUrl: livekit.livekitUrl, token, method: "Ingress/DeleteIngress", body: { ingress_id: state.livekitIngressId } });
  } catch (error) {
    // An ingress LiveKit no longer has is already released; anything else is reported, not hidden.
    if (!/not_found|404|does not exist/i.test(String((error as Error)?.message))) return { released: false, reason: (error as Error).message };
  }
  const cleared = { ...state, livekitIngressId: undefined, livekitIngressUrl: undefined, livekitStreamKey: undefined, lastProvisionError: undefined, updatedAt: new Date().toISOString() };
  await getRuntimeStore().setStageStreamState(stageStreamKey(eventId, stageId), cleared);
  return { released: true, reason: "ingress deleted and credentials forgotten" };
}


/**
 * RECONCILE WITH LIVEKIT INSTEAD OF WAITING FOR IT TO CALL US.
 *
 * The stage only went live on an `ingress_started` webhook. On 15 Sep 2026 a real RTMP feed was
 * pushed into a freshly minted ingress for two minutes and the attendee stage stayed on
 * "Stage is getting ready" the whole time — "Last webhook: None yet". A webhook the LiveKit
 * project has not been told to send is a webhook that never arrives, and the show has no way to
 * know. So every read of the stage state (the player polls it every 10s) asks LiveKit's
 * ListIngress what the ingress is doing and applies the signal itself. The webhook stays as the
 * fast path; this is the floor.
 *
 * LiveKit's IngressState.status: ENDPOINT_INACTIVE (0), ENDPOINT_BUFFERING (1),
 * ENDPOINT_PUBLISHING (2), ENDPOINT_ERROR (3), ENDPOINT_COMPLETE (4). JSON may carry the name or
 * the number; both are handled.
 */
const PUBLISHING_STATES = new Set(["ENDPOINT_PUBLISHING", "ENDPOINT_BUFFERING", "2", "1"]);
const STOPPED_STATES = new Set(["ENDPOINT_INACTIVE", "ENDPOINT_ERROR", "ENDPOINT_COMPLETE", "0", "3", "4"]);
const RECONCILE_EVERY_MS = 5_000;
const lastReconcileAt = new Map<string, number>();

export async function reconcileIngressWithLiveKit(eventId: string, stageId = "main-stage"): Promise<{ checked: boolean; publishing: boolean | null; applied: "ingress_started" | "ingress_ended" | null }> {
  const state = await getOrCreateStageStreamState(eventId, stageId);
  if (state.activeStreamSource !== "LIVEKIT_INGRESS" || !state.livekitIngressId) return { checked: false, publishing: null, applied: null };
  if (state.streamStatus !== "READY_FOR_STREAMYARD" && state.streamStatus !== "LIVEKIT_INGRESS_LIVE") return { checked: false, publishing: null, applied: null };
  const key = stageStreamKey(eventId, stageId);
  const last = lastReconcileAt.get(key) ?? 0;
  if (Date.now() - last < RECONCILE_EVERY_MS) return { checked: false, publishing: null, applied: null };
  lastReconcileAt.set(key, Date.now());

  const livekit = getLiveKitEnv();
  if (!livekit.livekitUrl || !livekit.livekitApiKey || !livekit.livekitApiSecret) return { checked: false, publishing: null, applied: null };
  const roomName = normalizeLiveKitRoomName(eventId, stageId);
  let info: LiveKitIngressInfo | null = null;
  try {
    const token = createLiveKitServerToken({ apiKey: livekit.livekitApiKey, apiSecret: livekit.livekitApiSecret, roomName });
    const listed = await livekitTwirp<LiveKitIngressListResponse>({ livekitUrl: livekit.livekitUrl, token, method: "Ingress/ListIngress", body: { ingress_id: state.livekitIngressId } });
    info = (listed.items || listed.ingress || []).find((item) => item.ingress_id === state.livekitIngressId) || null;
  } catch {
    // LiveKit unreachable: say nothing rather than guess. The webhook path and the next poll remain.
    return { checked: false, publishing: null, applied: null };
  }
  await recordStagePollHeartbeat(eventId, stageId);
  if (!info) return { checked: true, publishing: null, applied: null };
  const status = String(info.state?.status ?? "");
  const publishing = PUBLISHING_STATES.has(status) ? true : STOPPED_STATES.has(status) ? false : null;
  if (publishing === true && state.streamStatus !== "LIVEKIT_INGRESS_LIVE") {
    await applyStageStreamSignal({ eventId, stageId, signal: "ingress_started", reason: "LiveKit reports the ingress is publishing (polled; no webhook arrived)." });
    return { checked: true, publishing, applied: "ingress_started" };
  }
  if (publishing === false && state.streamStatus === "LIVEKIT_INGRESS_LIVE") {
    await applyStageStreamSignal({ eventId, stageId, signal: "ingress_ended", reason: "LiveKit reports the ingress stopped publishing (polled; no webhook arrived)." });
    return { checked: true, publishing, applied: "ingress_ended" };
  }
  return { checked: true, publishing, applied: null };
}
