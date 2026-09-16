import { randomId, base64UrlEncode } from "@/lib/security/portableCrypto";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { findEventRecord } from "@/services/events/eventRepository";
import type { StageStreamEvent, StageStreamSignal, StageStreamState } from "@/types/stageStream";
import { toOperatorStageStreamState, toPublicStageStreamState } from "@/types/stageStream";

export function stageStreamKey(eventId: string, stageId = "main-stage") {
  return `${eventId}:${stageId}`;
}

function now() {
  return new Date().toISOString();
}

function configuredCloudflarePlaybackUrl() {
  return process.env.CLOUDFLARE_STREAM_FALLBACK_PLAYBACK_URL || process.env.NEXT_PUBLIC_CLOUDFLARE_STREAM_FALLBACK_PLAYBACK_URL || undefined;
}

function configuredGoogleMeetUrl() {
  return process.env.GOOGLE_MEET_MANAGED_FALLBACK_URL || process.env.GOOGLE_MEET_EMERGENCY_URL || undefined;
}

function configuredZoomMeetingNumber() {
  return process.env.TIER4_ZOOM_MEETING_NUMBER || process.env.ZOOM_MEETING_NUMBER || undefined;
}

function defaultStageStreamState(eventId: string, stageId = "main-stage"): StageStreamState {
  const timestamp = now();
  return {
    eventId,
    stageId,
    activeStreamSource: "LIVEKIT_INGRESS",
    producerStudioSource: "STREAMYARD",
    streamStatus: "GENERATING_CREDENTIALS",
    failurePlane: "NONE",
    fallbackMode: "MANUAL_REQUIRED",
    livekitRoomName: `${eventId}-${stageId}`.replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase(),
    cloudflareStreamPlaybackUrl: configuredCloudflarePlaybackUrl(),
    zoomMeetingNumber: configuredZoomMeetingNumber(),
    googleMeetFallbackUrl: configuredGoogleMeetUrl(),
    hasEverStarted: false,
    operatorMarkedShowEnded: false,
    manualFallbackDisabled: false,
    mainStageAttendeeJoinEnabled: false,
    breakoutAttendeeCameraEnabled: true,
    fallbackRecommendation: "Generate StreamYard-compatible RTMP credentials, connect StreamYard Custom RTMP, then watch the show-day ladder: LiveKit + StreamYard → LiveKit + Cloudflare Stream → Daily → Zoom → Google Meet.",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function getOrCreateStageStreamState(eventId: string, stageId = "main-stage") {
  const store = getRuntimeStore();
  const key = stageStreamKey(eventId, stageId);
  const existing = await store.getStageStreamState(key).catch(() => undefined);
  if (existing) return { ...existing, cloudflareStreamPlaybackUrl: existing.cloudflareStreamPlaybackUrl || configuredCloudflarePlaybackUrl(), zoomMeetingNumber: existing.zoomMeetingNumber || configuredZoomMeetingNumber(), googleMeetFallbackUrl: existing.googleMeetFallbackUrl || configuredGoogleMeetUrl() };
  const created = defaultStageStreamState(eventId, stageId);
  await store.setStageStreamState(key, created).catch(() => created);
  return created;
}

export async function getPublicStageStreamState(eventId: string, stageId = "main-stage") {
  return toPublicStageStreamState(await getOrCreateStageStreamState(eventId, stageId));
}

export async function getOperatorStageStreamState(eventId: string, stageId = "main-stage") {
  return toOperatorStageStreamState(await getOrCreateStageStreamState(eventId, stageId));
}

function eventFor(state: StageStreamState, signal: StageStreamSignal, previousSource: StageStreamState["activeStreamSource"], message: string): StageStreamEvent {
  return {
    id: randomId("stage-stream"),
    eventId: state.eventId,
    stageId: state.stageId,
    signal,
    previousSource,
    nextSource: state.activeStreamSource,
    failurePlane: state.failurePlane,
    message,
    createdAt: now(),
  };
}

function keepAttendeesInsideStage(state: StageStreamState) {
  state.mainStageAttendeeJoinEnabled = false;
}

function activateCloudflareFallback(state: StageStreamState, reason?: string) {
  state.streamStatus = "SWITCHING_TO_CLOUDFLARE_STREAM";
  state.failurePlane = state.failurePlane === "NONE" ? "STREAMYARD_FEED" : state.failurePlane;
  state.activeStreamSource = "CLOUDFLARE_STREAM";
  state.producerStudioSource = "CLOUDFLARE_STREAM";
  state.fallbackMode = state.manualFallbackDisabled ? "MANUAL_REQUIRED" : "AUTO_RECOMMENDED";
  state.fallbackReason = reason || "Primary StreamYard/LiveKit path degraded; moving to the embedded Cloudflare Stream fallback before Daily.";
  state.fallbackActivatedAt = state.manualFallbackDisabled ? undefined : now();
  state.cloudflareStreamPlaybackUrl = state.cloudflareStreamPlaybackUrl || configuredCloudflarePlaybackUrl();
  keepAttendeesInsideStage(state);
  state.fallbackRecommendation = "Owner/showrunner/crew: start or verify the Cloudflare Stream Live fallback, keep attendee messaging generic, and move back to StreamYard/LiveKit if the primary path recovers.";
}

function activateDailyFallback(state: StageStreamState, reason?: string) {
  state.streamStatus = "SWITCHING_TO_DAILY";
  state.failurePlane = state.failurePlane === "NONE" ? "CLOUDFLARE_STREAM" : state.failurePlane;
  state.activeStreamSource = "DAILY";
  state.producerStudioSource = "STREAMYARD";
  state.fallbackMode = "AUTO_RECOMMENDED";
  state.fallbackReason = reason || "Cloudflare Stream fallback degraded; moving attendees to Daily before Zoom.";
  state.fallbackActivatedAt = now();
  keepAttendeesInsideStage(state);
  state.fallbackRecommendation = "Owner/showrunner/crew: Daily is the next embedded fallback. Keep attendee language provider-neutral unless support must intervene.";
}

function activateZoomFallback(state: StageStreamState, reason?: string) {
  state.streamStatus = "SWITCHING_TO_ZOOM";
  state.failurePlane = "DAILY_FALLBACK";
  state.activeStreamSource = "ZOOM";
  state.producerStudioSource = "ZOOM";
  state.fallbackMode = "MANUAL_OVERRIDE";
  state.fallbackReason = reason || "Daily fallback failed; move to Zoom with crew/showrunner confirmation.";
  state.fallbackActivatedAt = now();
  state.zoomMeetingNumber = state.zoomMeetingNumber || configuredZoomMeetingNumber();
  keepAttendeesInsideStage(state);
  state.fallbackRecommendation = "Owner/showrunner/crew: authorize Zoom fallback, keep attendees inside the branded venue when embedded Zoom is configured, and roll back upward if Daily or Cloudflare recovers.";
}

function activateGoogleMeetFallback(state: StageStreamState, reason?: string) {
  state.streamStatus = "SWITCHING_TO_GOOGLE_MEET";
  state.failurePlane = "ZOOM_FALLBACK";
  state.activeStreamSource = "GOOGLE_MEET";
  state.producerStudioSource = "GOOGLE_MEET";
  state.fallbackMode = "MANUAL_OVERRIDE";
  state.fallbackReason = reason || "Zoom fallback failed; final continuity fallback is Google Meet.";
  state.fallbackActivatedAt = now();
  state.googleMeetFallbackUrl = state.googleMeetFallbackUrl || configuredGoogleMeetUrl();
  state.mainStageAttendeeJoinEnabled = false;
  state.fallbackRecommendation = "Owner/showrunner/crew: Google Meet is the final continuity fallback. This is the first rung where attendees may need explicit external-room instructions.";
}

export function evaluateStageFallbackDecision(previous: StageStreamState, signal: StageStreamSignal, reason?: string): StageStreamState {
  const state: StageStreamState = { ...previous, updatedAt: now(), cloudflareStreamPlaybackUrl: previous.cloudflareStreamPlaybackUrl || configuredCloudflarePlaybackUrl(), zoomMeetingNumber: previous.zoomMeetingNumber || configuredZoomMeetingNumber(), googleMeetFallbackUrl: previous.googleMeetFallbackUrl || configuredGoogleMeetUrl() };
  if (signal === "generate_credentials") {
    state.streamStatus = "READY_FOR_STREAMYARD";
    state.failurePlane = "NONE";
    state.fallbackMode = "MANUAL_REQUIRED";
    state.activeStreamSource = "LIVEKIT_INGRESS";
    state.producerStudioSource = "STREAMYARD";
    state.fallbackRecommendation = "Credentials are ready. Paste RTMP URL and Stream Key into StreamYard Custom RTMP. Attendees stay on the branded stage; only backend operators see provider details.";
  }
  if (signal === "ingress_started") {
    state.hasEverStarted = true;
    state.streamStatus = "LIVEKIT_INGRESS_LIVE";
    state.failurePlane = "NONE";
    state.fallbackMode = "MANUAL_REQUIRED";
    state.activeStreamSource = "LIVEKIT_INGRESS";
    state.producerStudioSource = "STREAMYARD";
    state.fallbackReason = undefined;
    state.fallbackRecommendation = "Primary path is live: StreamYard-compatible RTMP into LiveKit. keep StreamYard running when available, keep backend monitors open, and do not expose provider detail to attendees.";
  }
  if (signal === "ingress_ended") {
    // lastWebhookEvent is set by applyStageStreamSignal only when a webhook actually delivered the
    // signal; a polled ingress_ended must not claim a webhook arrived (the console names which path is live).
    if (state.operatorMarkedShowEnded) {
      state.streamStatus = "ENDED";
      state.failurePlane = "NONE";
      state.fallbackRecommendation = "Show was intentionally ended. Do not activate fallback.";
    } else if (state.hasEverStarted) {
      state.failurePlane = "STREAMYARD_FEED";
      activateDailyFallback(state, reason || "StreamYard-compatible feed stopped after being live; switch attendees to Daily while production keeps StreamYard context visible to operators.");
    } else {
      state.streamStatus = "READY_FOR_STREAMYARD";
      state.failurePlane = "NONE";
      state.fallbackRecommendation = "Ingress ended before the show ever started. Keep attendees on pre-stream state; do not fallback during setup.";
    }
  }
  if (signal === "livekit_room_unreachable" || signal === "livekit_token_failure" || signal === "attendee_livekit_disconnect_after_started") {
    state.failurePlane = "LIVEKIT_DISTRIBUTION";
    activateCloudflareFallback(state, reason || "LiveKit/primary distribution degraded while production is still trying to keep the show moving.");
    state.producerStudioSource = "STREAMYARD";
    state.fallbackRecommendation = "Owner/showrunner/crew: keep StreamYard running while the attendee distribution path moves to Cloudflare Stream. Do not expose provider detail to attendees.";
  }
  if (signal === "manual_switch_to_cloudflare_stream") activateCloudflareFallback(state, reason || "Operator selected Cloudflare Stream fallback.");
  if (signal === "cloudflare_stream_live") {
    state.streamStatus = "CLOUDFLARE_STREAM_LIVE";
    state.failurePlane = state.failurePlane === "NONE" ? "STREAMYARD_FEED" : state.failurePlane;
    state.activeStreamSource = "CLOUDFLARE_STREAM";
    state.producerStudioSource = "CLOUDFLARE_STREAM";
    state.fallbackMode = "AUTO_SWITCHED";
    state.fallbackReason = reason || "Cloudflare Stream fallback is live.";
    state.fallbackRecommendation = "Cloudflare Stream fallback is live. Owner/showrunner/crew may roll back to StreamYard/LiveKit if primary recovers.";
    keepAttendeesInsideStage(state);
  }
  if (signal === "cloudflare_stream_failed") activateDailyFallback(state, reason || "Cloudflare Stream fallback failed or could not be joined.");
  if (signal === "manual_switch_to_daily") {
    activateDailyFallback(state, reason || "Operator selected Daily fallback.");
    state.streamStatus = "DAILY_LIVE";
    state.failurePlane = state.failurePlane === "NONE" ? "CLOUDFLARE_STREAM" : state.failurePlane;
    state.fallbackMode = "MANUAL_OVERRIDE";
    state.fallbackRecommendation = "Daily is live. Owner/showrunner/crew may roll back to Cloudflare Stream or LiveKit/StreamYard if recovered.";
  }
  if (signal === "daily_failed") activateZoomFallback(state, reason || "Daily fallback failed or token could not be issued.");
  if (signal === "move_production_to_daily") {
    activateDailyFallback(state, reason || "Producer moved production team and attendees to Daily.");
    state.streamStatus = "DAILY_LIVE";
    state.producerStudioSource = "DAILY";
    state.failurePlane = "PRIMARY_PIPELINE_TOTAL_FAILURE";
    state.fallbackMode = "MANUAL_OVERRIDE";
    state.fallbackRecommendation = "Primary pipeline is abandoned. Production and attendees are now on Daily; roll back upward only after backend confirms stability.";
  }
  if (signal === "manual_switch_to_zoom") {
    activateZoomFallback(state, reason || "Operator selected Zoom fallback.");
    state.streamStatus = "ZOOM_LIVE";
  }
  if (signal === "zoom_failed") activateGoogleMeetFallback(state, reason || "Zoom fallback failed or could not be joined.");
  if (signal === "manual_switch_to_google_meet") {
    activateGoogleMeetFallback(state, reason || "Operator selected Google Meet fallback.");
    state.streamStatus = "GOOGLE_MEET_LIVE";
  }
  if (signal === "operator_rollback_to_livekit") {
    state.streamStatus = state.hasEverStarted ? "LIVEKIT_INGRESS_LIVE" : "READY_FOR_STREAMYARD";
    state.failurePlane = "NONE";
    state.activeStreamSource = "LIVEKIT_INGRESS";
    state.producerStudioSource = "STREAMYARD";
    state.fallbackMode = "MANUAL_OVERRIDE";
    state.fallbackReason = reason || "Operator rolled back to primary StreamYard-compatible RTMP through LiveKit.";
    state.fallbackRecommendation = "Primary path restored. Keep backup lanes warm until backend logs stay clean.";
  }
  if (signal === "operator_rollback_to_cloudflare_stream") {
    activateCloudflareFallback(state, reason || "Operator rolled back upward to Cloudflare Stream fallback.");
    state.streamStatus = "CLOUDFLARE_STREAM_LIVE";
    state.fallbackMode = "MANUAL_OVERRIDE";
  }
  if (signal === "operator_rollback_to_daily") {
    activateDailyFallback(state, reason || "Operator rolled back upward to Daily fallback.");
    state.streamStatus = "DAILY_LIVE";
    state.fallbackMode = "MANUAL_OVERRIDE";
  }
  if (signal === "operator_mark_show_ended") {
    state.operatorMarkedShowEnded = true;
    state.streamStatus = "ENDED";
    state.failurePlane = "NONE";
    state.fallbackMode = "MANUAL_OVERRIDE";
    state.fallbackRecommendation = "Show marked ended intentionally. Do not fallback.";
  }
  if (signal === "operator_reset_primary") {
    const reset = defaultStageStreamState(state.eventId, state.stageId);
    return { ...reset, livekitRoomName: state.livekitRoomName, livekitIngressId: state.livekitIngressId, livekitIngressUrl: state.livekitIngressUrl, livekitStreamKey: state.livekitStreamKey, createdAt: state.createdAt, updatedAt: now() };
  }
  return state;
}

/**
 * A feed that stops after the show is over is not a dropped feed. Two things say "over":
 * the operator's explicit "End the show" (operatorMarkedShowEnded on the stage state) and the
 * event itself being `ended` (the publish page, or End the show having set it). Either one, in
 * either order, turns ingress_ended into ENDED instead of a Daily failover.
 */
export async function eventIsEnded(eventId: string) {
  const event = await findEventRecord(eventId).catch(() => undefined);
  return event?.status === "ended" || event?.status === "replay_available" || event?.status === "archived";
}

export async function applyStageStreamSignal(input: { eventId: string; stageId?: string; signal: StageStreamSignal; reason?: string; webhookEvent?: string }) {
  const stored = await getOrCreateStageStreamState(input.eventId, input.stageId || "main-stage");
  const current = input.signal === "ingress_ended" && !stored.operatorMarkedShowEnded && (await eventIsEnded(input.eventId)) ? { ...stored, operatorMarkedShowEnded: true } : stored;
  const previousSource = current.activeStreamSource;
  const reason = current !== stored ? `${input.reason || "Ingress ended."} The event is already ended, so this is the end of the show, not a dropped feed.` : input.reason;
  const next = evaluateStageFallbackDecision(current, input.signal, reason);
  if (input.webhookEvent) {
    next.lastWebhookEvent = input.webhookEvent;
    next.lastWebhookAt = now();
  }
  const store = getRuntimeStore();
  const key = stageStreamKey(next.eventId, next.stageId);
  await store.setStageStreamState(key, next);
  await store.appendStageStreamEvent(eventFor(next, input.signal, previousSource, reason || next.fallbackRecommendation || input.signal)).catch(() => undefined);
  return next;
}

/**
 * Record that a poll of LiveKit answered, so the operator can see which path is carrying the
 * state when no webhook has ever arrived. Written at most once a minute per stage.
 */
export async function recordStagePollHeartbeat(eventId: string, stageId = "main-stage") {
  const store = getRuntimeStore();
  const key = stageStreamKey(eventId, stageId);
  const current = await store.getStageStreamState(key).catch(() => undefined);
  if (!current) return;
  const last = current.lastHealthCheckAt ? new Date(current.lastHealthCheckAt).getTime() : 0;
  if (Date.now() - last < 60_000) return;
  await store.setStageStreamState(key, { ...current, lastHealthCheckAt: now() }).catch(() => undefined);
}

export function createStreamKey(eventId: string, stageId: string) {
  const secret = process.env.LIVEKIT_API_SECRET || process.env.V5_ACCESS_COOKIE_SECRET || "dev-only-stage-stream-secret";
  return base64UrlEncode(`${eventId}:${stageId}:${Date.now()}:${randomId("stream")}:${secret}`).slice(0, 48);
}
