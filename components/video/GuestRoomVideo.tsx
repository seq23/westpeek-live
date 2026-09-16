"use client";
import { useEffect, useState } from "react";
import { LiveKitRoomClient } from "@/components/video/LiveKitRoomClient";
import type { LiveKitRoomSurface } from "@/types/livekitRoomUi";

/**
 * A LiveKit room for a speaker or crew member: asks /api/video/livekit-token for THIS role and
 * room, then connects with the grants the server allowed. The green room is where crew and
 * speakers see and hear each other before going live; the main stage is where an invited speaker
 * publishes. The server refuses a token the grant rules do not allow; this component just shows why.
 */
export function GuestRoomVideo({ eventId, roomId, roomType, role, displayName, title }: { eventId: string; roomId: string; roomType: LiveKitRoomSurface; role: "speaker" | "producer" | "host"; displayName: string; title: string }) {
  const [token, setToken] = useState<string | undefined>();
  const [serverUrl, setServerUrl] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [permissions, setPermissions] = useState({ canPublishAudio: false, canPublishVideo: false, canShareScreen: false });
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/video/livekit-token", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, roomId, roomType, displayName, role }) });
        const json = await response.json();
        if (cancelled) return;
        if (json.ok && json.result?.token?.token && json.result?.livekitUrl) {
          setToken(json.result.token.token);
          setServerUrl(json.result.livekitUrl);
          setPermissions({ canPublishAudio: Boolean(json.permissions?.canPublishAudio), canPublishVideo: Boolean(json.permissions?.canPublishVideo), canShareScreen: Boolean(json.permissions?.canShareScreen) });
        } else setError(json.error || "The video room is not ready.");
      } catch { if (!cancelled) setError("The video room token could not be loaded."); }
    }
    load();
    return () => { cancelled = true; };
  }, [eventId, roomId, roomType, role, displayName]);
  const state = token && serverUrl ? "token-issued" : error ? "token-error" : "loading";
  return (
    <div className="rounded-3xl bg-slate-950 p-4 text-white" data-testid={`guest-room-video-${roomType}`} data-room-state={state}>
      <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">{title}</p>
      {token && serverUrl ? (
        <div className="mt-3"><LiveKitRoomClient serverUrl={serverUrl} token={token} canPublishAudio={permissions.canPublishAudio} canPublishVideo={permissions.canPublishVideo} canShareScreen={permissions.canShareScreen} /></div>
      ) : (
        <div className="mt-3 flex aspect-video items-center justify-center rounded-2xl bg-slate-900 p-6 text-center text-sm text-slate-300" data-testid="guest-room-video-message">{error || "Connecting…"}</div>
      )}
    </div>
  );
}
