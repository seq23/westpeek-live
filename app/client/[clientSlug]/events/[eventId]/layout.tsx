import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { guestAccessStale } from "@/services/events/accessCodeService";
import { holdsMasterKey } from "@/lib/auth/ownerNeverEntersACode";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export default async function ClientEventLayout({ children, params }: { children: ReactNode; params: Promise<{ clientSlug: string; eventId: string }> }) {
  const resolved = await params;
  const record = await ensureRuntimeEvent(resolved.eventId);
  // The client code was changed since this cookie was minted: back to the gate for the new link.
  // An owner or operator holding the master key is never sent there: they never enter a code.
  const eventId = record?.id ?? resolved.eventId;
  if (!(await holdsMasterKey(eventId)) && (await guestAccessStale(eventId))) redirect("/production-access/special-guest?error=rotated");
  return <>{children}</>;
}
