import { buildVirtualVenueModel } from "@/services/venue";
import { MainStageExperience } from "@/components/venue/MainStageExperience";
import { VenuePageShell } from "@/components/venue/VenuePageShell";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { SafeSection } from "@/components/system/SafeSection";
import { resolvePreviewView } from "@/lib/auth/previewView";
import { PreviewBanner } from "@/components/preview/PreviewBanner";
import { SupersededCodeNotice } from "@/components/access/SupersededCodeNotice";

export default async function StagePage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams?: Promise<{ saved?: string; viewAs?: string; leaveTo?: string; codeChanged?: string }> }) {
  const resolvedParams = await params;
  const query = searchParams ? await searchParams : undefined;
  await ensureRuntimeEvent(resolvedParams.eventId);
  const model = buildVirtualVenueModel(resolvedParams.eventId);
  // The stage is where "I can't see it" is asked, so it is the page "See their view" opens onto.
  const preview = await resolvePreviewView(resolvedParams.eventId, query?.viewAs);
  return (
    <VenuePageShell model={model} showLegalFooter={false}>
      <SupersededCodeNotice oldCode={query?.codeChanged} />
      {preview ? <PreviewBanner preview={preview} leaveHref={query?.leaveTo || `/app/events/${resolvedParams.eventId}`} /> : null}
      <SafeSection label="Main stage" render={() => MainStageExperience({ model, saved: query?.saved === "profile" })} />
    </VenuePageShell>
  );
}
