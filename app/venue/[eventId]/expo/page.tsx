import { buildVirtualVenueModel } from "@/services/venue";
import { ExpoDirectory } from "@/components/venue/ExpoDirectory";
import { VenuePageShell } from "@/components/venue/VenuePageShell";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { withRuntimeBooths } from "@/services/guests/runtimeBooths";

export default async function ExpoPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  const model = await withRuntimeBooths(buildVirtualVenueModel(resolvedParams.eventId));
  return (
    <VenuePageShell model={model}>
      <ExpoDirectory booths={model.booths} eventId={model.eventId} />
    </VenuePageShell>
  );
}
