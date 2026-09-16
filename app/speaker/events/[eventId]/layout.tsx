import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { canonicalEventIdOrRedirect } from "@/lib/events/canonicalEventRoute";
import { guestAccessStale } from "@/services/events/accessCodeService";
import { EventChromeStack } from "@/components/command/EventChromeStack";
import { EventCommandBar } from "@/components/command/EventCommandBar";
import { SafeSection } from "@/components/system/SafeSection";

export default async function EventAreaLayout({ children, params }: { children: ReactNode; params: Promise<{ eventId: string }> }) {
  const resolved = await params;
  const eventId = await canonicalEventIdOrRedirect(resolved.eventId, (id) => `/speaker/events/${id}`);
  // The speaker code was changed since this cookie was minted: back to the gate for the new link.
  if (await guestAccessStale(eventId)) redirect("/production-access/special-guest?error=rotated");
  // Owner/operator only; a speaker sees nothing of the bar.
  return <><EventChromeStack eventId={eventId || resolved.eventId}><SafeSection label="Event command bar" compact render={() => EventCommandBar({ eventId: eventId || resolved.eventId })} /></EventChromeStack>{children}</>;
}
