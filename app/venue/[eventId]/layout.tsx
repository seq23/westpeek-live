import type { ReactNode } from "react";
import { canonicalEventIdOrRedirect } from "@/lib/events/canonicalEventRoute";
import { EventCommandBar } from "@/components/command/EventCommandBar";
import { SafeSection } from "@/components/system/SafeSection";

export default async function EventAreaLayout({ children, params }: { children: ReactNode; params: Promise<{ eventId: string }> }) {
  const resolved = await params;
  const eventId = (await canonicalEventIdOrRedirect(resolved.eventId, (id) => `/venue/${id}`)) || resolved.eventId;
  // The bar renders for owner and operator cookies ONLY and null for everyone else, so an attendee
  // in the room never sees go live, the codes or the stream key. It is what lets the owner moderate
  // from inside their own room instead of bouncing back out to the crew deck.
  return <><SafeSection label="Event command bar" compact render={() => EventCommandBar({ eventId })} />{children}</>;
}
