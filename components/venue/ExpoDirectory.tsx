import type { VirtualVenueBooth } from "@/types/virtualVenue";
import { SponsorBoothCard } from "./SponsorBoothCard";
import { VenueBrowse } from "./VenueBrowse";

export function ExpoDirectory({ booths, eventId }: { booths: VirtualVenueBooth[]; eventId?: string }) {
  return (
    <VenueBrowse
      eyebrow="Expo"
      title="Sponsor booths"
      intro="A booth is a page a sponsor runs: what they do, and a way to say hello. Nothing you do here reaches them unless you ask it to."
      count={booths.length}
      empty={{ title: "No sponsor booths at this event.", line: "Some events have sponsors with their own pages here. This one does not, so there is nothing to miss. The action is on the main stage.", actionHref: eventId ? `/venue/${eventId}/stage` : undefined, actionLabel: "Go to the main stage", testId: "expo-empty" }}
    >
      <div className="grid gap-4 md:grid-cols-3">{booths.map((booth) => <SponsorBoothCard key={booth.id} booth={booth} />)}</div>
    </VenueBrowse>
  );
}
