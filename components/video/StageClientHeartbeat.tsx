"use client";
import { useEffect } from "react";
import { useRoomContext } from "@livekit/components-react";
import { ConnectionQuality, RoomEvent } from "livekit-client";
import { CURRENT_BUILD_ID } from "@/lib/runtime/buildVersion";

const QUALITY_WORD: Record<string, "excellent" | "good" | "poor" | "lost" | "unknown"> = {
  [ConnectionQuality.Excellent]: "excellent",
  [ConnectionQuality.Good]: "good",
  [ConnectionQuality.Poor]: "poor",
  [ConnectionQuality.Lost]: "lost",
  [ConnectionQuality.Unknown]: "unknown",
};

/**
 * Renders nothing; reports the one thing the server cannot see.
 *
 * LiveKit's RoomService tells a producer who is connected and what is being published, but NOT what
 * a viewer is subscribed to and NOT how good their connection is — LiveKit keeps both on the client.
 * Without this, "connected but receiving nothing" (our bug) and "receiving it badly" (their network)
 * are indistinguishable from the crew deck, which is exactly the question Diagnose has to answer.
 *
 * Sits inside <LiveKitRoom>, so `useRoomContext` is the attendee's real room. One small POST every
 * 20s while the tab is visible, and one immediately on a quality change, so a drop shows up in the
 * roster while the producer is still looking at it.
 */
export function StageClientHeartbeat({ eventId, surface = "stage", intervalMs = 20_000 }: { eventId: string; surface?: string; intervalMs?: number }) {
  const room = useRoomContext();
  useEffect(() => {
    if (!room) return;
    let cancelled = false;
    const send = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      // Subscribed, not published: what is actually reaching this person's screen.
      let subscribedTracks = 0;
      room.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((publication) => { if (publication.isSubscribed) subscribedTracks += 1; });
      });
      try {
        await fetch("/api/venue/client-heartbeat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ eventId, surface, buildId: CURRENT_BUILD_ID, subscribedTracks, connectionQuality: QUALITY_WORD[room.localParticipant?.connectionQuality as string] || "unknown" }),
          keepalive: true,
        });
      } catch { /* a heartbeat is never worth breaking a show over; the next tick tries again */ }
    };
    const timer = window.setInterval(send, intervalMs);
    const onQuality = () => { void send(); };
    room.on(RoomEvent.ConnectionQualityChanged, onQuality);
    void send();
    return () => { cancelled = true; window.clearInterval(timer); room.off(RoomEvent.ConnectionQualityChanged, onQuality); };
  }, [room, eventId, surface, intervalMs]);
  return null;
}
