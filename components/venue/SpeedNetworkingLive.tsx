"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LiveKitRoom, RoomAudioRenderer, ControlBar, VideoTrack, isTrackReference, useLocalParticipant, useRemoteParticipants, useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import type { TrackReference } from "@livekit/components-core";
import type { MyNetworkingState } from "@/services/speed-networking/speedNetworkingService";
import { SPEED_NETWORKING_CYCLE } from "@/types/speedNetworking";

type Snapshot = MyNetworkingState & { registered: boolean; attendeeId: string | null };

/**
 * One tile. A tile is either a live picture or a sentence saying what is actually happening — never
 * an anonymous grey avatar with a name under it, which is what made a 1:1 look like it had a
 * stranger in it (16 Sep 2026).
 */
function PairTile({ caption, trackRef, notice, mirror = false, testId }: { caption: string; trackRef?: TrackReference; notice?: string; mirror?: boolean; testId: string }) {
  return (
    <div className="relative aspect-video max-h-[42vh] overflow-hidden rounded-2xl bg-slate-900" data-testid={testId} data-tile-state={trackRef ? "video" : "notice"}>
      {trackRef ? (
        <VideoTrack trackRef={trackRef} className={`h-full w-full object-cover${mirror ? " -scale-x-100" : ""}`} />
      ) : (
        <p className="flex h-full w-full items-center justify-center px-3 text-center text-xs font-black text-slate-200 sm:text-sm" data-testid={`${testId}-notice`}>{notice}</p>
      )}
      <p className="absolute bottom-0 left-0 right-0 truncate bg-gradient-to-t from-black/80 to-transparent px-2 py-1 text-[11px] font-black text-white">{caption}</p>
    </div>
  );
}

/**
 * Exactly two tiles: your match and you, two-up at every width so a phone gets a pair side by side
 * instead of a column of full-width boxes running off the screen. Only the matched partner is ever
 * rendered — the server keeps the room to the two of you, and this is the second line of defence:
 * anyone else who somehow reaches the room is unsubscribed on sight and never drawn.
 */
function PairStage({ partnerIdentity, partnerName }: { partnerIdentity: string; partnerName: string }) {
  const cameras = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const { localParticipant } = useLocalParticipant();
  const remotes = useRemoteParticipants();
  const partner = remotes.find((participant) => participant.identity === partnerIdentity);
  const intruders = remotes.filter((participant) => participant.identity !== partnerIdentity);
  useEffect(() => {
    for (const intruder of intruders) {
      for (const publication of Array.from(intruder.trackPublications.values())) publication.setSubscribed(false);
    }
  }, [intruders]);
  const liveCamera = (identity: string) => cameras.find((ref): ref is TrackReference => ref.participant.identity === identity && isTrackReference(ref) && !ref.publication.isMuted);
  const partnerTrack = liveCamera(partnerIdentity);
  const localTrack = liveCamera(localParticipant.identity);
  return (
    <div data-testid="networking-pair-stage" data-remote-count={remotes.length} data-unexpected-count={intruders.length}>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <PairTile
          testId="networking-tile-partner"
          caption={partnerName}
          trackRef={partnerTrack}
          notice={!partner ? `Waiting for ${partnerName} to join…` : `${partnerName}'s camera is off`}
        />
        <PairTile
          testId="networking-tile-self"
          caption="You"
          trackRef={localTrack}
          mirror
          notice="Your camera is off"
        />
      </div>
      {intruders.length ? (
        <p className="mt-2 rounded-xl bg-amber-100 px-3 py-2 text-xs font-black text-amber-900" data-testid="networking-unexpected-participant">Someone who is not in this match reached the room; they are muted, hidden, and being removed. Use Next match if it persists.</p>
      ) : null}
    </div>
  );
}

/**
 * A countdown that cannot drift. The server says how many seconds are left; the moment that answer
 * arrives we turn it into a wall-clock deadline on THIS device and read the clock from then on, so
 * a backgrounded tab or a sleeping phone comes back to the true remaining time instead of however
 * many ticks a throttled interval managed to fire. Deriving the deadline from the server's own
 * `expiresAt` instead would import the gap between the two clocks; this imports only the round trip.
 */
function useDeadlineCountdown(secondsFromServer: number, receivedKey: string) {
  const deadline = useMemo(() => Date.now() + secondsFromServer * 1_000, [secondsFromServer, receivedKey]);
  const [left, setLeft] = useState(() => Math.max(0, Math.round((deadline - Date.now()) / 1_000)));
  useEffect(() => {
    const read = () => setLeft(Math.max(0, Math.round((deadline - Date.now()) / 1_000)));
    read();
    const interval = window.setInterval(read, 500);
    const onVisible = () => read();
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [deadline]);
  return left;
}

/** The local camera, with no LiveKit room behind it: the setup beat is a mirror, not a meeting. */
function CameraPreview({ testId }: { testId: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [denied, setDenied] = useState(false);
  useEffect(() => {
    let stream: MediaStream | undefined;
    let cancelled = false;
    navigator.mediaDevices?.getUserMedia({ video: true, audio: false })
      .then((granted) => {
        if (cancelled) { granted.getTracks().forEach((track) => track.stop()); return; }
        stream = granted;
        if (videoRef.current) videoRef.current.srcObject = granted;
      })
      .catch(() => { if (!cancelled) setDenied(true); });
    return () => { cancelled = true; stream?.getTracks().forEach((track) => track.stop()); };
  }, []);
  return (
    <div className="relative aspect-video max-h-[30vh] overflow-hidden rounded-2xl bg-slate-900" data-testid={testId} data-preview-state={denied ? "denied" : "live"}>
      {denied ? (
        <p className="flex h-full w-full items-center justify-center px-3 text-center text-xs font-black text-slate-200">Your camera is not available on this device. The match still works with audio.</p>
      ) : (
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />
      )}
      <p className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1 text-[11px] font-black text-white">You, before you are on</p>
    </div>
  );
}

/**
 * The setup beat between two conversations. The pair is already decided, so this says what just
 * happened, who is next, and shows the camera preview — the point of the gap is that nobody is
 * dropped straight from one stranger's face onto the next.
 */
function SetupBeat({ eventId, match, justFinishedWith, startAction, leaveAction }: { eventId: string; match: NonNullable<Snapshot["match"]>; justFinishedWith?: string; startAction?: Action; leaveAction: Action }) {
  const secondsUntilStart = useDeadlineCountdown(match.secondsUntilStart, match.id);
  return (
    <section className="rounded-3xl border border-slate-300 bg-white p-5" data-testid="networking-setup" data-match-id={match.id} data-seconds-until-start={secondsUntilStart}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {justFinishedWith ? <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500" data-testid="networking-just-finished">That is time with {justFinishedWith}</p> : null}
          <p className="mt-1 text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Up next</p>
          <h3 className="mt-1 text-2xl font-black text-slate-950" data-testid="networking-next-partner-name">{match.partner.name}</h3>
          <p className="text-sm text-slate-600" data-testid="networking-next-partner-detail">{[match.partner.company, match.partner.title].filter(Boolean).join(" · ") || "Registered attendee"}</p>
        </div>
        <div className="rounded-2xl bg-brand-orange px-4 py-2 text-white" data-testid="networking-setup-countdown">
          <p className="text-[10px] font-black uppercase tracking-wide">Starts in</p>
          <p className="text-2xl font-black tabular-nums">{secondsUntilStart}</p>
        </div>
      </div>
      <div className="mt-4"><CameraPreview testId="networking-camera-preview" /></div>
      <div className="mt-4 flex flex-wrap gap-2">
        {startAction ? <form action={startAction}><input type="hidden" name="eventId" value={eventId} /><button type="submit" className="min-h-12 rounded-full bg-slate-950 px-5 text-sm font-black text-white" data-testid="networking-start-now">Start now</button></form> : null}
        <form action={leaveAction}><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="reason" value="end" /><button type="submit" className="min-h-12 rounded-full border border-slate-300 px-5 text-sm font-black" data-testid="networking-end-setup">End networking</button></form>
      </div>
      <p className="mt-2 text-xs text-slate-500">A few seconds between matches to check your camera. When the count reaches zero you are live with {match.partner.name} for {Math.round((Date.parse(match.expiresAt) - Date.parse(match.startsAt)) / 60_000)} minutes, then straight on to the next person.</p>
    </section>
  );
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
  const secondsLeft = useDeadlineCountdown(match.secondsLeft, `${match.id}:${match.secondsLeft}`);
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
    <section className="rounded-3xl border border-emerald-300 bg-white p-5" data-testid="networking-match" data-match-id={match.id} data-room={match.roomName} data-room-state={token ? "token-issued" : error ? "token-error" : "loading"}>
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
            <PairStage partnerIdentity={match.partner.attendeeId} partnerName={match.partner.name} />
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
export function SpeedNetworkingLive({ eventId, initial, serverJoinForm = false, joinAction, nextAction, leaveAction, repeatAction, startAction }: { eventId: string; initial: Snapshot; serverJoinForm?: boolean; joinAction: Action; nextAction: Action; leaveAction: Action; repeatAction?: Action; startAction?: Action }) {
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
  /**
   * The rotation only advances when somebody reads state — every read runs the matcher server-side,
   * which is what expires a finished match and pairs the next one. So the poll IS the clock, and it
   * changes pace: a second near a transition, five when nothing is about to happen. The obvious
   * alternative, the combined /api/venue/tick, is owner and operator only and answers an attendee
   * 403, so it cannot carry this.
   *
   * A backgrounded tab has its timers throttled to about once a minute by the browser whatever we
   * ask for, so coming back to the page refreshes immediately rather than waiting for the next tick.
   */
  const aboutToChange = snapshot.status === "setup" || (snapshot.status === "matched" && (snapshot.match?.secondsLeft ?? Infinity) <= SPEED_NETWORKING_CYCLE.transitionWindowSeconds);
  const pollMs = aboutToChange ? SPEED_NETWORKING_CYCLE.transitionPollMs : SPEED_NETWORKING_CYCLE.idlePollMs;
  useEffect(() => {
    const interval = window.setInterval(refresh, pollMs);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [refresh, pollMs]);
  const registerHref = `/events/${eventId}/register?reason=networking`;
  return (
    <div className="space-y-4" data-testid="networking-live" data-networking-status={snapshot.registered ? snapshot.status : "unregistered"} data-queue-size={snapshot.queueSize} data-poll-ms={pollMs} data-setup-gap={snapshot.setupGapSeconds}>
      {!snapshot.registered ? (
        <section className="rounded-3xl bg-white p-6" data-testid="networking-registration-required">
          <p className="text-sm font-black text-slate-950">Register once to meet other attendees.</p>
          <p className="mt-1 text-sm text-slate-600">Your match sees your name and your company. Nothing else.</p>
          <a href={registerHref} className="mt-4 inline-block min-h-12 rounded-full bg-brand-orange px-6 py-3 text-base font-black text-white" data-testid="networking-register-link">Register</a>
        </section>
      ) : snapshot.status === "closed" ? (
        <section className="rounded-3xl bg-white p-6" data-testid="networking-closed"><p className="text-sm font-black text-slate-950">The crew has closed networking for now.</p><p className="mt-1 text-sm text-slate-600">Come back when they open it; this page updates on its own.</p></section>
      ) : snapshot.status === "setup" && snapshot.match ? (
        <SetupBeat key={`setup-${snapshot.match.id}`} eventId={eventId} match={snapshot.match} justFinishedWith={snapshot.justFinishedWith} startAction={startAction} leaveAction={leaveAction} />
      ) : snapshot.status === "matched" && snapshot.match ? (
        <MatchRoom key={snapshot.match.id} eventId={eventId} match={snapshot.match} nextAction={nextAction} leaveAction={leaveAction} />
      ) : snapshot.status === "waiting" ? (
        <section className="rounded-3xl bg-white p-6" data-testid="networking-waiting">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">In the queue</p>
          <h3 className="mt-2 text-2xl font-black text-slate-950">Looking for your match…</h3>
          <p className="mt-1 text-sm text-slate-600" data-testid="networking-queue-count">{snapshot.queueSize} {snapshot.queueSize === 1 ? "person" : "people"} in the queue · {snapshot.matchesInProgress} match{snapshot.matchesInProgress === 1 ? "" : "es"} in progress · {snapshot.matchMinutes} minutes per match</p>
          {snapshot.nextUp ? (
            <p className="mt-3 rounded-2xl bg-emerald-100 px-3 py-2 text-sm font-black text-emerald-900" data-testid="networking-next-up">You are next. The round ended with an odd number waiting, so you go first in the next one.</p>
          ) : null}
          {snapshot.metEveryone ? (
            <div className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 p-3" data-testid="networking-met-everyone">
              <p className="text-sm font-black text-amber-900">You have met everyone in the queue right now.</p>
              <p className="mt-1 text-sm text-amber-900">Waiting on its own will not pair you again until someone new joins. You can meet one of them a second time instead.</p>
              {repeatAction && !snapshot.repeatRequested ? (
                <form action={repeatAction} className="mt-3"><input type="hidden" name="eventId" value={eventId} /><button type="submit" className="min-h-12 rounded-full bg-amber-900 px-5 text-sm font-black text-white" data-testid="networking-allow-repeat">Meet someone again</button></form>
              ) : (
                <p className="mt-2 text-xs font-black text-amber-900" data-testid="networking-repeat-requested">Looking for someone who is also happy to meet again.</p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600" data-testid="networking-matching-note">{snapshot.tier === "scored" ? "With this many people waiting you are matched on shared topics and goals, never with your own company, and the longer you wait the more your wait outweighs everything else." : snapshot.tier === "weighted_random" ? "You are paired from the longest-waiting half of the queue, so the same two people do not keep meeting. Stay on this page." : "The moment someone compatible is waiting you are paired; your camera and mic come on in the room. Stay on this page."}</p>
          )}
          <form action={leaveAction} className="mt-4"><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="reason" value="leave" /><button type="submit" className="min-h-12 rounded-full border border-slate-300 px-5 text-sm font-black" data-testid="networking-leave">Leave the queue</button></form>
        </section>
      ) : serverJoinForm && !touched ? null : (
        <section className="rounded-3xl bg-white p-6" data-testid="networking-idle">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">Speed networking</p>
          <h3 className="mt-2 text-2xl font-black text-slate-950">Meet another attendee, {snapshot.matchMinutes} minutes at a time</h3>
          <p className="mt-1 text-sm text-slate-600">{snapshot.queueSize} {snapshot.queueSize === 1 ? "person is" : "people are"} waiting right now. Join and you are paired with the longest-waiting person you have not met; camera and mic come on in your 1:1 room.</p>
          <form action={joinAction} className="mt-4"><input type="hidden" name="eventId" value={eventId} /><button type="submit" className="min-h-12 rounded-full bg-slate-950 px-6 text-base font-black text-white" data-testid="networking-join">Join queue</button></form>
        </section>
      )}
    </div>
  );
}
