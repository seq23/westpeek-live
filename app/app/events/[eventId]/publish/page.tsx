import { EventPublishPanel } from "@/components/events/EventPublishPanel";
import { GoLiveCard } from "@/components/stage/GoLiveCard";
import { SafeSection } from "@/components/system/SafeSection";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export const dynamic = "force-dynamic";

export default async function EventPublishPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams?: Promise<{ updated?: string; error?: string }> }) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  await ensureRuntimeEvent(resolvedParams.eventId);
  return (
    <div className="space-y-6">
      <SafeSection label="Go live" render={() => GoLiveCard({ eventId: resolvedParams.eventId, returnTo: `/app/events/${resolvedParams.eventId}/publish` })} />
      <EventPublishPanel eventId={resolvedParams.eventId} updated={resolvedSearchParams?.updated} error={resolvedSearchParams?.error} />
    </div>
  );
}
