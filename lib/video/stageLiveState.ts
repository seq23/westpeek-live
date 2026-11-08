import type { PublicStageStreamState } from "@/types/stageStream";

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
