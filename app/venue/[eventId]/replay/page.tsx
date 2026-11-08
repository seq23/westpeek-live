import { buildVirtualVenueModel } from "@/services/venue";
import { ReplayCenter } from "@/components/venue/ReplayCenter";
import { ReplayRecordingStatusPanel } from "@/components/venue/ReplayRecordingStatusPanel";
import { buildLiveKitEgressRequest } from "@/services/video";
import { VenuePageShell } from "@/components/venue/VenuePageShell";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { SupersededCodeNotice } from "@/components/access/SupersededCodeNotice";
import { getCrewViewer } from "@/lib/auth/crewViewer";
import { commandBarVisibleTo } from "@/lib/navigation/eventCommandSurfaces";

export default async function ReplayPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams?: Promise<{ codeChanged?: string }> }) {
  const resolvedParams = await params;
  const query = searchParams ? await searchParams : undefined;
  await ensureRuntimeEvent(resolvedParams.eventId);
  const model = buildVirtualVenueModel(resolvedParams.eventId);
  // The recording jobs are a production tool. They render for the owner and operator cookies only,
  // the same rule as the command bar; an attendee (or a failed cookie read) never sees them.
  const crewView = await getCrewViewer(model.eventId).then(commandBarVisibleTo).catch(() => false);
  const recordingJob = crewView ? buildLiveKitEgressRequest({
    agencyId: "runtime-agency",
    eventId: model.eventId,
    storageBucket: "replay-assets",
    storagePath: `${model.eventId}/main-stage.mp4`,
  }) : undefined;

  return (
    <VenuePageShell model={model} surface="replay">
      <div className="space-y-6">
        <SupersededCodeNotice oldCode={query?.codeChanged} />
        <ReplayCenter eventId={model.eventId} replays={model.replays} />
        {recordingJob ? <ReplayRecordingStatusPanel jobs={[recordingJob]} /> : null}
      </div>
    </VenuePageShell>
  );
}
