import { createHmac } from "crypto";
import { getLiveKitEnv } from "@/lib/env";
import { normalizeLiveKitApiBaseUrl } from "@/services/video/livekitIngressService";
import { pingRuntimeStore } from "@/services/runtime/supabaseKeepAlive";
import { CLOUDFLARE_WORKERS_PLAN, livekitPlan, livekitTier, type AllowanceKey, type LiveKitPlan } from "@/lib/capacity/capacityPlans";
import requiredSecrets from "@/deployment/cloudflare-required-secrets.json";

/**
 * WHERE WE ARE AGAINST THE PLANS, read rather than asserted.
 *
 * What LiveKit's server API can actually tell us with the project credentials is what is happening
 * RIGHT NOW: which rooms exist, how many people are in them, and how many ingresses are publishing.
 * The month-to-date totals — transcode minutes burned, participant-minutes, downstream GB, the
 * concurrency peak — live in LiveKit Cloud's billing dashboard and are not on the twirp API the
 * server credentials open. So those come back as `null` with a reason, and the readout prints
 * "unknown". A zero there would read as "600 minutes left" on a month that had already spent 500.
 */

/** A number we either read or honestly did not. `value: null` always carries a `unknownReason`. */
export interface CapacityReading {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  /** Empty when `value` is a real reading; otherwise why we could not get it, in the owner's words. */
  unknownReason: string;
  /** What `value` is measured against, when there is one to measure against. */
  limit: number | null;
  /** "month" is month-to-date against an allowance; "now" is a live reading of this instant. */
  window: "month" | "now";
  source: string;
}

const DASHBOARD_ONLY = "LiveKit Cloud reports month-to-date usage in its billing dashboard only; the project API key cannot read it. Open the LiveKit dashboard for the figure.";

function unknown(key: string, label: string, unit: string, limit: number | null, reason: string, window: CapacityReading["window"], source: string): CapacityReading {
  return { key, label, value: null, unit, unknownReason: reason, limit, window, source };
}

// ---------------------------------------------------------------------------
// LiveKit: the same twirp shape livekitIngressService uses, with the grants a
// project-wide read needs (roomList) rather than the single-room admin grant
// the ingress provisioner mints.
// ---------------------------------------------------------------------------

function base64UrlEncode(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function createLiveKitReadToken(input: { apiKey: string; apiSecret: string }) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(JSON.stringify({
    iss: input.apiKey,
    sub: "west-peek-live-capacity-readout",
    iat: now,
    nbf: now,
    exp: now + 120,
    video: { roomList: true, roomAdmin: true, ingressAdmin: true },
  }));
  const signature = createHmac("sha256", input.apiSecret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

async function capacityTwirp<T>(input: { livekitUrl: string; token: string; method: string; body: unknown }): Promise<T> {
  const response = await fetch(`${normalizeLiveKitApiBaseUrl(input.livekitUrl)}/twirp/livekit.${input.method}`, {
    method: "POST",
    headers: { "authorization": `Bearer ${input.token}`, "content-type": "application/json" },
    body: JSON.stringify(input.body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`LiveKit API ${input.method} failed (${response.status}): ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) as T : {} as T;
}

interface LiveKitRoom { name?: string; num_participants?: number; numParticipants?: number }
interface LiveKitIngressRow { ingress_id?: string; state?: { status?: string | number } }

/** LiveKit's IngressState.status — the same mapping the stage reconciler uses. */
const PUBLISHING_STATES = new Set(["ENDPOINT_PUBLISHING", "ENDPOINT_BUFFERING", "2", "1"]);

export interface LiveKitLiveSnapshot {
  ok: boolean;
  roomsLive: number | null;
  participantsNow: number | null;
  ingressesPublishing: number | null;
  /** Empty when the snapshot was read. */
  detail: string;
}

export async function readLiveKitLiveSnapshot(): Promise<LiveKitLiveSnapshot> {
  const livekit = getLiveKitEnv();
  if (!livekit.livekitUrl || !livekit.livekitApiKey || !livekit.livekitApiSecret) {
    return { ok: false, roomsLive: null, participantsNow: null, ingressesPublishing: null, detail: "LiveKit server credentials are not set on this deployment (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)." };
  }
  try {
    const token = createLiveKitReadToken({ apiKey: livekit.livekitApiKey, apiSecret: livekit.livekitApiSecret });
    const rooms = await capacityTwirp<{ rooms?: LiveKitRoom[] }>({ livekitUrl: livekit.livekitUrl, token, method: "RoomService/ListRooms", body: {} });
    const ingress = await capacityTwirp<{ items?: LiveKitIngressRow[]; ingress?: LiveKitIngressRow[] }>({ livekitUrl: livekit.livekitUrl, token, method: "Ingress/ListIngress", body: {} });
    const roomList = rooms.rooms || [];
    const ingressList = ingress.items || ingress.ingress || [];
    return {
      ok: true,
      roomsLive: roomList.length,
      participantsNow: roomList.reduce((total, room) => total + Number(room.num_participants ?? room.numParticipants ?? 0), 0),
      ingressesPublishing: ingressList.filter((row) => PUBLISHING_STATES.has(String(row.state?.status ?? ""))).length,
      detail: "",
    };
  } catch (error) {
    return { ok: false, roomsLive: null, participantsNow: null, ingressesPublishing: null, detail: error instanceof Error ? error.message : String(error) };
  }
}

// ---------------------------------------------------------------------------
// The whole position, in the order the owner should read it.
// ---------------------------------------------------------------------------

export interface CapacityPosition {
  readAt: string;
  plan: LiveKitPlan;
  /** Month-to-date against the LiveKit allowances. Transcode minutes first — it is the first cliff. */
  livekit: CapacityReading[];
  /** What LiveKit is doing this instant, which the API does tell us. */
  livekitNow: CapacityReading[];
  cloudflare: CapacityReading[];
  supabase: CapacityReading[];
}

function livekitAllowanceLimit(plan: LiveKitPlan, key: AllowanceKey) {
  return plan.allowances.find((allowance) => allowance.key === key)?.included ?? null;
}

export async function readCapacityPosition(): Promise<CapacityPosition> {
  const plan = livekitPlan(livekitTier());
  const [snapshot, ping] = await Promise.all([readLiveKitLiveSnapshot(), pingRuntimeStore()]);

  const livekit: CapacityReading[] = [
    unknown("transcodeMinutes", "Transcode minutes this month", "min", livekitAllowanceLimit(plan, "transcodeMinutes"), DASHBOARD_ONLY, "month", "LiveKit Cloud dashboard"),
    unknown("participantMinutes", "Participant-minutes this month", "participant-min", livekitAllowanceLimit(plan, "participantMinutes"), DASHBOARD_ONLY, "month", "LiveKit Cloud dashboard"),
    unknown("downstreamGb", "Downstream this month", "GB", livekitAllowanceLimit(plan, "downstreamGb"), DASHBOARD_ONLY, "month", "LiveKit Cloud dashboard"),
    unknown("concurrentPeak", "Concurrent peak this month", "connections", livekitAllowanceLimit(plan, "concurrentConnections"), DASHBOARD_ONLY, "month", "LiveKit Cloud dashboard"),
  ];

  const nowReason = snapshot.detail || "LiveKit did not answer.";
  const livekitNow: CapacityReading[] = [
    snapshot.ingressesPublishing === null
      ? unknown("ingressesPublishing", "Ingresses publishing right now", "feeds", null, nowReason, "now", "LiveKit Ingress/ListIngress")
      : { key: "ingressesPublishing", label: "Ingresses publishing right now", value: snapshot.ingressesPublishing, unit: "feeds", unknownReason: "", limit: null, window: "now", source: "LiveKit Ingress/ListIngress" },
    snapshot.participantsNow === null
      ? unknown("participantsNow", "Participants connected right now", "connections", livekitAllowanceLimit(plan, "concurrentConnections"), nowReason, "now", "LiveKit RoomService/ListRooms")
      : { key: "participantsNow", label: "Participants connected right now", value: snapshot.participantsNow, unit: "connections", unknownReason: "", limit: livekitAllowanceLimit(plan, "concurrentConnections"), window: "now", source: "LiveKit RoomService/ListRooms" },
    snapshot.roomsLive === null
      ? unknown("roomsLive", "Rooms open right now", "rooms", null, nowReason, "now", "LiveKit RoomService/ListRooms")
      : { key: "roomsLive", label: "Rooms open right now", value: snapshot.roomsLive, unit: "rooms", unknownReason: "", limit: null, window: "now", source: "LiveKit RoomService/ListRooms" },
  ];

  const declaredVariables = Array.isArray(requiredSecrets.requiredSecrets) ? requiredSecrets.requiredSecrets.length : null;
  const cloudflare: CapacityReading[] = [
    declaredVariables === null
      ? unknown("workerVariables", "Worker variables declared", "variables", CLOUDFLARE_WORKERS_PLAN.variablesPerWorker, "deployment/cloudflare-required-secrets.json did not parse.", "now", "repo secret manifest")
      : { key: "workerVariables", label: "Worker variables declared", value: declaredVariables, unit: "variables", unknownReason: "", limit: CLOUDFLARE_WORKERS_PLAN.variablesPerWorker, window: "now", source: "deployment/cloudflare-required-secrets.json" },
    unknown("workerRequests", "Worker requests this month", "requests", CLOUDFLARE_WORKERS_PLAN.includedRequests, "Worker request counts come from the Cloudflare analytics API, which needs an account API token this deployment does not carry. Open the Workers dashboard for the figure.", "month", "Cloudflare dashboard"),
    unknown("streamMinutes", "Cloudflare Stream minutes stored", "min", null, "Cloudflare Stream usage comes from the Stream dashboard; the Worker holds no Stream API token. Pay-as-you-go, so there is no allowance to run out of — only a bill.", "month", "Cloudflare dashboard"),
  ];

  const supabase: CapacityReading[] = [
    { key: "supabaseAwake", label: "Runtime store answering", value: ping.ok ? 1 : 0, unit: ping.ok ? "yes" : "no", unknownReason: "", limit: null, window: "now", source: `${ping.store} store · ${ping.detail || "single-row read succeeded"}` },
    unknown("supabaseDatabaseMb", "Database size", "MB", 500, "Supabase reports database size through its management API, which needs a personal access token this deployment does not carry. Open the Supabase dashboard for the figure.", "now", "Supabase dashboard"),
    unknown("supabaseEgressGb", "Egress this month", "GB", 5, "Supabase reports egress in its dashboard only.", "month", "Supabase dashboard"),
  ];

  return { readAt: new Date().toISOString(), plan, livekit, livekitNow, cloudflare, supabase };
}
