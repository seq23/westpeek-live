import { SponsorPortalLive } from "@/components/sponsors/SponsorPortalLive";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { getCurrentGuestIdentity } from "@/services/guests/guestIdentityService";

export const dynamic = "force-dynamic";

export default async function SponsorReportPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams?: Promise<{ saved?: string; error?: string }> }) {
  const { eventId } = await params;
  const query = searchParams ? await searchParams : undefined;
  await ensureRuntimeEvent(eventId);
  const sponsor = await getCurrentGuestIdentity(eventId, "sponsor");
  return <SponsorPortalLive eventId={eventId} surface="report" sponsor={sponsor} saved={query?.saved === "1"} error={query?.error} />;
}
