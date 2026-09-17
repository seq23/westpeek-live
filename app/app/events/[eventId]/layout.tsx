import type { ReactNode } from "react";
import { canonicalEventIdOrRedirect } from "@/lib/events/canonicalEventRoute";
import { EventWorkspaceSpine } from "@/components/events/EventWorkspaceSpine";
import { SafeSection } from "@/components/system/SafeSection";
import { EventChromeStack } from "@/components/command/EventChromeStack";
import { EventCommandBar } from "@/components/command/EventCommandBar";

/**
 * Every page of an event sits beside the same spine: the event's pages grouped the way the work
 * happens, with a "What's next" line above them. The spine is fail-soft — a page never dies
 * because its navigation could not read.
 */
export default async function EventAreaLayout({ children, params }: { children: ReactNode; params: Promise<{ eventId: string }> }) {
  const resolved = await params;
  const eventId = await canonicalEventIdOrRedirect(resolved.eventId, (id) => `/app/events/${id}`);
  return (
    <>
    {/* Owner/operator only; renders null for everyone else. One pinned container, always. */}
    <EventChromeStack eventId={eventId || resolved.eventId}>
      <SafeSection label="Event command bar" compact render={() => EventCommandBar({ eventId: eventId || resolved.eventId })} />
    </EventChromeStack>
    <div className="flex flex-col gap-5 lg:flex-row">
      <SafeSection label="Event pages" compact render={() => EventWorkspaceSpine({ eventId: eventId || resolved.eventId })} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
    </>
  );
}
