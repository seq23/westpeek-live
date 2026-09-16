import { ClientReportBuilder } from "@/components/analytics/EventAnalyticsDashboard";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export default async function EventReportPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  return <ClientReportBuilder eventId={resolvedParams.eventId} />;
}
