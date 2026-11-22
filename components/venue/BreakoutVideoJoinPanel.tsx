"use client";
import { useState } from "react";
import { LiveKitRoomClient } from "@/components/video/LiveKitRoomClient";

interface Props {
  eventId: string;
  roomId: string;
  displayName?: string;
  attendeeId?: string;
  cameraAllowed: boolean;
  microphoneAllowed: boolean;
  screenShareAllowed: boolean;
  emergencyDisabled: boolean;
}

export function BreakoutVideoJoinPanel({ eventId, roomId, displayName, attendeeId, cameraAllowed, microphoneAllowed, screenShareAllowed, emergencyDisabled }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | undefined>();
  const [join, setJoin] = useState<{ token: string; livekitUrl: string; canPublishAudio: boolean; canPublishVideo: boolean; canShareScreen: boolean } | undefined>();

  async function requestJoin() {
    if (!displayName || !attendeeId) { setStatus("error"); setError("Register for this event before joining breakout video."); return; }
    setStatus("loading");
    setError(undefined);
    try {
      const response = await fetch("/api/video/livekit-token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId, roomId, roomType: "breakout", displayName, profileId: attendeeId, role: "attendee" }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok || !json.result?.token?.token || !json.result?.livekitUrl) {
        throw new Error(json.error || "Breakout video token was not issued.");
      }
      setJoin({
        token: json.result.token.token,
        livekitUrl: json.result.livekitUrl,
        canPublishAudio: Boolean(json.result.room?.metadata?.canPublishAudio ?? microphoneAllowed),
        canPublishVideo: Boolean(json.result.room?.metadata?.canPublishVideo ?? cameraAllowed),
        canShareScreen: Boolean(json.result.room?.metadata?.canShareScreen ?? screenShareAllowed),
      });
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Breakout video could not be loaded.");
    }
  }

  if (!displayName || !attendeeId) {
    return <div className="wpl-as-authored mt-6 rounded-3xl border border-slate-700 bg-slate-900 p-6 text-slate-200"><p className="font-black">Register to join breakout video.</p><p className="mt-2 text-sm">Breakout publishing uses your event-scoped attendee identity and crew controls.</p></div>;
  }

  if (emergencyDisabled) {
    return <div className="mt-6 rounded-3xl border border-amber-300/30 bg-amber-950/30 p-6 text-amber-50"><p className="font-black">Breakout video locked by crew.</p><p className="mt-2 text-sm">Chat stays available while camera and microphone publishing are disabled.</p></div>;
  }

  if (join) {
    return <LiveKitRoomClient token={join.token} serverUrl={join.livekitUrl} canPublishAudio={join.canPublishAudio} canPublishVideo={join.canPublishVideo} canShareScreen={join.canShareScreen} />;
  }

  return (
    <div className="wpl-as-authored mt-6 rounded-3xl border border-white/10 bg-slate-900 p-6">
      <p className="font-black">Breakout video controls</p>
      <p className="mt-2 text-sm text-slate-300">Camera: {cameraAllowed ? "allowed" : "disabled"} · Microphone: {microphoneAllowed ? "allowed" : "disabled"} · Screen share: {screenShareAllowed ? "allowed" : "disabled"}</p>
      <button type="button" onClick={requestJoin} disabled={status === "loading" || (!cameraAllowed && !microphoneAllowed)} className="mt-4 rounded-full bg-brand-orange px-5 py-3 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-500 disabled:text-slate-200">
        {status === "loading" ? "Preparing breakout video…" : "Join breakout video"}
      </button>
      {error ? <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-900">{error}</p> : null}
    </div>
  );
}
