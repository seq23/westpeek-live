import type { ReactNode } from "react";
import { canonicalEventIdOrRedirect } from "@/lib/events/canonicalEventRoute";
import { BuildVersionPoller } from "@/components/system/BuildVersionPoller";
import { BuildVersionWatchdog } from "@/components/system/BuildVersionWatchdog";

export default async function EventAreaLayout({ children, params }: { children: ReactNode; params: Promise<{ eventId: string }> }) {
  const resolved = await params;
  await canonicalEventIdOrRedirect(resolved.eventId, (id) => `/crew/events/${id}`);
  // Show day: a deploy must reload the crew deck, never break it mid-show.
  return <><BuildVersionWatchdog /><BuildVersionPoller />{children}</>;
}
