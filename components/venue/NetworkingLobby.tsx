import type { VirtualVenueModel } from "@/types/virtualVenue";
import { AnalyticsBeacon } from "@/components/analytics/AnalyticsBeacon";
import { SpeedNetworkingExplainer } from "./SpeedNetworkingExplainer";
import { SpeedNetworkingQueuePanel } from "./SpeedNetworkingQueuePanel";
import { SafeSection } from "@/components/system/SafeSection";
import { getNetworkingSettings } from "@/services/speed-networking/speedNetworkingService";
import { SPEED_NETWORKING_DEFAULT_MINUTES } from "@/types/speedNetworking";

/**
 * One card, not two. The page used to carry "Meet another attendee" beside "Meet another attendee,
 * 4 minutes at a time" with near-identical copy and the button on only one of them (the owner
 * walked the venue, 16 Sep 2026). What networking is gets said once, in the panel that also holds
 * the queue state and the button.
 *
 * The explainer above it is the other half of that one saying, not a second copy of it: it is what
 * this is and what is about to happen to you, drawn; the panel below is the live state and the
 * button. Neither repeats the other, and the explanation comes first because somebody who has
 * never done this cannot decide from a button (the owner, 17 Sep 2026).
 */
export async function NetworkingLobby({ model }: { model: VirtualVenueModel }) {
  // The crew can retune the round length per event, so the explainer is told the real number and
  // never promises four minutes over a three-minute round. A store hiccup falls back to the
  // platform default rather than taking the page down.
  let matchMinutes = SPEED_NETWORKING_DEFAULT_MINUTES;
  try {
    matchMinutes = (await getNetworkingSettings(model.eventId)).matchMinutes || SPEED_NETWORKING_DEFAULT_MINUTES;
  } catch {
    matchMinutes = SPEED_NETWORKING_DEFAULT_MINUTES;
  }
  return (
    <div className="space-y-5">
      <AnalyticsBeacon eventId={model.eventId} kind="networking_joined" />
      <SpeedNetworkingExplainer matchMinutes={matchMinutes} />
      <SafeSection label="Networking queue" render={() => SpeedNetworkingQueuePanel({ eventId: model.eventId })} />
    </div>
  );
}
