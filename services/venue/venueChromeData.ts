import { cache } from "react";
import { getCurrentAttendeeProfile } from "@/services/attendees/attendeeSessionService";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import type { VirtualVenueModel } from "@/types/virtualVenue";
import { EMPTY_VENUE_ACTIVITY, getVenueActivity, type VenueActivity } from "./venueActivityService";
import { buildVirtualVenueModel } from "./virtualVenueService";

/**
 * The chrome at the top of a venue page is now rendered by the LAYOUT, not by the page, so that the
 * command bar and the venue nav can sit in one sticky container instead of two that slid over each
 * other (the owner on /venue/{id}/stage, 16 Sep 2026: "i cant see all the rest of the top bar").
 *
 * The layout and the page shell below it both need the same three reads. `cache` makes them one
 * read per request: the layout asks first, the shell gets the same promise back. Without it every
 * venue page would pay for the activity probe twice.
 *
 * Fail soft, like everything else the venue reads at request time: a dead store costs the nav its
 * markers or the attendee chip, never the page.
 */
export interface VenueChromeData {
  model: VirtualVenueModel;
  activity: VenueActivity;
  attendee?: { name: string; company: string };
}

export const venueChromeData = cache(async function venueChromeData(eventId: string): Promise<VenueChromeData> {
  // The pages call this too, but the layout renders first and the synchronous model builders read
  // through the overlay, so the layout has to hydrate it or the nav names a fallback event.
  await ensureRuntimeEvent(eventId).catch(() => undefined);
  const model = buildVirtualVenueModel(eventId);
  const [activity, profile] = await Promise.all([
    getVenueActivity(model).catch(() => EMPTY_VENUE_ACTIVITY),
    getCurrentAttendeeProfile(eventId).catch(() => undefined),
  ]);
  return { model, activity, attendee: profile ? { name: profile.name, company: profile.company } : undefined };
});
