import type { ReactNode } from "react";
import { canonicalEventIdOrRedirect } from "@/lib/events/canonicalEventRoute";

export default async function EventAreaLayout({ children, params }: { children: ReactNode; params: Promise<{ eventId: string }> }) {
  const resolved = await params;
  await canonicalEventIdOrRedirect(resolved.eventId, (id) => `/crew/events/${id}`);
  return <>{children}</>;
}
