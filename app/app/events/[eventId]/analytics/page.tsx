import { EventAnalyticsDashboard } from "@/components/analytics/EventAnalyticsDashboard";
import { SafeSection } from "@/components/system/SafeSection";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export const dynamic = "force-dynamic";

export default async function EventAnalyticsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  return <SafeSection label="Analytics" render={() => EventAnalyticsDashboard({ eventId: resolvedParams.eventId })} />;
}
