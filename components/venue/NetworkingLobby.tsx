import type { VirtualVenueModel } from "@/types/virtualVenue";
import { AnalyticsBeacon } from "@/components/analytics/AnalyticsBeacon";
import { SpeedNetworkingQueuePanel } from "./SpeedNetworkingQueuePanel";
import { SafeSection } from "@/components/system/SafeSection";

/**
 * One card, not two. The page used to carry "Meet another attendee" beside "Meet another attendee,
 * 4 minutes at a time" with near-identical copy and the button on only one of them (the owner
 * walked the venue, 16 Sep 2026). What networking is gets said once, in the panel that also holds
 * the queue state and the button.
 */
export function NetworkingLobby({ model }: { model: VirtualVenueModel }) {
  return (
    <div className="space-y-5">
      <AnalyticsBeacon eventId={model.eventId} kind="networking_joined" />
      <SafeSection label="Networking queue" render={() => SpeedNetworkingQueuePanel({ eventId: model.eventId })} />
    </div>
  );
}
