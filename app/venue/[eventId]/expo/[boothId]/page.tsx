import { buildVirtualVenueModel, findBooth } from "@/services/venue";
import { SponsorBoothExperience } from "@/components/venue/SponsorBoothExperience";
import { VenuePageShell } from "@/components/venue/VenuePageShell";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export default async function BoothPage({ params }: { params: Promise<{ eventId: string; boothId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  const model = buildVirtualVenueModel(resolvedParams.eventId);
  const booth = findBooth(model.booths, resolvedParams.boothId);
  return (
    <VenuePageShell model={model}>
      <SponsorBoothExperience eventId={model.eventId} booth={booth} />
    </VenuePageShell>
  );
}
