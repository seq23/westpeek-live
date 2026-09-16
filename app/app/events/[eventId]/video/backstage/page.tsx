import { LiveKitRoomShell } from "@/components/video/LiveKitRoomShell";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";

export default async function BackstageRoomPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  await ensureRuntimeEvent(resolvedParams.eventId);
  return (
    <LiveKitRoomShell
      eventId={resolvedParams.eventId}
      roomId={`${resolvedParams.eventId}-backstage`}
      roomType="backstage"
      role="producer"
      title="Backstage"
      description="Producer and crew backstage room for live coordination outside the attendee-facing room."
    />
  );
}
