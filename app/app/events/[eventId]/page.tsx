import { ProductionCommandCenter } from "@/components/production/ProductionCommandCenter";
import { ManageEventTabs } from "@/components/events/ManageEventTabs";
import { RuntimeEventHeader } from "@/components/events/RuntimeEventHeader";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export const dynamic = "force-dynamic";

export default async function EventCommandCenterPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams?: Promise<{ created?: string; error?: string; roster?: string; diagnose?: string }> }) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const runtimeEvent = await ensureRuntimeEvent(resolvedParams.eventId);
  return (
    <div className="space-y-6">
      <ManageEventTabs eventId={resolvedParams.eventId} />
      {runtimeEvent && runtimeEvent.source !== "seed" ? <RuntimeEventHeader event={runtimeEvent} justCreated={resolvedSearchParams?.created === "1"} error={resolvedSearchParams?.error} returnTo={`/app/events/${resolvedParams.eventId}`} /> : null}
      <ProductionCommandCenter eventId={resolvedParams.eventId} rosterSearch={resolvedSearchParams?.roster || ""} diagnose={resolvedSearchParams?.diagnose} />
    </div>
  );
}
