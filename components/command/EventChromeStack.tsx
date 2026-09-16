import type { ReactNode } from "react";
import { EventCommandCredentials } from "@/components/command/EventCommandBar";

/**
 * The ONE sticky region on an event-scoped page.
 *
 * Two agents built two sticky bars that had never seen each other, and on 16 Sep 2026 they landed
 * on the same page: at rest they stacked and the venue nav covered the "Stream credentials"
 * heading; on scroll the nav slid up over the command bar and hid its controls. Each was pinned to
 * the top independently with no shared offset, which is a collision waiting for a second bar.
 *
 * So there is one pinned element and everything in the chrome goes inside it, in order. Anything
 * that is not chrome scrolls, including the credentials panel this renders underneath.
 *
 * It returns a fragment on purpose: a sticky element can only travel inside its own parent's box,
 * so wrapping the pin in a div as tall as the chrome would unpin it the moment the page scrolled
 * past the chrome. The pinned div's parent has to be the page.
 */
export function EventChromeStack({ eventId, children }: { eventId: string; children: ReactNode }) {
  return (
    <>
      <div className="sticky top-0 z-30 shadow-lg" data-chrome-stack="" data-testid="event-chrome-stack">{children}</div>
      <EventCommandCredentials eventId={eventId} />
    </>
  );
}
