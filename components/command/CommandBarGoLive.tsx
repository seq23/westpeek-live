import { cache } from "react";
import { DeniedNote, GatedForm } from "@/components/moderation/GatedForm";
import { EndShowControl } from "@/components/moderation/EndShowControl";
import { SafeSection } from "@/components/system/SafeSection";
import { StreamCredentials } from "@/components/stage/StreamCredentials";
import { goLiveAction } from "@/lib/actions/goLiveActions";
import { viewerCan, type CrewViewer } from "@/lib/auth/crewViewer";
import { findEventRecord } from "@/services/events/eventRepository";
import { getOperatorStageStreamState } from "@/services/video/stageStreamStateService";

/**
 * Go live / End show, and the credentials that come with them, on the bar itself (plan §2.1, §2.5).
 *
 * One click flips the event AND provisions or reuses the ingress — `goLiveAction` does both — then
 * the credentials row below the bar opens ON ITS OWN, so the RTMP URL and stream key are on the
 * page the producer was already on. No navigation: the action revalidates and the page re-renders.
 *
 * The same `StreamCredentials` the Go-live card uses, so the masking, the Reveal, the copy buttons,
 * "Copy both for StreamYard" and the confirm before replacing a working key are one implementation
 * rather than two that drift.
 */

interface GoLiveShape {
  status: string;
  live: boolean;
  ended: boolean;
  hasCredentials: boolean;
  rtmpUrl?: string;
  streamKey?: string;
  problem?: string;
}

/** Cached per render: the button and the credentials row below it ask the same two questions. */
const readShape = cache(async function readShape(eventId: string, stageId: string): Promise<GoLiveShape> {
  const [event, state] = await Promise.all([
    findEventRecord(eventId).catch(() => undefined),
    getOperatorStageStreamState(eventId, stageId).catch(() => undefined),
  ]);
  const status = event?.status || "draft";
  return {
    status,
    live: status === "live",
    ended: status === "ended" || status === "replay_available" || Boolean(state?.operatorMarkedShowEnded),
    hasCredentials: Boolean(state?.livekitStreamKey && state?.livekitIngressUrl),
    rtmpUrl: state?.livekitIngressUrl,
    streamKey: state?.livekitStreamKey,
    problem: state?.lastProvisionError,
  };
});

/** The primary control on the bar row: one button, the right one for the state the show is in. */
export async function CommandBarGoLive({ eventId, viewer, stageId = "main-stage" }: { eventId: string; viewer: CrewViewer; stageId?: string }) {
  const shape = await readShape(eventId, stageId);
  if (shape.live) return <SafeSection label="End show" compact render={() => EndShowControl({ eventId, stageId, variant: "bar", viewer })} />;
  return (
    <GatedForm viewer={viewer} action="go_live" formAction={goLiveAction} testId="command-bar-go-live">
      <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="stageId" value={stageId} />
      <button className="rounded-full bg-brand-orange px-4 py-1.5 text-sm font-black text-white hover:bg-white hover:text-brand-black disabled:cursor-not-allowed disabled:opacity-40" data-testid="command-bar-go-live-button">
        {shape.ended ? "Go live again" : "Go live"}
      </button>
    </GatedForm>
  );
}

/**
 * The row under the bar that the Go live click expands into. Open by default the moment credentials
 * exist — the producer pressed one button and the stream key must be in front of them, not behind
 * a second click. After End the show it reads why the key is gone and offers one button back.
 */
export async function CommandBarCredentials({ eventId, viewer, stageId = "main-stage" }: { eventId: string; viewer: CrewViewer; stageId?: string }) {
  const shape = await readShape(eventId, stageId);
  return (
    <details open={shape.hasCredentials || shape.ended} className="border-t border-white/10 bg-brand-black/95 px-4 py-2" data-testid="command-bar-credentials" data-has-credentials={shape.hasCredentials ? "true" : "false"} data-ended={shape.ended ? "true" : "false"}>
      <summary className="cursor-pointer list-none text-xs font-black uppercase tracking-[0.25em] text-white/70 hover:text-white">
        Stream credentials {shape.hasCredentials ? "▾" : shape.ended ? "▾" : "▸"}
      </summary>
      <div className="mt-2 rounded-2xl bg-white p-3">
        <DeniedNote viewer={viewer} action="go_live" className="mb-2" />
        <StreamCredentials eventId={eventId} rtmpUrl={shape.rtmpUrl} streamKey={shape.streamKey} ended={shape.ended} problem={shape.problem} canAct={viewerCan(viewer, "go_live")} />
      </div>
    </details>
  );
}
