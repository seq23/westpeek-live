import type { EventStatus } from "@/types/core";
import { mapEventStatusToPublicState } from "@/services/events/eventStateResolver";

/**
 * What the venue shows for an event in a given state. One pure rule for every venue page
 * (the shell applies it) and for the poll that refreshes the page when the state changes:
 *   ended / replay_available, or the stage marked ENDED → the ended state (replay page allowed);
 *   archived → the archived notice; draft (not public) → "not open yet", except for a host
 *   (owner / operator / executive producer) previewing; otherwise open.
 */
export type VenueGate = "open" | "ended" | "archived" | "draft";

export function venueGateFor(input: { status: EventStatus | undefined; stageEnded?: boolean; isHost?: boolean; surface?: "replay" | "other" }): VenueGate {
  const { status, stageEnded = false, isHost = false, surface = "other" } = input;
  if (!status) return "open";
  const publicState = mapEventStatusToPublicState(status);
  if (publicState === "archived") return "archived";
  if (publicState === "ended" || stageEnded) return surface === "replay" ? "open" : "ended";
  if (publicState === "draft") return isHost ? "open" : "draft";
  return "open";
}

/** The join code's own words for each state, so the venue and /join never disagree. */
export const VENUE_GATE_MESSAGE: Record<Exclude<VenueGate, "open">, string> = {
  ended: "Event ended. Replay access is available.",
  archived: "This event is archived and no longer publicly available.",
  draft: "This event is not publicly open yet.",
};
