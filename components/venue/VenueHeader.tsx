import type { VirtualVenueModel } from "@/types/virtualVenue";
import { VenueNav } from "./VenueNav";
import { WestPeekLiveWordmark } from "@/components/brand/WestPeekLiveWordmark";
import type { VenueActivity } from "@/services/venue/venueActivityService";

/**
 * One compact header, the same on all nine venue pages and sticky so the nav is always reachable.
 * It used to run about 250px — wordmark, "VIRTUAL VENUE", the event name, a sentence that was the
 * nav read aloud directly above the nav, and four stat tiles that were mostly zeros. On a phone
 * that WAS the screen (the owner, 16 Sep 2026). What is left is what an attendee needs: where they
 * are, whether the show is live, how to move, and who they are signed in as. The counts moved into
 * the nav as markers, and only where the signal is real.
 */
export function VenueHeader({ model, attendee, activity }: { model: VirtualVenueModel; attendee?: { name: string; company: string }; activity?: VenueActivity }) {
  return (
    <header className="sticky top-0 z-30 rounded-2xl bg-brand-black p-3 text-white shadow-brand sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          <WestPeekLiveWordmark size="sm" inverse />
          <h1 className="min-w-0 truncate text-base font-black tracking-[-0.03em] sm:text-lg">{model.eventName}</h1>
        </div>
        {activity?.stageLive ? (
          <a href={`/venue/${model.eventId}/stage`} className="flex items-center gap-2 rounded-full bg-brand-orange px-3 py-1 text-xs font-black uppercase tracking-[0.18em]" data-testid="venue-header-live">
            <span className="h-2 w-2 rounded-full bg-white" aria-hidden="true" />Live now
          </a>
        ) : null}
      </div>
      <div className="mt-3"><VenueNav items={model.nav} activity={activity} /></div>
      {attendee ? <p className="mt-2 text-xs text-white/70" data-testid="venue-header-attendee">You are in as <strong className="font-black text-white">{attendee.name}</strong>{attendee.company ? ` · ${attendee.company}` : ""} · <a href={`/venue/${model.eventId}/lobby#tell-us-more`} className="font-black text-brand-orange underline" data-testid="venue-header-tell-us-more">Tell us more about you</a></p> : null}
    </header>
  );
}
