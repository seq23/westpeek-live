import { buildVirtualVenueModel } from "@/services/venue";
import { ReplayCenter } from "@/components/venue/ReplayCenter";
import { ReplayRecordingStatusPanel } from "@/components/venue/ReplayRecordingStatusPanel";
import { buildLiveKitEgressRequest } from "@/services/video";
import { VenuePageShell } from "@/components/venue/VenuePageShell";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export default async function ReplayPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  const model = buildVirtualVenueModel(resolvedParams.eventId);
  const recordingJob = buildLiveKitEgressRequest({
    agencyId: "runtime-agency",
    eventId: model.eventId,
    storageBucket: "replay-assets",
    storagePath: `${model.eventId}/main-stage.mp4`,
  });

  return (
    <VenuePageShell model={model} surface="replay">
      <div className="space-y-6">
        <ReplayCenter eventId={model.eventId} replays={model.replays} />
        <ReplayRecordingStatusPanel jobs={[recordingJob]} />
      </div>
    </VenuePageShell>
  );
}
