import { ClientPortalDashboard } from "@/components/clients/ClientPortal";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

/**
 * Client-facing reports for one event. The route was dropped in a June
 * baseline snapshot while the client role journey and its validator kept
 * requiring it, so the client portal 404'd on its own "Reports" promise.
 */
export default async function ClientReports({ params }: { params: Promise<{ clientSlug: string; eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  return <ClientPortalDashboard clientSlug={resolvedParams.clientSlug} eventId={resolvedParams.eventId} surface="reports" />;
}
