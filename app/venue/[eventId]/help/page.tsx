import { buildVirtualVenueModel } from "@/services/venue";
import { VenueHelpCenter } from "@/components/venue/VenueHelpCenter";
import { VenuePageShell } from "@/components/venue/VenuePageShell";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export default async function HelpPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  const model = buildVirtualVenueModel(resolvedParams.eventId);
  return (
    <VenuePageShell model={model}>
      <VenueHelpCenter model={model} />
    </VenuePageShell>
  );
}
