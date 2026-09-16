import { IncidentPanel } from "@/components/production/IncidentPanel";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export default async function EventIncidentsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  return <IncidentPanel eventId={resolvedParams.eventId} />;
}
