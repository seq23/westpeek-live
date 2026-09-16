import { EventAnalyticsDashboard } from "@/components/analytics/EventAnalyticsDashboard";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export default async function EventAnalyticsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  return <EventAnalyticsDashboard eventId={resolvedParams.eventId} />;
}
