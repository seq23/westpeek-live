import type { VirtualVenueModel } from "@/types/virtualVenue";
import { VenueNav } from "./VenueNav";
import { LivePill } from "./LivePill";
import { WestPeekLiveWordmark } from "@/components/brand/WestPeekLiveWordmark";
import type { VenueActivity } from "@/services/venue/venueActivityService";

/**
 * A toolbar, not a crest. One row, sticky, identical on every venue page: who we are, which event,
 * whether it is live, how to move, and who you are signed in as. It used to run about 250px — a
 * wordmark, an eyebrow, the event name, a sentence that was the nav read aloud directly above the
 * nav, and four stat tiles that were mostly zeros — repeated on all ten pages. On a phone that WAS
 * the screen (the owner, 16 Sep 2026). The tiles' information lives in the nav markers now.
 */
export function VenueHeader({ model, attendee, activity }: { model: VirtualVenueModel; attendee?: { name: string; company: string }; activity?: VenueActivity }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 rounded-2xl bg-brand-black px-3 text-white shadow-brand">
      <span className="hidden shrink-0 sm:block"><WestPeekLiveWordmark size="sm" inverse /></span>
      <h1 className="max-w-[9rem] shrink truncate text-sm font-black tracking-[-0.02em] sm:max-w-[14rem]">{model.eventName}</h1>
      {activity?.stageLive ? <span className="shrink-0"><LivePill href={`/venue/${model.eventId}/stage`} /></span> : null}
      <VenueNav items={model.nav} activity={activity} attendeeName={attendee?.name} tellUsMoreHref={`/venue/${model.eventId}/lobby#tell-us-more`} />
    </header>
  );
}
