/**
 * How ready each rung of the show-day ladder actually is, read from the environment rather than
 * asserted in prose. Fallback 1 (Cloudflare Stream) is configured in production since 16 Sep 2026:
 * the playback URL attendees get and the RTMPS pair the producer pastes into StreamYard. A rung
 * with nothing behind it must say so and must refuse the "Move down" button — a producer who
 * clicks it on show day would otherwise send the room to a black player.
 */
export type LadderSource = "LIVEKIT_INGRESS" | "CLOUDFLARE_STREAM" | "DAILY" | "ZOOM" | "GOOGLE_MEET";

export interface RungReadiness {
  source: LadderSource;
  rung: string;
  label: string;
  ready: boolean;
  /** Why it is not ready, in the producer's words. Empty when ready. */
  reason: string;
}

type Env = Record<string, string | undefined>;

function has(env: Env, ...keys: string[]) {
  return keys.some((key) => Boolean((env[key] || "").trim()));
}

export function cloudflareFallbackReady(env: Env = process.env) {
  return has(env, "CLOUDFLARE_STREAM_FALLBACK_PLAYBACK_URL", "NEXT_PUBLIC_CLOUDFLARE_STREAM_FALLBACK_PLAYBACK_URL") && has(env, "CLOUDFLARE_STREAM_FALLBACK_RTMPS_KEY");
}

export function ladderReadiness(env: Env = process.env): RungReadiness[] {
  const livekit = has(env, "LIVEKIT_API_KEY") && has(env, "LIVEKIT_API_SECRET") && has(env, "LIVEKIT_URL", "NEXT_PUBLIC_LIVEKIT_URL");
  const cloudflare = cloudflareFallbackReady(env);
  const daily = has(env, "DAILY_API_KEY") && has(env, "DAILY_DOMAIN");
  const zoom = has(env, "TIER4_ZOOM_MEETING_NUMBER", "ZOOM_MEETING_NUMBER");
  const meet = has(env, "GOOGLE_MEET_MANAGED_FALLBACK_URL", "GOOGLE_MEET_EMERGENCY_URL");
  return [
    { source: "LIVEKIT_INGRESS", rung: "Primary", label: "StreamYard-compatible RTMP to LiveKit", ready: livekit, reason: livekit ? "" : "LiveKit keys are not set — the primary path cannot mint ingress credentials." },
    { source: "CLOUDFLARE_STREAM", rung: "Fallback 1", label: "LiveKit + Cloudflare Stream Live", ready: cloudflare, reason: cloudflare ? "" : "Cloudflare Stream has no playback URL or stream key on this Worker — attendees would get a black player." },
    { source: "DAILY", rung: "Fallback 2", label: "Daily embedded room", ready: daily, reason: daily ? "" : "Daily API key or domain is not set." },
    { source: "ZOOM", rung: "Fallback 3", label: "Zoom embedded/manual escalation", ready: zoom, reason: zoom ? "" : "No Zoom meeting number is configured." },
    { source: "GOOGLE_MEET", rung: "Final", label: "Google Meet continuity room", ready: meet, reason: meet ? "" : "No Google Meet continuity room URL is configured." },
  ];
}

export function rungReadiness(source: LadderSource, env: Env = process.env) {
  return ladderReadiness(env).find((rung) => rung.source === source)!;
}

/** The RTMPS pair the producer pastes into StreamYard. The key is a secret: masked until revealed, never logged. */
export function cloudflareFallbackCredentials(env: Env = process.env) {
  const enabled = (env.CLOUDFLARE_STREAM_FALLBACK_ENABLED || "").trim().toLowerCase();
  return {
    rtmpsUrl: (env.CLOUDFLARE_STREAM_FALLBACK_RTMPS_URL || "").trim() || undefined,
    streamKey: (env.CLOUDFLARE_STREAM_FALLBACK_RTMPS_KEY || "").trim() || undefined,
    playbackUrl: (env.CLOUDFLARE_STREAM_FALLBACK_PLAYBACK_URL || env.NEXT_PUBLIC_CLOUDFLARE_STREAM_FALLBACK_PLAYBACK_URL || "").trim() || undefined,
    liveInputId: (env.CLOUDFLARE_STREAM_LIVE_INPUT_ID || "").trim() || undefined,
    enabled: enabled === "1" || enabled === "true",
    ready: cloudflareFallbackReady(env),
  };
}

/** What the producer does with the pair, in the order they do it. Self-contained: they read this on show day, not us. */
export const CLOUDFLARE_FALLBACK_STEPS = [
  "In StreamYard → Destinations → Add destination → Custom RTMP.",
  "Paste the RTMPS URL and the stream key below.",
  "Go live to BOTH destinations (LiveKit primary and this one).",
  "Click “Move down: Cloudflare Stream” here; attendees swap in about 10 seconds.",
  "When LiveKit is healthy again, click “Move back up: LiveKit/StreamYard”.",
];
