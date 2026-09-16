import { buildVirtualVenueModel, findBooth } from "@/services/venue";
import { SponsorBoothExperience } from "@/components/venue/SponsorBoothExperience";
import { VenuePageShell } from "@/components/venue/VenuePageShell";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { withRuntimeBooths } from "@/services/guests/runtimeBooths";
import { getSponsorBooth } from "@/services/guests/guestStateService";

export default async function BoothPage({ params }: { params: Promise<{ eventId: string; boothId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  const model = await withRuntimeBooths(buildVirtualVenueModel(resolvedParams.eventId));
  const booth = findBooth(model.booths, resolvedParams.boothId);
  const runtimeBooth = await getSponsorBooth(resolvedParams.eventId, resolvedParams.boothId).catch(() => undefined);
  return (
    <VenuePageShell model={model}>
      {runtimeBooth?.link && booth.id === resolvedParams.boothId ? <a href={runtimeBooth.link} target="_blank" rel="noreferrer" className="mb-4 inline-block rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white" data-testid="runtime-booth-link">Open {runtimeBooth.boothName}&rsquo;s link</a> : null}
      <SponsorBoothExperience eventId={model.eventId} booth={booth} />
    </VenuePageShell>
  );
}
