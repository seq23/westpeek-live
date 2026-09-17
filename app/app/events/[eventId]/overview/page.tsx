import { EventOverview } from "@/components/events/EventOverview";
import { SafeSection } from "@/components/system/SafeSection";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export const dynamic = "force-dynamic";

export default async function EventOverviewPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  return <SafeSection label="Overview" render={() => EventOverview({ eventId: resolvedParams.eventId })} />;
}
