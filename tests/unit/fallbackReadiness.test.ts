import { describe, expect, it } from "vitest";
import { CLOUDFLARE_FALLBACK_STEPS, cloudflareFallbackCredentials, cloudflareFallbackReady, ladderReadiness, rungReadiness } from "@/lib/video/fallbackReadiness";

/**
 * Fallback 1 became real on 16 Sep 2026 (playback URL + RTMPS pair on the Worker). The ladder must
 * read that from the environment, not assert it in prose, and a rung with nothing behind it must
 * refuse the move — a producer clicking it on show day would send the whole room to a black player.
 */
const configured = {
  LIVEKIT_API_KEY: "k", LIVEKIT_API_SECRET: "s", LIVEKIT_URL: "wss://x",
  CLOUDFLARE_STREAM_FALLBACK_ENABLED: "1",
  CLOUDFLARE_STREAM_FALLBACK_PLAYBACK_URL: "https://customer-x.cloudflarestream.com/abc/iframe",
  CLOUDFLARE_STREAM_FALLBACK_RTMPS_URL: "rtmps://live.cloudflare.com:443/live/",
  CLOUDFLARE_STREAM_FALLBACK_RTMPS_KEY: "key-1234567890-abcdef",
  CLOUDFLARE_STREAM_LIVE_INPUT_ID: "input-1",
};

describe("show-day ladder readiness", () => {
  it("Cloudflare Stream is ready only with BOTH a playback URL and a stream key", () => {
    expect(cloudflareFallbackReady(configured)).toBe(true);
    expect(cloudflareFallbackReady({ ...configured, CLOUDFLARE_STREAM_FALLBACK_RTMPS_KEY: "" })).toBe(false);
    expect(cloudflareFallbackReady({ ...configured, CLOUDFLARE_STREAM_FALLBACK_PLAYBACK_URL: "", NEXT_PUBLIC_CLOUDFLARE_STREAM_FALLBACK_PLAYBACK_URL: "" })).toBe(false);
    expect(cloudflareFallbackReady({})).toBe(false);
  });

  it("every rung carries a label and, when it is not ready, a reason a producer can act on", () => {
    const rungs = ladderReadiness({});
    expect(rungs.map((rung) => rung.source)).toEqual(["LIVEKIT_INGRESS", "CLOUDFLARE_STREAM", "DAILY", "ZOOM", "GOOGLE_MEET"]);
    for (const rung of rungs) {
      expect(rung.ready).toBe(false);
      expect(rung.reason.length).toBeGreaterThan(10);
    }
    const ready = rungReadiness("CLOUDFLARE_STREAM", configured);
    expect(ready).toMatchObject({ rung: "Fallback 1", ready: true, reason: "" });
  });

  it("the credentials the producer pastes come back whole, and the steps are the five they follow", () => {
    const credentials = cloudflareFallbackCredentials(configured);
    expect(credentials).toMatchObject({ rtmpsUrl: "rtmps://live.cloudflare.com:443/live/", streamKey: "key-1234567890-abcdef", liveInputId: "input-1", enabled: true, ready: true });
    expect(cloudflareFallbackCredentials({}).ready).toBe(false);
    expect(cloudflareFallbackCredentials({ ...configured, CLOUDFLARE_STREAM_FALLBACK_ENABLED: "0" }).enabled).toBe(false);
    expect(CLOUDFLARE_FALLBACK_STEPS).toHaveLength(5);
    expect(CLOUDFLARE_FALLBACK_STEPS[0]).toContain("StreamYard");
    expect(CLOUDFLARE_FALLBACK_STEPS[3]).toContain("Move down: Cloudflare Stream");
  });
});
