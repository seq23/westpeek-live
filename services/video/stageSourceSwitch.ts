import { stageSourceChoice, stageSourceLabel } from "@/lib/video/stageLiveState";
import { openLiveKitStageRoom, provisionStreamYardLiveKitIngress } from "@/services/video/livekitIngressService";
import { applyStageStreamSignal, getOperatorStageStreamState, stageStreamKey } from "@/services/video/stageStreamStateService";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import type { StageSourceChoice } from "@/types/stageStream";

export interface StageSourceSwitchResult {
  ok: boolean;
  /** One plain sentence for the person who tapped. */
  message: string;
  /** The source the stage is on after the tap (unchanged on a refusal). */
  source?: StageSourceChoice;
}

/**
 * The host's one switch between "StreamYard" and "My camera". The caller has already checked who is
 * asking (go_live). The target is explicit, so a double tap asks for the same thing twice and the
 * second does nothing. A failure leaves the current source live and says why.
 */
export async function switchStageSource(input: { eventId: string; stageId?: string; target: StageSourceChoice; actorRole: string }): Promise<StageSourceSwitchResult> {
  const stageId = input.stageId || "main-stage";
  let current: Awaited<ReturnType<typeof getOperatorStageStreamState>>;
  try {
    // A strict read first: getOrCreateStageStreamState treats a failed read as "no state yet" and
    // would hand back a fresh default, so an outage could look like a stage nobody had started.
    await getRuntimeStore().getStageStreamState(stageStreamKey(input.eventId, stageId));
    current = await getOperatorStageStreamState(input.eventId, stageId);
  } catch {
    return { ok: false, message: "The stage could not be read just now, so nothing changed. Try again in a moment." };
  }
  const choice = stageSourceChoice(current);
  const stays = `Nothing changed: attendees still see ${stageSourceLabel(current)}.`;
  try {
    if (input.target === "CAMERAS") {
      if (choice === "CAMERAS" && current.streamStatus === "LIVEKIT_CAMERAS_LIVE") return { ok: true, source: "CAMERAS", message: "You are live on cameras." };
      const room = await openLiveKitStageRoom(input.eventId, stageId);
      if (!room.ok) return { ok: false, source: choice, message: `${room.reason} ${stays}` };
      await applyStageStreamSignal({ eventId: input.eventId, stageId, signal: "operator_go_live_cameras", reason: `The ${input.actorRole} switched the stage to cameras.` });
      return { ok: true, source: "CAMERAS", message: "Live on cameras. Turn your camera on from the stage page." };
    }
    if (choice === "STREAMYARD") return { ok: true, source: "STREAMYARD", message: "StreamYard is already the source." };
    if (!current.livekitStreamKey) {
      const provisioned = await provisionStreamYardLiveKitIngress({ eventId: input.eventId, stageId, actorRole: input.actorRole });
      if (!provisioned.ok) return { ok: false, source: choice, message: `StreamYard credentials could not be made: ${provisioned.message} ${stays}` };
    }
    const cameraLive = current.streamStatus === "LIVEKIT_CAMERAS_LIVE";
    await applyStageStreamSignal({ eventId: input.eventId, stageId, signal: "operator_switch_to_streamyard", reason: `The ${input.actorRole} switched the stage to StreamYard.` });
    return { ok: true, source: "STREAMYARD", message: cameraLive ? "Waiting for StreamYard… the cameras stay on the stage until the feed arrives." : "StreamYard is the source. Start the broadcast in StreamYard to go live." };
  } catch {
    return { ok: false, source: choice, message: `The switch could not be saved just now. ${stays}` };
  }
}
