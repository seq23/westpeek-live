"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConnectionState, createLocalAudioTrack, createLocalVideoTrack, Room, RoomEvent, Track, type LocalAudioTrack, type LocalVideoTrack } from "livekit-client";

export interface AttendeePublishGrant {
  canPublishAudio: boolean;
  canPublishVideo: boolean;
  status: string;
  reason?: string;
}

function permissionHint(error: unknown, device: "camera" | "microphone") {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return `Your browser blocked the ${device}. On iPhone Safari: tap aA in the address bar → Website Settings → ${device === "camera" ? "Camera" : "Microphone"} → Allow, then reload. On Android Chrome: tap the lock icon → Permissions.`;
  if (name === "NotFoundError" || name === "OverconstrainedError") return `No ${device} was found on this device.`;
  if (name === "NotReadableError") return `Another app is using the ${device}. Close it and try again.`;
  return error instanceof Error ? error.message : `The ${device} could not be started.`;
}

/**
 * The attendee's on-stage control bar: Turn on camera / Turn on microphone / Leave the stage.
 * Camera and mic stay OFF until tapped — never auto-published. Each tap captures the device
 * locally (the browser asks permission on that tap), shows a live preview thumbnail, and publishes
 * the track to the LiveKit room once the room is connected (immediately when it already is). If
 * the crew revokes while live, the grant prop flips and both tracks are stopped and unpublished at
 * once, with the reason shown. Big tap targets; wraps in portrait.
 */
export function AttendeeStageControls({ room, grant, className = "" }: { room?: Room; grant: AttendeePublishGrant; className?: string }) {
  const [camera, setCamera] = useState<LocalVideoTrack | undefined>();
  const [mic, setMic] = useState<LocalAudioTrack | undefined>();
  const [published, setPublished] = useState<{ camera: boolean; mic: boolean }>({ camera: false, mic: false });
  const [busy, setBusy] = useState<"camera" | "microphone" | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [connected, setConnected] = useState(room?.state === ConnectionState.Connected);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const cameraRef = useRef<LocalVideoTrack | undefined>(undefined);
  const micRef = useRef<LocalAudioTrack | undefined>(undefined);
  cameraRef.current = camera;
  micRef.current = mic;

  const publish = useCallback(async (track: LocalVideoTrack | LocalAudioTrack, source: Track.Source.Camera | Track.Source.Microphone) => {
    if (!room || room.state !== ConnectionState.Connected) return false;
    try {
      await room.localParticipant.publishTrack(track, { source });
      return true;
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "The stage did not accept your track.");
      return false;
    }
  }, [room]);

  const stopCamera = useCallback(async () => {
    const track = cameraRef.current;
    if (!track) return;
    try { if (room && room.state === ConnectionState.Connected) await room.localParticipant.unpublishTrack(track); } catch { /* the room may already be gone */ }
    track.detach();
    track.stop();
    setCamera(undefined);
    setPublished((value) => ({ ...value, camera: false }));
  }, [room]);

  const stopMic = useCallback(async () => {
    const track = micRef.current;
    if (!track) return;
    try { if (room && room.state === ConnectionState.Connected) await room.localParticipant.unpublishTrack(track); } catch { /* the room may already be gone */ }
    track.stop();
    setMic(undefined);
    setPublished((value) => ({ ...value, mic: false }));
  }, [room]);

  // Room connection: publish anything the attendee already turned on; drop the published flags on disconnect.
  useEffect(() => {
    if (!room) return;
    const onState = (state: ConnectionState) => {
      setConnected(state === ConnectionState.Connected);
      if (state === ConnectionState.Connected) {
        void (async () => {
          const cameraOk = cameraRef.current ? await publish(cameraRef.current, Track.Source.Camera) : false;
          const micOk = micRef.current ? await publish(micRef.current, Track.Source.Microphone) : false;
          setPublished({ camera: cameraOk, mic: micOk });
        })();
      } else setPublished({ camera: false, mic: false });
    };
    room.on(RoomEvent.ConnectionStateChanged, onState);
    return () => { room.off(RoomEvent.ConnectionStateChanged, onState); };
  }, [room, publish]);

  // Crew revoked (or closed publishing) while live: stop everything now and say why.
  useEffect(() => {
    if (!grant.canPublishVideo && cameraRef.current) { void stopCamera(); setNotice(grant.reason || (grant.status === "removed" ? "Removed by the crew." : "The crew paused attendee cameras.")); }
    if (!grant.canPublishAudio && micRef.current) { void stopMic(); setNotice(grant.reason || (grant.status === "removed" ? "Removed by the crew." : "The crew paused attendee microphones.")); }
  }, [grant.canPublishVideo, grant.canPublishAudio, grant.reason, grant.status, stopCamera, stopMic]);

  // Live preview thumbnail of the local camera.
  useEffect(() => {
    const element = previewRef.current;
    if (!camera || !element) return;
    camera.attach(element);
    return () => { camera.detach(element); };
  }, [camera]);

  // Leaving the page stops the devices.
  useEffect(() => () => { cameraRef.current?.stop(); micRef.current?.stop(); }, []);

  async function toggleCamera() {
    setError(undefined); setNotice(undefined);
    if (camera) { await stopCamera(); return; }
    setBusy("camera");
    try {
      const track = await createLocalVideoTrack({ facingMode: "user", resolution: { width: 640, height: 480, frameRate: 24 } });
      setCamera(track);
      const ok = await publish(track, Track.Source.Camera);
      setPublished((value) => ({ ...value, camera: ok }));
    } catch (deviceError) {
      setError(permissionHint(deviceError, "camera"));
    } finally { setBusy(undefined); }
  }

  async function toggleMic() {
    setError(undefined); setNotice(undefined);
    if (mic) { await stopMic(); return; }
    setBusy("microphone");
    try {
      const track = await createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true });
      setMic(track);
      const ok = await publish(track, Track.Source.Microphone);
      setPublished((value) => ({ ...value, mic: ok }));
    } catch (deviceError) {
      setError(permissionHint(deviceError, "microphone"));
    } finally { setBusy(undefined); }
  }

  async function leave() {
    await stopCamera();
    await stopMic();
    setError(undefined);
    setNotice("You left the stage. The crew's approval still stands; turn your camera or mic on to come back.");
  }

  const onStage = Boolean(camera || mic);
  const canAnything = grant.canPublishVideo || grant.canPublishAudio;
  // Not approved and nothing on: nothing to show. After a revoke the bar stays, off, with the reason.
  if (!canAnything && !onStage && !notice) return null;
  const cameraState = camera ? (published.camera ? "published" : "preview") : "off";
  const micState = mic ? (published.mic ? "published" : "preview") : "off";
  return (
    <div className={`rounded-2xl border border-emerald-400/40 bg-emerald-950/60 p-3 text-white ${className}`} data-testid="attendee-stage-controls" data-camera={camera ? "on" : "off"} data-mic={mic ? "on" : "off"} data-camera-published={cameraState} data-mic-published={micState} data-room-connected={connected ? "true" : "false"} data-on-stage={onStage ? "true" : "false"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-black" data-testid="attendee-stage-controls-headline">{onStage ? "On stage" : canAnything ? "You're approved. Nothing is live until you tap." : grant.status === "removed" ? "Removed by the crew" : "Stage paused by the crew"}</p>
        <p className="text-xs text-emerald-100/80">{connected ? (onStage ? (published.camera || published.mic ? "Publishing to the stage" : "Connecting your track…") : "Stage connected") : "Stage connecting — your preview starts now, it goes live once connected"}</p>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button type="button" onClick={toggleCamera} disabled={busy === "camera" || (!camera && !grant.canPublishVideo)} className={`min-h-14 rounded-2xl px-4 text-base font-black disabled:cursor-not-allowed disabled:opacity-40 ${camera ? "bg-white text-emerald-950" : "bg-emerald-500 text-emerald-950"}`} data-testid="stage-camera-toggle" aria-pressed={camera ? "true" : "false"}>{busy === "camera" ? "Starting camera…" : camera ? "Camera on · turn off" : "Turn on camera"}</button>
        <button type="button" onClick={toggleMic} disabled={busy === "microphone" || (!mic && !grant.canPublishAudio)} className={`min-h-14 rounded-2xl px-4 text-base font-black disabled:cursor-not-allowed disabled:opacity-40 ${mic ? "bg-white text-emerald-950" : "bg-emerald-500 text-emerald-950"}`} data-testid="stage-mic-toggle" aria-pressed={mic ? "true" : "false"}>{busy === "microphone" ? "Starting microphone…" : mic ? "Mic on · turn off" : "Turn on microphone"}</button>
        <button type="button" onClick={leave} disabled={!onStage} className="min-h-14 rounded-2xl border border-white/40 px-4 text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-40" data-testid="stage-leave">Leave the stage</button>
      </div>
      {camera ? <div className="mt-3 flex items-center gap-3"><video ref={previewRef} autoPlay muted playsInline className="h-24 w-32 rounded-xl bg-black object-cover" data-testid="stage-local-preview" /><p className="text-xs text-emerald-100/80">Your camera, as the room sees it.{mic ? " Mic is on." : ""}</p></div> : null}
      {notice ? <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-sm font-bold" role="status" data-testid="attendee-stage-notice">{notice}</p> : null}
      {error ? <p className="mt-3 rounded-xl bg-amber-100 px-3 py-2 text-sm font-bold text-amber-900" role="alert" data-testid="attendee-stage-device-error">{error}</p> : null}
    </div>
  );
}
