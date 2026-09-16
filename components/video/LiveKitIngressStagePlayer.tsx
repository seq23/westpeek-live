"use client";
import { useEffect, useRef, useState } from "react";
import { LiveKitRoom, RoomAudioRenderer, useTracks, ParticipantTile, GridLayout } from "@livekit/components-react";
import { Room, Track } from "livekit-client";
import type { AttendeePublishGrant } from "@/components/video/AttendeeStageControls";

/** The production feed's participant identity, as minted by the ingress service. */
export function isProductionFeedIdentity(identity: string | undefined) {
  return Boolean(identity && identity.startsWith("streamyard-"));
}

/**
 * The production feed first and full width, with no name plate — "StreamYard Production Feed"
 * across the host's picture is not something the audience should read (Scooter's workshop,
 * 16 Sep 2026). People on the stage keep their tiles and names beneath it.
 */
function IngressTrackView() {
  // NO PLACEHOLDERS. Everyone watching joins the LiveKit room to receive the feed, and with
  // placeholders on, every viewer became an avatar tile on the stage — "Cal", a plain attendee,
  // sat above the host's picture (Scooter's workshop, 16 Sep 2026). A tile is earned by publishing:
  // the production feed, or a person the crew approved who has turned a camera or mic on.
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: false }, { source: Track.Source.ScreenShare, withPlaceholder: false }], { onlySubscribed: false });
  const publishing = tracks.filter((t) => Boolean(t.publication));
  const feed = publishing.filter((t) => isProductionFeedIdentity(t.participant?.identity));
  const people = publishing.filter((t) => !isProductionFeedIdentity(t.participant?.identity));
  return (
    <div className="space-y-3">
      {feed.length ? (
        <div className="wpl-production-feed rounded-2xl bg-black" data-testid="production-feed-tile">
          <style>{`.wpl-production-feed .lk-participant-metadata, .wpl-production-feed .lk-participant-placeholder { display: none !important; }`}</style>
          {/* 16:9, not a fixed 420px. On a 414px phone a fixed height left roughly 200px of dead
              black under a small picture and the stage read as broken (the owner, 16 Sep 2026). */}
          <GridLayout tracks={feed} className="aspect-video rounded-2xl"><ParticipantTile /></GridLayout>
        </div>
      ) : null}
      {people.length ? <GridLayout tracks={people} className={`${feed.length ? "min-h-[9rem]" : "aspect-video"} rounded-2xl bg-slate-950/70 p-3`}><ParticipantTile /></GridLayout> : null}
      {!feed.length && !people.length ? <div className="aspect-video rounded-2xl bg-slate-950/70" /> : null}
    </div>
  );
}

interface Props {
  eventId: string;
  roomId: string;
  displayName: string;
  onIngressDropAfterLive: (reason: string) => void;
  muted: boolean;
  volume: number;
  initialBufferMs?: number;
  /** The attendee's own publish grant (polled); undefined for crew/operator viewers and unregistered visitors. */
  publishGrant?: AttendeePublishGrant;
  /** The Room the attendee's control bar publishes through; owned by StagePlayer so the bar outlives player switches. */
  room?: Room;
}

export function LiveKitIngressStagePlayer({ eventId, roomId, displayName, onIngressDropAfterLive, muted, volume, initialBufferMs = 4_000, publishGrant, room: givenRoom }: Props) {
  const [token, setToken] = useState<string | undefined>();
  const [serverUrl, setServerUrl] = useState<string | undefined>();
  const [tokenCanPublish, setTokenCanPublish] = useState(false);
  // A ref, not state: as state this was a dependency of the effect that set it, so the effect
  // re-ran, its cleanup cancelled the token fetch it had just started, and the re-run returned
  // early — every attendee stage sat on "Connecting…" for good (Scooter's workshop, 16 Sep 2026).
  const fetchedForGrant = useRef<boolean | undefined>(undefined);
  const [startedOnce, setStartedOnce] = useState(false);
  const [bufferOpen, setBufferOpen] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [ownRoom, setOwnRoom] = useState<Room | undefined>();
  const room = givenRoom || ownRoom;
  const fallbackTriggered = useRef(false);
  const removed = publishGrant?.status === "removed";
  const removedRef = useRef(removed);
  removedRef.current = removed;
  const grantWantsPublish = Boolean(publishGrant && (publishGrant.canPublishAudio || publishGrant.canPublishVideo));

  // One Room object for the life of the player (StagePlayer hands one down for attendees so the
  // control bar can publish through it directly, even while the room is still connecting).
  useEffect(() => {
    if (givenRoom) return;
    const instance = new Room();
    setOwnRoom(instance);
    return () => { void instance.disconnect(); };
  }, [givenRoom]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setBufferOpen(false), initialBufferMs);
    return () => window.clearTimeout(timeout);
  }, [initialBufferMs]);

  // The token carries the publish grant at mint time. When the crew approves (or revokes) while
  // the attendee is watching, the polled grant changes and a fresh token is minted to match.
  useEffect(() => {
    if (removed) return;
    if (fetchedForGrant.current === grantWantsPublish) return;
    fetchedForGrant.current = grantWantsPublish;
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/video/livekit-token", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, roomId, roomType: "main_stage", displayName, role: "attendee" }) });
        const json = await response.json();
        if (!cancelled) {
          if (json.ok && json.result?.token?.token && json.result?.livekitUrl) {
            setToken(json.result.token.token);
            setServerUrl(json.result.livekitUrl);
            setTokenCanPublish(Boolean(json.permissions?.canPublishAudio || json.permissions?.canPublishVideo));
            setError(undefined);
          } else setError(json.error || "LiveKit stream is not ready yet.");
        }
      } catch { if (!cancelled) setError("LiveKit stream token could not be loaded."); }
    }
    load();
    return () => { cancelled = true; };
  }, [eventId, roomId, displayName, grantWantsPublish, removed]);

  useEffect(() => {
    if (error && startedOnce && !fallbackTriggered.current && !removedRef.current) {
      fallbackTriggered.current = true;
      onIngressDropAfterLive(error);
    }
  }, [error, startedOnce, onIngressDropAfterLive]);

  const consumptionState = removed ? "removed" : token && serverUrl ? "token-issued" : error ? "token-error" : "loading";

  return (
    <div data-testid="attendee-livekit-room-surface" data-livekit-consumption-state={consumptionState} data-room-id={roomId} data-token-can-publish={tokenCanPublish ? "true" : "false"}>
      {removed ? (
        <div className="flex aspect-video flex-col items-center justify-center rounded-3xl bg-slate-900 p-8 text-center text-white" data-testid="attendee-stage-removed"><p className="text-lg font-black">Removed by the crew</p><p className="mt-2 text-sm text-slate-300">{publishGrant?.reason || "The crew removed you from the live stage."}</p></div>
      ) : error && !startedOnce ? (
        <div className="flex aspect-video items-center justify-center rounded-3xl bg-slate-900 p-8 text-center text-white"><p>Stage is getting ready. Live stream will begin shortly.</p></div>
      ) : error && startedOnce ? (
        <div className="flex aspect-video items-center justify-center rounded-3xl bg-slate-900 p-8 text-center text-white"><p>Switching to backup stream, please hold...</p></div>
      ) : !token || !serverUrl || !room ? (
        <div className="flex aspect-video items-center justify-center rounded-3xl bg-slate-900 p-8 text-center text-white"><p>{bufferOpen ? "Stage is getting ready. Live stream will begin shortly." : "Connecting to LiveKit Ingress feed..."}</p></div>
      ) : (
        <LiveKitRoom key={token} room={room} token={token} serverUrl={serverUrl} connect audio={false} video={false} onConnected={() => setStartedOnce(true)} onDisconnected={() => { if (removedRef.current) return; if (startedOnce && !bufferOpen && !fallbackTriggered.current) { fallbackTriggered.current = true; onIngressDropAfterLive("LiveKit disconnected after stream had started."); } }} onError={(e) => { if (removedRef.current) return; if (startedOnce && !bufferOpen && !fallbackTriggered.current) { fallbackTriggered.current = true; onIngressDropAfterLive(e.message); } else setError(e.message); }} className="rounded-3xl border border-white/10 bg-black/40 p-2 sm:p-4">
          <IngressTrackView />
          {/* `audio` / `video` on LiveKitRoom mean PUBLISH the local devices the moment the room
              connects — so "sound on" used to open an approved attendee's mic to the room on
              connect (found 16 Sep 2026). Watching never publishes; the attendee turns their own
              camera and mic on from the control bar below, and only when approved. */}
          <RoomAudioRenderer muted={muted} volume={volume} />
          <p className="sr-only">Preferred muted state: {muted ? "muted" : "sound on"}; preferred volume: {volume}</p>
        </LiveKitRoom>
      )}
    </div>
  );
}
