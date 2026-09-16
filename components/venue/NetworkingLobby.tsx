import type { VirtualVenueModel } from "@/types/virtualVenue";
import { AnalyticsBeacon } from "@/components/analytics/AnalyticsBeacon";
import { SpeedNetworkingQueuePanel } from "./SpeedNetworkingQueuePanel";
import { SafeSection } from "@/components/system/SafeSection";

export function NetworkingLobby({ model }: { model: VirtualVenueModel }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
      <AnalyticsBeacon eventId={model.eventId} kind="networking_joined" />
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Networking</p>
        <h2 className="mt-2 text-3xl font-semibold">Meet another attendee</h2>
        <p className="mt-2 text-slate-600">Join the queue for timed 1:1 video conversations. You are paired with the longest-waiting attendee you have not met yet; camera and mic come on in a private room for the two of you, a timer counts down, and when it ends you both go back to the queue. Next match or End networking at any time.</p>
      </section>
      <SafeSection label="Networking queue" render={() => SpeedNetworkingQueuePanel({ eventId: model.eventId })} />
    </div>
  );
}
