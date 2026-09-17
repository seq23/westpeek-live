import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { canonicalEventIdOrRedirect } from "@/lib/events/canonicalEventRoute";
import { guestAccessStale } from "@/services/events/accessCodeService";
import { holdsMasterKey } from "@/lib/auth/ownerNeverEntersACode";
import { EventChromeStack } from "@/components/command/EventChromeStack";
import { EventCommandBar } from "@/components/command/EventCommandBar";
import { SafeSection } from "@/components/system/SafeSection";

export default async function EventAreaLayout({ children, params }: { children: ReactNode; params: Promise<{ eventId: string }> }) {
  const resolved = await params;
  const eventId = await canonicalEventIdOrRedirect(resolved.eventId, (id) => `/speaker/events/${id}`);
  // The speaker code was changed since this cookie was minted: back to the gate for the new link.
  // An owner or operator holding the master key is NEVER sent to a code gate, even when a guest
  // cookie they also hold went stale: that bounce is the "another gate every time I click open"
  // the owner reported. The guest keeps the gate; the master key walks through it.
  if (!(await holdsMasterKey(eventId)) && (await guestAccessStale(eventId))) redirect("/production-access/special-guest?error=rotated");
  // Owner/operator only; a speaker sees nothing of the bar.
  return <><EventChromeStack eventId={eventId || resolved.eventId}><SafeSection label="Event command bar" compact render={() => EventCommandBar({ eventId: eventId || resolved.eventId })} /></EventChromeStack>{children}</>;
}
