import type { VirtualVenueModel } from "@/types/virtualVenue";
import { VenueNav } from "./VenueNav";
import { WestPeekLiveWordmark } from "@/components/brand/WestPeekLiveWordmark";
import { WestPeekLogoHomeLink } from "@/components/brand/WestPeekLogo";
import type { VenueActivity } from "@/services/venue/venueActivityService";

/**
 * A toolbar, not a crest. One row, identical on every venue page: which event, how to move, and who
 * you are signed in as. It used to run about 250px, repeated on all ten pages, and on a phone that
 * WAS the screen (the owner, 16 Sep 2026). The tiles' information lives in the nav markers now.
 *
 * It is no longer pinned on its own. It is the second level of the one sticky chrome stack, and
 * `subordinate` says whether the command bar is above it:
 *
 *  - subordinate: the bar above already names the event and carries the wordmark's job, so this row
 *    drops both. That is the duplicated event name the owner saw printed twice, and dropping it is
 *    also what buys the nav the width it needs to stop ending mid-word.
 *  - on its own (an attendee, who never sees the command bar): it is the whole stack, so it keeps
 *    the wordmark and the event name and sits at the top by itself.
 */
export function VenueHeader({ model, attendee, activity, subordinate = false }: { model: VirtualVenueModel; attendee?: { name: string; company: string }; activity?: VenueActivity; subordinate?: boolean }) {
  return (
    <header
      className={`flex items-center gap-2 px-3 py-1 text-white sm:px-4 ${subordinate ? "border-t border-white/10 bg-brand-black/95" : "bg-brand-black shadow-brand"}`}
      data-chrome-bar="venue-nav"
      data-venue-sub-bar={subordinate ? "true" : "false"}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center gap-2">
        {subordinate ? null : (
          <>
            <WestPeekLogoHomeLink size="sm" inverse />
            <span className="hidden shrink-0 sm:block"><WestPeekLiveWordmark size="sm" inverse /></span>
            <h1 className="max-w-[9rem] shrink truncate text-xs font-black tracking-[-0.02em] sm:max-w-[14rem]" data-chrome-event-name="venue-nav">{model.eventName}</h1>
          </>
        )}
        <VenueNav items={model.nav} activity={activity} attendeeName={attendee?.name} tellUsMoreHref={`/venue/${model.eventId}/lobby#tell-us-more`} />
      </div>
    </header>
  );
}
