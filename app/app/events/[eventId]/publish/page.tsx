import { EventPublishPanel } from "@/components/events/EventPublishPanel";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export const dynamic = "force-dynamic";

export default async function EventPublishPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams?: Promise<{ updated?: string; error?: string }> }) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  await ensureRuntimeEvent(resolvedParams.eventId);
  return <EventPublishPanel eventId={resolvedParams.eventId} updated={resolvedSearchParams?.updated} error={resolvedSearchParams?.error} />;
}
