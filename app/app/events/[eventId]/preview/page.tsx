import { EventSetupShell } from "@/components/events/setup/EventSetupShell";
import { EventPreviewPanel } from "@/components/events/setup/SetupPanels";
import { getEventConfigPackage } from "@/services/events/eventConfigRepository";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export default async function EventSetupSubroutePage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  const config = getEventConfigPackage(resolvedParams.eventId);
  return (
    <EventSetupShell eventId={resolvedParams.eventId} active="preview" eyebrow="Setup · Preview" title="Preview all journeys">
      <EventPreviewPanel paths={[`/events/${config.event.slug}`, `/events/${config.event.slug}/register`, `/venue/${config.event.id}/lobby`, `/speaker/events/${config.event.id}`, `/sponsor/events/${config.event.id}`, `/client/${config.event.clientSlug || "client"}/events/${config.event.id}`]} />
    </EventSetupShell>
  );
}
