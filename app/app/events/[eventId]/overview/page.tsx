import { EventOverview } from "@/components/events/EventOverview";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export default async function EventOverviewPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  return <EventOverview eventId={resolvedParams.eventId} />;
}
