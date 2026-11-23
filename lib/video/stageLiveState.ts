import type { PublicStageStreamState, StageSourceChoice } from "@/types/stageStream";

/**
 * The ONE answer to "is the main stage live?", read by the player and by the venue menu alike.
 *
 * They used to answer it separately: the player from the stream state, the menu from the agenda
 * clock (a session scheduled for now). On the demo venue the agenda said a session was on, no
 * stream had ever started, and an attendee saw "Stage LIVE" in the menu over a player reading
 * "Pre-stream" (walkthrough, 7 Nov 2026). The stream is the fact; the agenda is a plan.
 */
type StageLiveInput = Pick<PublicStageStreamState, "activeStreamSource" | "streamStatus" | "hasEverStarted">;

/** The player shows its pre-stream card: LiveKit is the source and no picture has ever arrived. */
export function stageShowsPreStream(state: StageLiveInput): boolean {
  return state.activeStreamSource === "LIVEKIT_INGRESS"
    && !state.hasEverStarted
    && (state.streamStatus === "GENERATING_CREDENTIALS" || state.streamStatus === "READY_FOR_STREAMYARD" || state.streamStatus === "STREAMYARD_CONNECTED");
}

/** A provider is actually carrying a picture to attendees. Never true while the player is pre-stream. */
export function stageIsLive(state: StageLiveInput | undefined): boolean {
  if (!state) return false;
  return !stageShowsPreStream(state) && /_LIVE$/.test(state.streamStatus);
}

type StageSourceInput = Pick<PublicStageStreamState, "activeStreamSource" | "streamStatus" | "hasEverStarted" | "stageSource">;

/** The host's switch: "StreamYard" (the feed carries the stage) or "My camera" (people on camera, no feed). */
export function stageSourceChoice(state: Pick<PublicStageStreamState, "stageSource"> | undefined): StageSourceChoice {
  return state?.stageSource === "CAMERAS" ? "CAMERAS" : "STREAMYARD";
}

/** Switched to StreamYard mid camera show: cameras stay on stage until the feed lands. */
export function stageWaitingForStreamYard(state: StageSourceInput | undefined): boolean {
  return Boolean(state) && state!.streamStatus === "LIVEKIT_CAMERAS_LIVE" && stageSourceChoice(state) === "STREAMYARD";
}

/** On cameras the LiveKit player hides any StreamYard feed still publishing into the room (picture and sound). */
export function stageHidesProductionFeed(state: StageSourceInput | undefined): boolean {
  return Boolean(state) && state!.activeStreamSource === "LIVEKIT_INGRESS" && stageSourceChoice(state) === "CAMERAS";
}

export function stageShowEnded(state: Pick<PublicStageStreamState, "streamStatus"> | undefined): boolean {
  return state?.streamStatus === "ENDED";
}

const SOURCE_NAMES: Record<string, string> = {
  CLOUDFLARE_STREAM: "Cloudflare Stream",
  DAILY: "Daily",
  ZOOM: "Zoom",
  GOOGLE_MEET: "Google Meet",
};

/**
 * The ONE label for what the stage is showing, read by the player footer, the go-live switch, the
 * owner console, the command bar and event health, so every reader names the same source.
 */
export function stageSourceLabel(state: StageSourceInput | undefined): string {
  if (!state) return "Not started";
  if (stageShowEnded(state)) return "Ended";
  if (state.activeStreamSource !== "LIVEKIT_INGRESS") return `${SOURCE_NAMES[state.activeStreamSource] || state.activeStreamSource} (fallback)`;
  if (stageWaitingForStreamYard(state)) return "Cameras · waiting for StreamYard…";
  if (stageSourceChoice(state) === "CAMERAS") return stageIsLive(state) ? "Cameras" : "Cameras · not live";
  if (stageShowsPreStream(state)) return "StreamYard · not live yet";
  return stageIsLive(state) ? "StreamYard" : "StreamYard · feed off";
}

/** Why "move down to Cloudflare Stream" is refused in a camera show, in the producer's words. */
export const CAMERA_SHOW_CLOUDFLARE_REASON = "This show is on cameras, not a StreamYard feed, so Cloudflare Stream has nothing to carry. Move down to Daily instead.";
