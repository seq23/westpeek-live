import { EventSetupShell } from "@/components/events/setup/EventSetupShell";
import { VenueModulesSetupPanel } from "@/components/events/setup/SetupPanels";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export default async function EventSetupSubroutePage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  return (
    <EventSetupShell eventId={resolvedParams.eventId} active="venue" eyebrow="Setup · Venue" title="Venue modules setup">
      <VenueModulesSetupPanel  />
    </EventSetupShell>
  );
}
