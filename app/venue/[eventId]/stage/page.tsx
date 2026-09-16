import { buildVirtualVenueModel } from "@/services/venue";
import { MainStageExperience } from "@/components/venue/MainStageExperience";
import { VenuePageShell } from "@/components/venue/VenuePageShell";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { SafeSection } from "@/components/system/SafeSection";

export default async function StagePage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  const model = buildVirtualVenueModel(resolvedParams.eventId);
  return (
    <VenuePageShell model={model} showLegalFooter={false}>
      <SafeSection label="Main stage" render={() => MainStageExperience({ model })} />
    </VenuePageShell>
  );
}
