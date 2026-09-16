import { ManageEventTabs } from "@/components/events/ManageEventTabs";
import { EventCommunicationsDashboard } from "@/components/communications/EventCommunicationsDashboard";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export default async function EventCommunicationsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  return <div className="space-y-6"><ManageEventTabs eventId={resolvedParams.eventId} /><EventCommunicationsDashboard eventId={resolvedParams.eventId} /></div>;
}
