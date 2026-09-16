import { releaseIngressForEvent } from "@/services/video/livekitIngressService";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";
import { findEventRecord, setEventStatus } from "@/services/events/eventRepository";
import { applyStageStreamSignal } from "@/services/video/stageStreamStateService";

export type EndShowOutcome = { stage: "ENDED"; eventStatus: "ended" | "seed_unchanged" | "already_ended" };

function actorFor(role: "owner" | "operator" | "crew"): WorkspaceActor {
  if (role === "owner") return { kind: "owner", id: "owner", label: "Sequoia Taylor / owner", role: "owner" };
  return { kind: "operator", id: "operator", label: role === "crew" ? "Crew" : "Operator", role };
}

/**
 * END THE SHOW — the crew presses this BEFORE stopping the feed.
 *
 * Marks the stage intentionally ended (so the ingress_ended that follows becomes ENDED, not a
 * Daily failover) and sets the event to `ended` (so the same holds even if the stage state is
 * ever reset). Seed events keep their compiled status; the stage mark alone protects them.
 * Not a server action: the guarded action in lib/actions/stageStreamActions.ts is the only caller
 * reachable from a request.
 */
export async function endShowForEvent(input: { eventId: string; stageId?: string; actorRole: "owner" | "operator" | "crew" }): Promise<EndShowOutcome> {
  const stageId = input.stageId || "main-stage";
  await applyStageStreamSignal({ eventId: input.eventId, stageId, signal: "operator_mark_show_ended", reason: `${input.actorRole} ended the show. A feed that stops now is the end of the show, not a dropped feed.` });
  // The ingress goes back to LiveKit with the show: the project caps how many exist (16 Sep 2026).
  await releaseIngressForEvent(input.eventId, stageId).catch(() => undefined);
  const event = await findEventRecord(input.eventId).catch(() => undefined);
  if (!event || event.source === "seed") return { stage: "ENDED", eventStatus: "seed_unchanged" };
  if (event.status === "ended" || event.status === "replay_available" || event.status === "archived") return { stage: "ENDED", eventStatus: "already_ended" };
  await setEventStatus(input.eventId, "ended", actorFor(input.actorRole));
  return { stage: "ENDED", eventStatus: "ended" };
}
