import { ClientPortalDashboard } from "@/components/clients/ClientPortal";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
export default async function ClientROS({ params }: { params: Promise<{ clientSlug: string; eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId); return <ClientPortalDashboard clientSlug={resolvedParams.clientSlug} eventId={resolvedParams.eventId} />; }
