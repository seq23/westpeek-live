import type { VirtualVenueModel } from "@/types/virtualVenue";
import { AnalyticsBeacon } from "@/components/analytics/AnalyticsBeacon";
import { SpeedNetworkingExplainer, SpeedNetworkingHero } from "./SpeedNetworkingExplainer";
import { SpeedNetworkingQueuePanel } from "./SpeedNetworkingQueuePanel";
import { SafeSection } from "@/components/system/SafeSection";
import { getNetworkingSettings } from "@/services/speed-networking/speedNetworkingService";
import { SPEED_NETWORKING_DEFAULT_MINUTES } from "@/types/speedNetworking";

/**
 * The networking page, in the order the decision is actually made.
 *
 * It used to run: headline and paragraph, the cycle diagram, four explainer cards, the privacy
 * line, a register box, and only then Join queue — last, quiet, below the fold. "why do i have to
 * scroll to join the queue and why is it at the bottom and seem so muted!?" (the owner, walking
 * /venue/event-summit/networking, 17 Sep 2026). The explainer sold it and then made the reader
 * scroll past everything to act on it.
 *
 * Now:
 *
 *   1. SpeedNetworkingHero — the promise at the size it deserves, THE ACTION immediately under its
 *      opening paragraph with the privacy promise beside it, and then the picture of a round.
 *   2. SpeedNetworkingExplainer — the loop, and the four hesitations, for whoever wants them.
 *
 * One card, not two, and one action, not two. The page used to carry "Meet another attendee"
 * beside "Meet another attendee, 4 minutes at a time" with near-identical copy (the owner walked
 * the venue, 16 Sep 2026); what networking is gets said once, in the hero, and the panel below the
 * headline is the live state and the button. There is deliberately no second Join queue button at
 * the foot of the explainer: a quieter duplicate at the end is how the page got two of everything
 * the first time.
 *
 * This is the one component behind /venue/[eventId]/networking, so the demo event and every real
 * event get the same page — there is no demo-only copy of it to drift.
 */
export async function NetworkingLobby({ model }: { model: VirtualVenueModel }) {
  // The crew can retune the round length per event, so the page is told the real number and never
  // promises four minutes over a three-minute round. A store hiccup falls back to the platform
  // default rather than taking the page down.
  let matchMinutes = SPEED_NETWORKING_DEFAULT_MINUTES;
  try {
    matchMinutes = (await getNetworkingSettings(model.eventId)).matchMinutes || SPEED_NETWORKING_DEFAULT_MINUTES;
  } catch {
    matchMinutes = SPEED_NETWORKING_DEFAULT_MINUTES;
  }
  return (
    <div className="space-y-4 sm:space-y-6">
      <AnalyticsBeacon eventId={model.eventId} kind="networking_joined" />
      <SpeedNetworkingHero matchMinutes={matchMinutes}>
        <SafeSection label="Networking queue" render={() => SpeedNetworkingQueuePanel({ eventId: model.eventId })} />
      </SpeedNetworkingHero>
      <SpeedNetworkingExplainer matchMinutes={matchMinutes} />
    </div>
  );
}
