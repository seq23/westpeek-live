import { BackupRoomsCard } from "@/components/stage/BackupRoomsCard";
import { LiveKitRoomShell } from "@/components/video/LiveKitRoomShell";
import { SafeSection } from "@/components/system/SafeSection";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export default async function MainStageRoomPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams?: Promise<{ backupRooms?: string; backupRoomsError?: string }> }) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  await ensureRuntimeEvent(resolvedParams.eventId);
  const returnTo = `/app/events/${resolvedParams.eventId}/video/main-stage`;
  return (
    <div className="space-y-6">
      <LiveKitRoomShell
        eventId={resolvedParams.eventId}
        roomId={`${resolvedParams.eventId}-main-stage`}
        roomType="main_stage"
        role="host"
        title="Main Stage"
        description="Producer-controlled LiveKit room shell for the primary event broadcast surface."
      />
      {/* The same Backup rooms card as the crew deck, reachable from the event's own Video page:
          whoever is looking at the stage is who ends up typing the meeting in. */}
      <SafeSection
        label="Backup rooms"
        render={() => BackupRoomsCard({
          eventId: resolvedParams.eventId,
          returnTo,
          saved: resolvedSearchParams?.backupRooms === "saved",
          error: resolvedSearchParams?.backupRoomsError,
        })}
      />
    </div>
  );
}
