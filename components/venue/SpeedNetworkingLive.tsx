"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { LiveKitRoom, RoomAudioRenderer, ControlBar, GridLayout, ParticipantTile, useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import type { MyNetworkingState } from "@/services/speed-networking/speedNetworkingService";

type Snapshot = MyNetworkingState & { registered: boolean; attendeeId: string | null };

function PairGrid() {
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], { onlySubscribed: false });
  return <GridLayout tracks={tracks} className="min-h-[320px] rounded-2xl bg-slate-950/70 p-2"><ParticipantTile /></GridLayout>;
}

function mmss(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * The 1:1 room for one match: a token for THIS room only (the server refuses anyone but the two
 * matched attendees), camera and mic ON by default — both opted in by joining — with the LiveKit
 * control bar to mute or stop either, the other person's name, the countdown, Next match, End.
 */
type Action = (formData: FormData) => void | Promise<void>;

function MatchRoom({ eventId, match, nextAction, leaveAction }: { eventId: string; match: NonNullable<Snapshot["match"]>; nextAction: Action; leaveAction: Action }) {
  const [token, setToken] = useState<string | undefined>();
  const [serverUrl, setServerUrl] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [secondsLeft, setSecondsLeft] = useState(match.secondsLeft);
  useEffect(() => { setSecondsLeft(match.secondsLeft); }, [match.id, match.secondsLeft]);
  useEffect(() => {
    const interval = window.setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1_000);
    return () => window.clearInterval(interval);
  }, [match.id]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/video/livekit-token", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, roomId: match.roomName, roomType: "speed_networking", role: "attendee" }) });
        const json = await response.json();
        if (cancelled) return;
        if (json.ok && json.result?.token?.token && json.result?.livekitUrl) { setToken(json.result.token.token); setServerUrl(json.result.livekitUrl); }
        else setError(json.error || "The networking room is not ready.");
      } catch { if (!cancelled) setError("The networking room token could not be loaded."); }
    })();
    return () => { cancelled = true; };
  }, [eventId, match.id, match.roomName]);
  return (
    <section className="rounded-3xl border border-emerald-300 bg-white p-5 shadow-sm" data-testid="networking-match" data-match-id={match.id} data-room={match.roomName} data-room-state={token ? "token-issued" : error ? "token-error" : "loading"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-800">You are matched</p>
          <h3 className="mt-1 text-2xl font-black text-slate-950" data-testid="networking-partner-name">{match.partner.name}</h3>
          <p className="text-sm text-slate-600" data-testid="networking-partner-detail">{[match.partner.company, match.partner.title].filter(Boolean).join(" · ") || "Registered attendee"}</p>
        </div>
        <div className="rounded-2xl bg-slate-950 px-4 py-2 text-white" data-testid="networking-timer" data-seconds-left={secondsLeft}>
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-300">Time left</p>
          <p className="text-2xl font-black tabular-nums">{mmss(secondsLeft)}</p>
        </div>
      </div>
      <div className="mt-4">
        {token && serverUrl ? (
          <LiveKitRoom token={token} serverUrl={serverUrl} connect audio video className="space-y-3 rounded-3xl bg-black/80 p-3 text-white" onError={(e) => setError(e.message)}>
            <PairGrid />
            <RoomAudioRenderer />
            <ControlBar variation="minimal" controls={{ camera: true, microphone: true, screenShare: false, chat: false, leave: false }} />
          </LiveKitRoom>
        ) : (
          <div className="flex min-h-[200px] items-center justify-center rounded-2xl bg-slate-950 p-6 text-center text-sm text-slate-200" data-testid="networking-room-notice">{error ? `Video room: ${error}` : "Connecting your camera and microphone…"}</div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <form action={nextAction}><input type="hidden" name="eventId" value={eventId} /><button type="submit" className="min-h-12 rounded-full bg-slate-950 px-5 text-sm font-black text-white" data-testid="networking-next">Next match</button></form>
        <form action={leaveAction}><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="reason" value="end" /><button type="submit" className="min-h-12 rounded-full border border-slate-300 px-5 text-sm font-black" data-testid="networking-end">End networking</button></form>
      </div>
      <p className="mt-2 text-xs text-slate-500">Camera and mic are on because you both joined the queue; use the controls to mute. When the timer runs out you both return to the queue for the next match.</p>
    </section>
  );
}

/**
 * The networking page: not registered → register; idle → Join the queue; waiting → "Looking for
 * your match… N in the queue" with Leave; matched → the 1:1 room. Polls the attendee's own state
 * (~5s); every poll runs the matcher server-side.
 */
/** Join / Next / Leave / End are real server-action forms (they work before hydration and without JS); the poll keeps the state live. */
export function SpeedNetworkingLive({ eventId, initial, serverJoinForm = false, joinAction, nextAction, leaveAction }: { eventId: string; initial: Snapshot; serverJoinForm?: boolean; joinAction: Action; nextAction: Action; leaveAction: Action }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(initial);
  // The server already rendered the Join queue form for this idle state; the client's own join appears once the state has moved.
  const [touched, setTouched] = useState(false);
  // A poll that started before an action must not overwrite the action's answer: only the latest request applies.
  const seq = useRef(0);
  const refresh = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const response = await fetch(`/api/networking/mine?eventId=${encodeURIComponent(eventId)}`, { cache: "no-store" });
      const json = await response.json();
      if (mine !== seq.current) return;
      if (json.ok) { setSnapshot(json); if (json.status !== initial.status) setTouched(true); }
    } catch { /* keep the last snapshot */ }
  }, [eventId, initial.status]);
  useEffect(() => {
    const interval = window.setInterval(refresh, 5_000);
    return () => window.clearInterval(interval);
  }, [refresh]);
  const registerHref = `/events/${eventId}/register?reason=networking`;
  return (
    <div className="space-y-4" data-testid="networking-live" data-networking-status={snapshot.registered ? snapshot.status : "unregistered"} data-queue-size={snapshot.queueSize}>
      {!snapshot.registered ? (
        <section className="rounded-3xl bg-white p-6 shadow-sm" data-testid="networking-registration-required">
          <p className="text-sm font-black text-slate-950">Register once to meet other attendees.</p>
          <p className="mt-1 text-sm text-slate-600">Networking matches use your event-scoped attendee identity — your name and company — nothing else.</p>
          <a href={registerHref} className="mt-4 inline-block min-h-12 rounded-full bg-brand-orange px-6 py-3 text-base font-black text-white" data-testid="networking-register-link">Register</a>
        </section>
      ) : snapshot.status === "closed" ? (
        <section className="rounded-3xl bg-white p-6 shadow-sm" data-testid="networking-closed"><p className="text-sm font-black text-slate-950">The crew has closed networking for now.</p><p className="mt-1 text-sm text-slate-600">Come back when they open it; this page updates on its own.</p></section>
      ) : snapshot.status === "matched" && snapshot.match ? (
        <MatchRoom eventId={eventId} match={snapshot.match} nextAction={nextAction} leaveAction={leaveAction} />
      ) : snapshot.status === "waiting" ? (
        <section className="rounded-3xl bg-white p-6 shadow-sm" data-testid="networking-waiting">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">In the queue</p>
          <h3 className="mt-2 text-2xl font-black text-slate-950">Looking for your match…</h3>
          <p className="mt-1 text-sm text-slate-600" data-testid="networking-queue-count">{snapshot.queueSize} {snapshot.queueSize === 1 ? "person" : "people"} in the queue · {snapshot.matchesInProgress} match{snapshot.matchesInProgress === 1 ? "" : "es"} in progress · {snapshot.matchMinutes} minutes per match</p>
          <p className="mt-3 text-sm text-slate-600">The moment someone compatible is waiting you are paired; your camera and mic come on in the room. Stay on this page.</p>
          <form action={leaveAction} className="mt-4"><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="reason" value="leave" /><button type="submit" className="min-h-12 rounded-full border border-slate-300 px-5 text-sm font-black" data-testid="networking-leave">Leave the queue</button></form>
        </section>
      ) : serverJoinForm && !touched ? null : (
        <section className="rounded-3xl bg-white p-6 shadow-sm" data-testid="networking-idle">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Speed networking</p>
          <h3 className="mt-2 text-2xl font-black text-slate-950">Meet another attendee, {snapshot.matchMinutes} minutes at a time</h3>
          <p className="mt-1 text-sm text-slate-600">{snapshot.queueSize} {snapshot.queueSize === 1 ? "person is" : "people are"} waiting right now. Join and you are paired with the longest-waiting person you have not met; camera and mic come on in your 1:1 room.</p>
          <form action={joinAction} className="mt-4"><input type="hidden" name="eventId" value={eventId} /><button type="submit" className="min-h-12 rounded-full bg-slate-950 px-6 text-base font-black text-white" data-testid="networking-join">Join queue</button></form>
        </section>
      )}
    </div>
  );
}
