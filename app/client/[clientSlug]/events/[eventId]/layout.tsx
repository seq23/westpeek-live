import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { guestAccessStale } from "@/services/events/accessCodeService";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export default async function ClientEventLayout({ children, params }: { children: ReactNode; params: Promise<{ clientSlug: string; eventId: string }> }) {
  const resolved = await params;
  const record = await ensureRuntimeEvent(resolved.eventId);
  // The client code was changed since this cookie was minted: back to the gate for the new link.
  if (await guestAccessStale(record?.id ?? resolved.eventId)) redirect("/production-access/special-guest?error=rotated");
  return <>{children}</>;
}
