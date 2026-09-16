import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { canonicalEventIdOrRedirect } from "@/lib/events/canonicalEventRoute";
import { guestAccessStale } from "@/services/events/accessCodeService";

export default async function EventAreaLayout({ children, params }: { children: ReactNode; params: Promise<{ eventId: string }> }) {
  const resolved = await params;
  const eventId = await canonicalEventIdOrRedirect(resolved.eventId, (id) => `/sponsor/events/${id}`);
  // The sponsor code was changed since this cookie was minted: back to the gate for the new link.
  if (await guestAccessStale(eventId)) redirect("/production-access/special-guest?error=rotated");
  return <>{children}</>;
}
