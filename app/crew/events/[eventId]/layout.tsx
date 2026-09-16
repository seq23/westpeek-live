import type { ReactNode } from "react";
import { canonicalEventIdOrRedirect } from "@/lib/events/canonicalEventRoute";
import { BuildVersionPoller } from "@/components/system/BuildVersionPoller";
import { BuildVersionWatchdog } from "@/components/system/BuildVersionWatchdog";
import { EventCommandBar } from "@/components/command/EventCommandBar";
import { SafeSection } from "@/components/system/SafeSection";

export default async function EventAreaLayout({ children, params }: { children: ReactNode; params: Promise<{ eventId: string }> }) {
  const resolved = await params;
  const eventId = (await canonicalEventIdOrRedirect(resolved.eventId, (id) => `/crew/events/${id}`)) || resolved.eventId;
  // Show day: a deploy must reload the crew deck, never break it mid-show.
  // The bar is owner/operator only — plain crew get the deck, not the master controls.
  return <><BuildVersionWatchdog /><BuildVersionPoller /><SafeSection label="Event command bar" compact render={() => EventCommandBar({ eventId })} />{children}</>;
}
