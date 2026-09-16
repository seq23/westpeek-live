import { ClientPortalDashboard } from "@/components/clients/ClientPortal";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { resolveViewAs } from "@/lib/auth/viewAs";
import { ViewAsBanner } from "@/components/guests/ViewAsBanner";

/** The client overview is read-only by nature; `?viewAs=<clientGuestId>` adds the banner for an owner / operator / producer. */
export default async function ClientEvent({ params, searchParams }: { params: Promise<{ clientSlug: string; eventId: string }>; searchParams?: Promise<{ viewAs?: string }> }) {
  const resolvedParams = await params;
  const query = searchParams ? await searchParams : undefined;
  await ensureRuntimeEvent(resolvedParams.eventId);
  const viewAs = await resolveViewAs(resolvedParams.eventId, query?.viewAs, "client");
  return (
    <>
      {viewAs ? <div className="bg-brand-ash px-5 pt-5 sm:px-8"><div className="mx-auto max-w-6xl"><ViewAsBanner viewAs={viewAs} backHref={`/app/events/${resolvedParams.eventId}/access`} /></div></div> : null}
      <ClientPortalDashboard clientSlug={resolvedParams.clientSlug} eventId={resolvedParams.eventId} />
    </>
  );
}
